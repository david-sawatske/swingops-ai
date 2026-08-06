# Deployment

The repository includes a Render Blueprint that provisions the complete hosted
demo from `main`:

- A globally distributed static site for the React app.
- A Node.js web service for the Fastify API.
- A managed PostgreSQL 16 database with the `pgvector` extension enabled by the
  existing Prisma migration.

The API and database run in the Ohio region and communicate over Render's
private network. The browser calls the public API origin configured in the
static site's build environment.

## Create the preview deployment

1. Sign in to Render and create a new Blueprint.
2. Connect the `david-sawatske/swingops-ai` GitHub repository.
3. Render detects `render.yaml`; review the three resources and apply the
   Blueprint.
4. Wait for the database, API, and static site to finish deploying.

The API starts in deterministic mock mode because real provider calls default
to disabled. The Blueprint does not manage provider credentials or the
real-call toggle, so later Blueprint syncs cannot overwrite those
dashboard-owned values. Database migrations run before the API starts serving
traffic.

## Free-preview limitations

The checked-in Blueprint uses free resources so creating the preview does not
implicitly authorize paid infrastructure. Render's free API service can spin
down after inactivity and take about a minute to wake. A free Render PostgreSQL
database expires after 30 days and does not include backups.

Before sharing a durable link, upgrade the API service and PostgreSQL database
to appropriate paid plans in Render. The static site can remain on its free
plan.

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
4. Refresh the browser on both the main workflow and Admin Ops views to verify
   the single-page application rewrite.
5. If live model assistance is enabled, rerun guarded execution once normally
   and once with the provider-outage option enabled.

Render automatically deploys later commits to `main` after the repository's CI
checks pass.
