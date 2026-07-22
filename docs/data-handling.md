# Data Handling Boundaries

SwingOps applies one reusable data-handling policy at model audit, tool audit,
and externally exposed tool-output boundaries. The policy reduces accidental
retention or disclosure of common sensitive values without changing the data
used to execute the workflow.

## Protected boundaries

| Boundary                                 | Behavior                                                                                                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ModelCallLog` request and response JSON | Sensitive keys and recognized sensitive text are replaced with typed redaction markers before persistence. Attempt reasons and error messages are also sanitized. |
| `ToolCallLog` input, output, and errors  | Persisted audit copies are sanitized and include policy diagnostics. Connector execution still receives the original input.                                       |
| MCP-compatible tool responses            | Sensitive fields are omitted and recognized sensitive text is redacted before the response leaves the internal connector surface.                                 |

The policy classifies explicit authentication credentials, email addresses,
phone numbers, government identifiers, payment data, person-name fields, and
postal-address fields. Content matching is deliberately limited to
high-confidence formats such as email addresses, formatted North American
phone numbers, formatted Social Security numbers, bearer credentials, and
secret assignments. This avoids treating ordinary product identifiers, prices,
model years, or token-usage counts as sensitive values.

Each persisted audit payload includes `dataHandlingPolicy` diagnostics with the
policy version, boundary, redaction types and count, retention class, and any
prompt-injection indicators. Diagnostics never include the sensitive values
that caused a match.

## Prompt-injection indicators

The policy detects common instruction-override, prompt-extraction,
secret-extraction, and role-manipulation language. These indicators are
advisory audit signals only:

- They do not reject a record.
- They do not grant or remove tool permissions.
- They do not alter workflow state or bypass human review.
- They do not rewrite the source text sent through the existing bounded model
  execution path.

Application-owned state transitions, tool policy, schemas, validation, and
human review remain the enforcement boundaries. Pattern matching alone is not
treated as a complete prompt-injection defense.

## Local demo boundary

This repository is configured as a local demonstration environment. It should
use synthetic or otherwise approved sample data. The current controls are
intentionally limited:

- Audit-log retention is classified but automated expiration or deletion is
  not configured.
- Intake, review, workflow, and domain records may still persist the source
  business data needed by the demonstration.
- The local database is not a tenant-isolated production datastore.
- The local MCP transport does not provide production authentication or remote
  access controls.
- The repository does not claim production DLP, legal hold, consent tracking,
  customer deletion workflows, or managed encryption-key rotation.

## Production controls still required

Before using real customer data, a production implementation should add a
reviewed data inventory, purpose and consent rules, tenant-aware authorization,
least-privilege service identities, encryption and managed key rotation,
environment-specific retention schedules, verified deletion workflows,
security monitoring, incident procedures, and legal/compliance review.
Provider agreements and model data-retention settings must also be reviewed for
the intended data classes and jurisdictions.

The policy in this repository is a defense-in-depth control for audit and tool
boundaries. It is not a substitute for those production controls.
