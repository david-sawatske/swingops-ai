/**
 * IntakeBatch.sourceType still uses the original Prisma enum for persisted
 * batch compatibility.
 *
 * Current guided intake source types are stored on multi-source workflow output
 * and AI-ready intake records:
 * FREE_TEXT, POORLY_FORMED_CSV, EMAIL, LOG.
 */
export const LEGACY_FREEFORM_NOTES_INTAKE_SOURCE_TYPE = "FREEFORM_NOTES" as const;

export const LEGACY_MANUAL_ENTRY_INTAKE_SOURCE_TYPE = "MANUAL_ENTRY" as const;
