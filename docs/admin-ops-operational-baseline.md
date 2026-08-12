# Admin Ops Operational Baseline

This document defines the synthetic operational story that the Admin Ops
dashboard should present. It is the shared contract for the origin schema,
deterministic fixtures, persistence, summary API, and interface work. It does
not describe randomly generated sample data.

The deterministic fixture builder is implemented in
`services/api/src/operational-data/admin-ops-baseline-fixtures.ts`. It produces
database-shaped records with stable identifiers and timestamps relative to a
caller-supplied anchor. The accompanying reconciliation validator derives every
documented total from the individual fixture records before they are eligible
for persistence. Building the fixtures remains side-effect free. The
`pnpm baseline:refresh` operator command performs database replacement in one
serializable transaction and deletes only records marked `SEEDED_BASELINE`.
Automatic scheduling remains a separate operational step.

## Purpose

The baseline should let a technical reviewer understand the operating model in
a few minutes:

1. Multiple stores send inconsistent trade-in records through different source
   channels.
2. Most records become usable through deterministic parsing, normalization,
   reference data, and grounding.
3. Incomplete or ambiguous records remain visible for review instead of being
   silently completed.
4. Human corrections replace upstream candidates without erasing history.
5. Model-provider failures can recover through fallback while output validation
   and application-owned workflow control remain active.

The data should look like a small but credible week of operations. It should be
large enough to produce useful distributions and trends without making the
guided demonstration slow or difficult to inspect.

## Reporting window

The baseline represents the seven days ending at the time it is seeded.

- `T0` is the seed execution time.
- Fixture timestamps are expressed as offsets from `T0`, not fixed dates.
- All 56 AI-ready records fall within the seven-day and 30-day windows.
- Nine records fall within the most recent 24 hours.
- Re-running the seed moves the baseline window forward without changing its
  identifiers, relationships, or totals.

The dashboard should eventually identify this data as a synthetic operational
baseline and allow it to be distinguished from live demonstration activity.

Operational origin support is implemented through `OperationalDataOrigin`.
The baseline fixture must use `SEEDED_BASELINE`; ordinary user-triggered runs
use `LIVE_DEMO`; and protected guided history uses `GOLDEN_DEMONSTRATION`.

## Operating context

The week covers three stores with distinct operating characteristics.

| Store     | Role in the story                                                  | Active records | Replaced history |
| --------- | ------------------------------------------------------------------ | -------------: | ---------------: |
| 104       | Higher-volume store with mature counter-note practices             |             21 |                3 |
| 207       | Store using a CSV export that occasionally produces malformed rows |             16 |                3 |
| 312       | Store affected by a temporary operations-log formatting regression |             11 |                2 |
| **Total** |                                                                    |         **48** |            **8** |

The source degradation at Store 312 is intentional. It explains why operations
logs have the highest review rate and gives the dashboard a specific issue for
an operator to investigate.

## AI-ready record contract

The fixture contains 56 persisted AI-ready records: 48 current records and 8
upstream candidates that were replaced by later reviewed output.

| Source type    | Grounding-ready | Needs review | Active | Replaced |  Total |
| -------------- | --------------: | -----------: | -----: | -------: | -----: |
| Free text      |              12 |            6 |     18 |        3 |     21 |
| Malformed CSV  |               9 |            3 |     12 |        2 |     14 |
| Email          |               8 |            2 |     10 |        1 |     11 |
| Operations log |               2 |            6 |      8 |        2 |     10 |
| **Total**      |          **31** |       **17** | **48** |    **8** | **56** |

The persisted status contract is:

| Status          | Count | Required flags                         |
| --------------- | ----: | -------------------------------------- |
| `READY_FOR_RAG` |    31 | `reviewNeeded=false`, `ragReady=true`  |
| `NEEDS_REVIEW`  |    17 | `reviewNeeded=true`, `ragReady=false`  |
| `SUPERSEDED`    |     8 | Linked to a current replacement record |

`READY_FOR_REVIEW` is not part of the initial baseline because the current
intake workflow produces either `READY_FOR_RAG` or `NEEDS_REVIEW`, and completed
guided corrections are required to have a grounding-ready shape.

### Active category mix

| Category            |  Count |
| ------------------- | -----: |
| Driver              |     14 |
| Putter              |      8 |
| Wedge               |      8 |
| Fairway wood        |      7 |
| Iron set            |      6 |
| Hybrid              |      4 |
| Blank or unresolved |      1 |
| **Total**           | **48** |

### Missing-field hotspots

Missing-field counts intentionally overlap because one record can require more
than one correction.

| Field           | Active records missing the field | Operational explanation                                      |
| --------------- | -------------------------------: | ------------------------------------------------------------ |
| Condition grade |                               10 | Wear notes were supplied without an approved grade           |
| Shaft flex      |                                8 | Handwritten shorthand or incomplete log payloads             |
| Trade-in value  |                                7 | Inspection or valuation was still pending                    |
| Product line    |                                4 | Brand and category were known, but catalog identity was not  |
| Category        |                                2 | Source language was ambiguous, including a utility-wood case |
| Brand           |                                1 | The source identified only an unrecognized model fragment    |

## Workflow and review contract

Fourteen workflow runs distribute the records across the week.

| Workflow status |  Count | Meaning                                                        |
| --------------- | -----: | -------------------------------------------------------------- |
| `COMPLETED`     |      8 | All required work completed or review work was resolved        |
| `NEEDS_REVIEW`  |      5 | At least one current record still requires human action        |
| `FAILED`        |      1 | A source-processing failure occurred before record persistence |
| **Total**       | **14** |                                                                |

The failed run contributes no AI-ready records. Its failure must have a concise,
actionable reason rather than a provider stack trace.

The review history contains 34 items.

| Review status |  Count | Relationship                                                 |
| ------------- | -----: | ------------------------------------------------------------ |
| `OPEN`        |     10 | Current review-required records awaiting action              |
| `IN_REVIEW`   |      7 | Current records assigned to verification or store inspection |
| `RESOLVED`    |      9 | Corrections applied to current grounding-ready records       |
| `SUPERSEDED`  |      8 | Historical items replaced by later workflow output           |
| **Total**     | **34** |                                                              |

The 17 open or in-review items map one-to-one to the 17 active AI-ready records
with `reviewNeeded=true`. Each superseded review item and AI-ready record must
link to its replacement rather than existing as unexplained history.

Synthetic `HumanReviewLearningEvent` rows must not participate in live prior-
review matching until data origin can be enforced in that query. The initial
baseline should omit those rows or isolate them from live workflow behavior.

## Model-assistance contract

The baseline shows reliable final execution without pretending that providers
never fail.

| Metric                          | Expected value |
| ------------------------------- | -------------: |
| Logical model calls             |             20 |
| Succeeded logical calls         |             20 |
| Failed logical calls            |              0 |
| Provider attempts               |             22 |
| Successful attempts             |             20 |
| Non-successful attempts         |              2 |
| Calls using fallback            |              2 |
| Logical execution success rate  |           100% |
| Provider-attempt success rate   |          90.9% |
| Fallback rate                   |            10% |
| Accepted-output validation rate |           100% |
| Selected records                |             58 |
| Validated record outcomes       |             58 |
| Repair suggestions              |             32 |
| Candidate comparisons           |             14 |
| No-safe-repair outcomes         |             12 |
| Total tokens                    |         28,600 |
| Estimated cost                  |        $0.0614 |

Attempt-level behavior is fixed:

- 18 OpenAI attempts succeed directly.
- One OpenAI attempt times out and succeeds through the mock fallback.
- One OpenAI attempt is rate-limited and succeeds through the mock fallback.
- Both fallback outputs pass the same schema and outcome validation used for
  direct provider outputs.

Latency values should show the timeout as an obvious outlier, the rate-limited
fallback as a smaller disruption, and successful OpenAI calls as the normal
operating range. Exact per-call values belong in the fixture, but the aggregate
logical-call average should be 7,886 ms.

## Tool and grounding story

These targets define later summary work; the current Admin Ops API does not yet
expose all of them.

- The existing knowledge corpus remains the authority: 3 documents and 72
  chunks across product references, aliases, condition guidance, review policy,
  and malformed-source examples.
- 44 of 48 active records retrieve relevant knowledge evidence.
- 42 of 48 active records receive a supported catalog match or bounded
  candidate set.
- 38 of 48 active records receive sufficient evidence for a valuation range.
- Authorized tool activity is read-only.
- Two mutation-oriented attempts are blocked by policy and produce no writes.
- Ambiguous products and negative evidence remain review-facing even when a
  plausible candidate exists.

The knowledge panel should eventually distinguish record readiness from actual
knowledge ingestion and retrieval coverage. A `ragReady` flag alone is not
evidence that a knowledge search occurred or succeeded.

## Required scenario catalog

Every intentionally unusual metric must be explainable through a named fixture
scenario.

| Scenario                   | Expected behavior                                                         |
| -------------------------- | ------------------------------------------------------------------------- |
| Clean counter note         | Complete source data becomes grounding-ready without review               |
| Recognized shorthand       | Aliases normalize while preserving the exact matched text                 |
| Malformed CSV row          | Recoverable columns are retained and missing fields route to review       |
| Degraded log payload       | A formatting regression creates the highest source-level review pressure  |
| Ambiguous catalog identity | Two candidates are shown without silently selecting one                   |
| Unknown product line       | Known brand and category remain, but product identity requires inspection |
| Negative evidence          | `unknown`, `pending`, and similar phrases block unsupported repair        |
| Store inspection           | Physical-item fields remain open until verified details are entered       |
| Human correction           | Saved values create a current record and preserve the replaced candidate  |
| Provider timeout           | The fallback succeeds and the validated outcome remains advisory          |
| Provider rate limit        | Routing recovers without changing application-owned state authority       |
| Unsafe mutation            | Policy blocks the attempt and records the decision in the audit trail     |
| Source-processing failure  | One run fails cleanly before producing records                            |

The four existing workflow evaluation scenarios remain real executable quality
checks. Their pass results should never be created by this operational seed.

## Dashboard narrative by section

### AI-ready records

The operator should see healthy overall throughput, a clear operations-log
quality problem, and replacement history that explains how corrections preserve
provenance.

### Quality checks

The operator should see the latest real execution of the four guarded workflow
scenarios. This section should not use synthetic pass results.

### Model telemetry

The operator should see that final execution stayed successful despite two
provider disruptions, with accepted output fully covered by validation.

### Normalization matrix

The operator should be able to distinguish configured normalization rules from
observed use. Later summary work should add counts, most recent source phrases,
review overrides, and blocked-repair occurrences for the baseline records.

### Knowledge grounding

The operator should see both the seeded knowledge inventory and operational
retrieval coverage. Record readiness and retrieval success must remain separate
concepts.

## Reconciliation requirements

Implementation tests must enforce these invariants:

- `56 total = 48 active + 8 superseded`.
- `48 active = 31 grounding-ready + 17 needs review`.
- Source totals, category totals, status totals, and store totals reconcile.
- The 17 active review items align with the 17 review-required records.
- Every superseded record links to one current replacement.
- `20 logical calls = 18 direct successes + 2 fallback successes`.
- `22 attempts = 20 successful + 2 non-successful`.
- `58 selected records = 58 validated outcomes`.
- `58 outcomes = 32 repair suggestions + 14 candidate comparisons + 12
no-safe-repair outcomes`.
- Seeded cost, token, latency, and provider totals match the values calculated
  from individual calls and attempts.
- Re-running the seed changes no identifiers or counts.
- The baseline cannot change the behavior of a live guided workflow.

## Out of scope for the baseline fixture

The fixture does not claim production traffic volume, multi-tenant isolation,
real inventory availability, live market valuation, production knowledge-corpus
quality, or provider service-level performance. Those concerns require separate
production data, access controls, capacity tests, monitoring, and acceptance
criteria.
