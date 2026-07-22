import { useEffect, useMemo, useState } from "react";

import { getAdminOpsNormalizationMatrix } from "../../api/workflows";
import type { AdminOpsNormalizationMatrixEntry } from "../../types/workflow";
import {
  AdminOpsAliasList,
  AdminOpsInspectionGuide,
  AdminOpsMetricCard,
  AdminOpsStatusBadge,
  formatNullable,
} from "./adminOpsPresentation";

type FieldFilter = "ALL" | AdminOpsNormalizationMatrixEntry["field"];
type ActionFilter = "ALL" | AdminOpsNormalizationMatrixEntry["action"];

export function AdminOpsNormalizationMatrixPanel() {
  const [entries, setEntries] = useState<AdminOpsNormalizationMatrixEntry[]>(
    [],
  );
  const [searchText, setSearchText] = useState("");
  const [fieldFilter, setFieldFilter] = useState<FieldFilter>("ALL");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadMatrix() {
    try {
      setIsLoading(true);
      setError(null);

      const response = await getAdminOpsNormalizationMatrix();

      setEntries(response.entries);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load normalization matrix.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadMatrix();
  }, []);

  const blockedOrReviewEntries = entries.filter(
    (entry) => entry.action !== "NORMALIZE",
  );

  const fieldOptions = useMemo(
    () => [...new Set(entries.map((entry) => entry.field))].sort(),
    [entries],
  );

  const actionOptions = useMemo(
    () => [...new Set(entries.map((entry) => entry.action))].sort(),
    [entries],
  );

  const filteredEntries = useMemo(() => {
    const normalizedSearch = searchText.trim().toLocaleLowerCase();

    return entries.filter((entry) => {
      if (fieldFilter !== "ALL" && entry.field !== fieldFilter) {
        return false;
      }

      if (actionFilter !== "ALL" && entry.action !== actionFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableValues = [
        entry.id,
        entry.field,
        entry.action,
        entry.notes,
        String(entry.canonicalValue ?? ""),
        ...entry.aliases,
      ];

      return searchableValues.some((value) =>
        value.toLocaleLowerCase().includes(normalizedSearch),
      );
    });
  }, [actionFilter, entries, fieldFilter, searchText]);

  const hasActiveFilters =
    searchText.length > 0 || fieldFilter !== "ALL" || actionFilter !== "ALL";

  function clearFilters() {
    setSearchText("");
    setFieldFilter("ALL");
    setActionFilter("ALL");
  }

  return (
    <section
      className="admin-ops-panel"
      aria-labelledby="admin-ops-normalization-title"
    >
      <div className="admin-ops-panel-heading">
        <span className="model-route-card__eyebrow">Normalization matrix</span>
        <h3 id="admin-ops-normalization-title">
          Structured golf term controls
        </h3>
        <p>
          Search deterministic aliases, negative evidence, context requirements,
          and repair-blocking rules that stay higher authority than model
          output.
        </p>
      </div>

      <div className="admin-ops-mini-metric-grid">
        <AdminOpsMetricCard
          metric={{
            detail: "Read-only entries exposed by the Admin Ops API.",
            label: "Matrix entries",
            value: entries.length,
          }}
        />
        <AdminOpsMetricCard
          metric={{
            detail:
              "Entries that block repair or route ambiguous evidence to review.",
            label: "Guardrail entries",
            value: blockedOrReviewEntries.length,
          }}
        />
        <AdminOpsMetricCard
          metric={{
            detail: "Entries matching the current search and filters.",
            label: "Visible entries",
            value: filteredEntries.length,
          }}
        />
      </div>

      <AdminOpsInspectionGuide
        attention={`${blockedOrReviewEntries.length} entries block automatic repair or route evidence to human review.`}
        inspectNext="Filter by action to inspect blocked repairs, then check context-required aliases before changing parsing behavior."
        showing={`${entries.length} deterministic normalization and guardrail rules from the active workflow matrix.`}
      />

      <div className="admin-ops-record-controls admin-ops-normalization-controls">
        <label className="admin-ops-field admin-ops-field--wide">
          Search matrix
          <input
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search aliases, canonical values, actions, or notes"
            type="search"
            value={searchText}
          />
        </label>

        <label className="admin-ops-field">
          Field
          <select
            onChange={(event) =>
              setFieldFilter(event.target.value as FieldFilter)
            }
            value={fieldFilter}
          >
            <option value="ALL">All fields</option>
            {fieldOptions.map((field) => (
              <option key={field} value={field}>
                {field}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-ops-field">
          Action
          <select
            onChange={(event) =>
              setActionFilter(event.target.value as ActionFilter)
            }
            value={actionFilter}
          >
            <option value="ALL">All actions</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </label>

        <button
          className="admin-ops-clear-button"
          disabled={!hasActiveFilters}
          onClick={clearFilters}
          type="button"
        >
          Clear filters
        </button>
      </div>

      {isLoading ? (
        <p className="admin-ops-muted">Loading normalization matrix...</p>
      ) : null}

      {error ? <p className="admin-ops-error">{error}</p> : null}

      {!isLoading && !error && entries.length === 0 ? (
        <p className="admin-ops-muted">
          No normalization entries are currently exposed.
        </p>
      ) : null}

      {!isLoading &&
      !error &&
      entries.length > 0 &&
      filteredEntries.length === 0 ? (
        <p className="admin-ops-muted">
          No normalization entries match the current search and filters.
        </p>
      ) : null}

      {filteredEntries.length > 0 ? (
        <div className="admin-ops-table-wrap">
          <table className="admin-ops-table admin-ops-table--dense">
            <thead>
              <tr>
                <th>Field</th>
                <th>Aliases</th>
                <th>Canonical value</th>
                <th>Action</th>
                <th>Context</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="admin-ops-table-row-card">
                  <td>{entry.field}</td>
                  <td>
                    <AdminOpsAliasList aliases={entry.aliases} />
                  </td>
                  <td>{formatNullable(entry.canonicalValue)}</td>
                  <td>
                    <AdminOpsStatusBadge
                      tone={
                        entry.action === "NORMALIZE" ? "success" : "warning"
                      }
                    >
                      {entry.action}
                    </AdminOpsStatusBadge>
                  </td>
                  <td>{entry.requiresContext ? "Required" : "Not required"}</td>
                  <td>{entry.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
