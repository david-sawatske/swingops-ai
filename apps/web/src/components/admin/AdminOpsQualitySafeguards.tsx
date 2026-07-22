import { useEffect, useState } from "react";

import { getAdminOpsWorkflowConfig } from "../../api/workflows";
import type { GetAdminOpsWorkflowConfigResponse } from "../../types/workflow";

export function AdminOpsQualitySafeguards() {
  const [config, setConfig] =
    useState<GetAdminOpsWorkflowConfigResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadConfig() {
    try {
      setIsLoading(true);
      setError(null);

      const response = await getAdminOpsWorkflowConfig();

      setConfig(response);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load active workflow safeguards.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadConfig();
  }, []);

  const modelAuthority =
    config?.confidenceThresholds.find(
      (item) => item.name === "modelAuthority",
    ) ?? null;
  const reviewRouting =
    config?.confidenceThresholds.find(
      (item) => item.name === "reviewRouting",
    ) ?? null;
  const providerPolicy = config?.providerRoutingPolicy[0] ?? null;

  const safeguards = config
    ? [
        {
          label: "Model authority",
          value: modelAuthority?.value ?? "Not reported",
        },
        {
          label: "Review routing",
          value: reviewRouting?.value ?? "Not reported",
        },
        {
          label: "Tool access",
          value: config.mutationPolicy.readOnlyToolsOnly
            ? "Read-only"
            : "Mutation enabled",
        },
        {
          label: "Provider output",
          value: providerPolicy?.validationRequired
            ? "Validation required"
            : "Validation not required",
        },
      ]
    : [];

  return (
    <div
      className="admin-ops-quality-safeguards"
      aria-label="Active workflow safeguards"
    >
      <div className="admin-ops-quality-safeguards__heading">
        <span>Active safeguards</span>
        <p>Controls applied to the quality-check scenarios below.</p>
      </div>

      {isLoading ? (
        <p className="admin-ops-muted">Loading active safeguards...</p>
      ) : null}

      {error ? <p className="admin-ops-error">{error}</p> : null}

      {safeguards.length > 0 ? (
        <div className="admin-ops-quality-safeguards__list">
          {safeguards.map((safeguard) => (
            <div
              className="admin-ops-quality-safeguard"
              key={safeguard.label}
            >
              <span>{safeguard.label}</span>
              <strong>{safeguard.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
