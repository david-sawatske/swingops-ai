import type { ModelCallLog } from "../../types/workflow";
import { getRoutingDecision, getRoutingGoal } from "../../utils/modelRoutingDisplay";
import { getStringField } from "../../utils/objectFields";

export function ModelRouteCard({
  modelCallLog,
  title = "Model Route Logged",
}: {
  modelCallLog: ModelCallLog;
  title?: string;
}) {
  const routingDecision = getRoutingDecision(modelCallLog);
  const routingGoal = getRoutingGoal(modelCallLog);

  return (
    <article className="model-route-card">
      <div>
        <span className="model-route-card__eyebrow">{title}</span>
        <h4>
          {modelCallLog.provider} / {modelCallLog.model}
        </h4>
        <p>Mock model call recorded for workflow run {modelCallLog.workflowRunId}</p>
      </div>

      <dl>
        <div>
          <dt>Status</dt>
          <dd>{modelCallLog.status}</dd>
        </div>

        <div>
          <dt>Goal</dt>
          <dd>{routingGoal}</dd>
        </div>

        <div>
          <dt>Cost</dt>
          <dd>{getStringField(routingDecision, "estimatedCostTier")}</dd>
        </div>

        <div>
          <dt>Latency</dt>
          <dd>{getStringField(routingDecision, "expectedLatencyTier")}</dd>
        </div>

        <div>
          <dt>Quality</dt>
          <dd>{getStringField(routingDecision, "qualityTier")}</dd>
        </div>
      </dl>

      <p className="model-route-card__reason">
      </p>
    </article>
  );
}
