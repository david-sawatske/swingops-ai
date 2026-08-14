# Deployment

The repository includes a Render Blueprint that provisions the complete hosted
demo from `main`:

- A globally distributed static site for the React app.
- An always-on Starter Node.js web service for the Fastify API.
- A persistent Basic-256mb PostgreSQL 16 database with 1 GB of storage and the
  `pgvector` extension enabled by the existing Prisma migration.

The API and database run in the Ohio region and communicate over Render's
private network. The browser calls the public API origin configured in the
static site's build environment.

## Operational maintenance

The deployed demo uses one bounded maintenance operation for baseline freshness
and live-demo retention. Preview its exact plan without changing the database:

    pnpm maintenance:preview

Apply the operation manually with:

    pnpm maintenance:run

The operation first refreshes the isolated baseline, then prunes only
`LIVE_DEMO` graphs whose retention timestamps are older than 14 days. It never
targets `SEEDED_BASELINE` or `GOLDEN_DEMONSTRATION`. Both phases use
transaction-scoped advisory locks, serializable transactions, and count
reconciliation. A failed phase rolls back its own writes.

The lower-level baseline-only command remains available for fixture work:

    pnpm baseline:refresh

The command generates and reconciles the complete fixture graph before it
writes. It then acquires a PostgreSQL transaction-scoped advisory lock and
replaces only rows marked `SEEDED_BASELINE` in one serializable transaction.
Ordinary guided runs and protected golden-demonstration history are not
deleted. A failed refresh rolls back without exposing a partially replaced
baseline.

An optional anchor is available for repeatable operator testing:

    pnpm baseline:refresh -- --anchor=2026-08-12T17:00:00.000Z

The Render Blueprint runs maintenance after Prisma migrations and before the
API server accepts traffic whenever its process starts. This guarantees that
the current fixture code is represented in Admin Ops before the API becomes
healthy. Startup fails instead of serving a partially refreshed baseline if
maintenance fails.

Because the portfolio API remains running, it also schedules the same operation
every 24 hours through `ADMIN_OPS_MAINTENANCE_INTERVAL_HOURS`. Scheduled failures
are logged without terminating the API, and the next interval remains active.
Transaction-scoped advisory locks prevent overlapping refresh or retention
writes. Local development defaults the interval to `0` (disabled); supported
values are 0–168 hours. The retention window remains independently configurable
through `LIVE_DEMO_RETENTION_DAYS`, bounded to 1–365 days.

After an API deployment or restart:

1. Confirm the startup logs report successful migrations and Admin Ops
   maintenance.
2. Confirm the result reports a 56-record baseline and the expected retention
   cutoff.
3. Verify the API health check, Admin Ops baseline scope, and golden
   demonstration still load.

## Create the portfolio deployment

1. Sign in to Render and create a new Blueprint.
2. Connect the `david-sawatske/swingops-ai` GitHub repository.
3. Render detects `render.yaml`; review the free static site, Starter API, and
   Basic-256mb database, then apply the Blueprint.
4. Wait for the database, API, and static site to finish deploying.

The API starts in deterministic mock mode because real provider calls default
to disabled. The Blueprint does not manage provider credentials or the
real-call toggle, so later Blueprint syncs cannot overwrite those
dashboard-owned values. Database migrations and bounded Admin Ops maintenance
run before the API starts serving traffic.

## Portfolio hosting profile

The static site remains free. The API uses Render's Starter instance so it does
not spin down after inactivity, and PostgreSQL uses the smallest paid Basic
instance so the database does not expire after 30 days. The Blueprint fixes
database storage at 1 GB and disables storage autoscaling to keep billing
bounded. At the prices verified in August 2026, the expected total is $13.30
per month ($7 API, $6 database compute, and $0.30 database storage); confirm
current pricing in Render before applying future plan changes.

The account must have a payment method before Render can apply either paid
instance type. Render bills instance changes on a prorated basis.

## Enable live model assistance

Keep real model calls disabled until the deterministic deployed workflow has
passed its smoke test. In the Render dashboard, open the API service's
**Environment** page and add these service-level environment variables:

    ENABLE_REAL_MODEL_CALLS=true
    OPENAI_API_KEY=<secret value>

`OPENAI_MODEL=gpt-4.1-mini` is already managed by the Blueprint. Save the API
key as a secret value, never paste it into issue comments or deployment logs,
and do not add it to `render.yaml` or commit it to the repository. Keep
`ENABLE_REAL_MODEL_CALLS` dashboard-owned as well so a later Blueprint sync
does not silently disable live assistance. Other supported provider variables
are documented in `services/api/.env.example`.

After saving the variables, deploy the API service and verify its startup logs
without exposing the key. To return the hosted demo to deterministic mode, set
`ENABLE_REAL_MODEL_CALLS=false` and redeploy; the credential can remain stored
as a secret.

## Deployment smoke test

After all three resources report healthy:

1. Open the static site and load the golden demonstration.
2. Complete all five workflow steps using deterministic model assistance.
3. Confirm the API health endpoint returns a successful response.
4. Confirm repeated health requests return without a free-tier wake-up delay.
5. Refresh the browser on both the main workflow and Admin Ops views to verify
   the single-page application rewrite.
6. If live model assistance is enabled, rerun guarded execution once normally
   and once with the provider-outage option enabled.

Render automatically deploys later commits to `main` after the repository's CI
checks pass.
