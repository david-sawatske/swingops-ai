import type { ConnectorCatalogItem } from "../../types/mcp";
import {
  formatEnabledLabel,
  formatEnumLabel,
  formatToolCallTimestamp,
} from "../../utils/formatting";

export function ConnectorCatalogCard({
  connector,
}: {
  connector: ConnectorCatalogItem;
}) {
  return (
    <article className="mcp-connector-catalog-card">
      <div className="mcp-connector-catalog-card__header">
        <div>
          <span className="model-route-card__eyebrow">
            {connector.policyDecision === "ALLOW"
              ? "Allowed read-only tool"
              : "Blocked or disabled tool"}
          </span>
          <h3>{connector.displayName}</h3>
          <p>{connector.description}</p>
        </div>

        <span
          className={
            connector.policyDecision === "ALLOW"
              ? "mcp-policy-pill mcp-policy-pill--allow"
              : "mcp-policy-pill mcp-policy-pill--block"
          }
        >
          {connector.policyDecision}
        </span>
      </div>

      <dl className="mcp-connector-catalog-card__metadata">
        <div>
          <dt>Tool ID</dt>
          <dd title={connector.name}>{connector.name}</dd>
        </div>

        <div>
          <dt>Risk</dt>
          <dd>{connector.riskLevel}</dd>
        </div>

        <div>
          <dt>Mutates Data</dt>
          <dd>{String(connector.mutatesData)}</dd>
        </div>

        <div>
          <dt>Approval</dt>
          <dd>{String(connector.requiresHumanApproval)}</dd>
        </div>

        <div>
          <dt>Enabled</dt>
          <dd>{formatEnabledLabel(connector.enabled)}</dd>
        </div>

        <div>
          <dt>Allowed Mode</dt>
          <dd>{formatEnumLabel(connector.allowedExecutionMode)}</dd>
        </div>

        <div>
          <dt>Last Invoked</dt>
          <dd>{formatToolCallTimestamp(connector.lastInvokedAt)}</dd>
        </div>

        <div>
          <dt>Counts</dt>
          <dd>
            {connector.invocationCounts.succeeded} ok /{" "}
            {connector.invocationCounts.failed} failed /{" "}
            {connector.invocationCounts.blocked} blocked
          </dd>
        </div>
      </dl>

      <p className="mcp-connector-catalog-card__reason">
        {connector.policyReason}
      </p>
    </article>
  );
}
