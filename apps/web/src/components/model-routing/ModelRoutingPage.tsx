import type { FormEvent } from "react";
import type {
  ModelRouteCandidateSummary,
  ModelRouteRejectedCandidate,
  ModelRoutingGoal,
  ModelTaskType,
  PreviewModelRoutingResponse,
} from "../../types/ai";
import { DashboardSection } from "../DashboardSection";
import { EmptyState } from "../EmptyState";
import {
  MODEL_ROUTING_GOALS,
  MODEL_TASK_TYPES,
} from "../../constants/modelRouting";
import { formatEnumLabel } from "../../utils/formatting";

export function ModelRoutingPage({
  taskType,
  goal,
  requireJson,
  allowDisabledProviders,
  preview,
  isPreviewing,
  error,
  onTaskTypeChange,
  onGoalChange,
  onRequireJsonChange,
  onAllowDisabledProvidersChange,
  onSubmit,
}: {
  taskType: ModelTaskType;
  goal: ModelRoutingGoal;
  requireJson: boolean;
  allowDisabledProviders: boolean;
  preview: PreviewModelRoutingResponse | null;
  isPreviewing: boolean;
  error: string | null;
  onTaskTypeChange: (taskType: ModelTaskType) => void;
  onGoalChange: (goal: ModelRoutingGoal) => void;
  onRequireJsonChange: (requireJson: boolean) => void;
  onAllowDisabledProvidersChange: (allowDisabledProviders: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <DashboardSection
      title="Model Routing Provider Health and Costs"
      description="Preview health, latency, cost, quality, and fallback-aware provider selection across mock, OpenAI, Anthropic, Azure OpenAI, and local/open-source style providers."
    >
      <div className="section-intro-card">
        <span className="model-route-card__eyebrow">Routing Story</span>
        <h3>Provider routing separated from workflow logic</h3>
        <p>
          The workflow asks for a task outcome. The routing layer decides which
          provider/model should handle it based on health, estimated latency, estimated cost, quality tier, task type, JSON requirements, and fallback behavior.
        </p>
      </div>

      <form className="model-routing-preview-form" onSubmit={onSubmit}>
        <label>
          Task Type
          <select
            onChange={(event) =>
              onTaskTypeChange(event.target.value as ModelTaskType)
            }
            value={taskType}
          >
            {MODEL_TASK_TYPES.map((modelTaskType) => (
              <option key={modelTaskType} value={modelTaskType}>
                {formatEnumLabel(modelTaskType)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Preferred Goal
          <select
            onChange={(event) =>
              onGoalChange(event.target.value as ModelRoutingGoal)
            }
            value={goal}
          >
            {MODEL_ROUTING_GOALS.map((routingGoal) => (
              <option key={routingGoal} value={routingGoal}>
                {formatEnumLabel(routingGoal)}
              </option>
            ))}
          </select>
        </label>

        <label className="model-routing-preview-form__checkbox">
          <input
            checked={requireJson}
            onChange={(event) => onRequireJsonChange(event.target.checked)}
            type="checkbox"
          />
          Require structured JSON output
        </label>

        <label className="model-routing-preview-form__checkbox">
          <input
            checked={allowDisabledProviders}
            onChange={(event) =>
              onAllowDisabledProvidersChange(event.target.checked)
            }
            type="checkbox"
          />
          Include disabled providers for portfolio simulation
        </label>

        <button disabled={isPreviewing} type="submit">
          {isPreviewing ? "Previewing…" : "Preview Model Route"}
        </button>
      </form>

      {error ? (
        <p className="form-message form-message--error">{error}</p>
      ) : null}

      {preview ? (
        <div className="model-routing-preview-result">
          <article className="model-routing-selected-card">
            <div>
              <span className="model-route-card__eyebrow">Selected Route</span>
              <h3>
                {preview.routingDecision.provider} /{" "}
                {preview.routingDecision.model}
              </h3>
              <p>{preview.routingDecision.reason}</p>
            </div>

            <dl>
              <div>
                <dt>Task</dt>
                <dd>{formatEnumLabel(preview.routingRequest.taskType)}</dd>
              </div>

              <div>
                <dt>Goal</dt>
                <dd>{formatEnumLabel(preview.routingRequest.preferredGoal)}</dd>
              </div>

              <div>
                <dt>JSON</dt>
                <dd>{String(preview.routingRequest.requireJson)}</dd>
              </div>

              <div>
                <dt>Cost</dt>
                <dd>{preview.routingDecision.estimatedCostTier}</dd>
              </div>

              <div>
                <dt>Latency</dt>
                <dd>{preview.routingDecision.expectedLatencyTier}</dd>
              </div>

              <div>
                <dt>Quality</dt>
                <dd>{preview.routingDecision.qualityTier}</dd>
              </div>
            </dl>

            {preview.routingDecision.fallbackReason ? (
              <p className="model-routing-selected-card__fallback">
                Fallback: {preview.routingDecision.fallbackReason}
              </p>
            ) : null}
          </article>

          <div className="model-routing-preview-grid">
            <div>
              <h4>Providers Considered</h4>

              <div className="model-routing-candidate-list">
                {preview.routingDecision.candidatesConsidered.map(
                  (candidate: ModelRouteCandidateSummary) => (
                    <article
                      className="model-routing-candidate-card"
                      key={`${candidate.provider}-${candidate.model}`}
                    >
                      <div>
                        <strong>
                          {candidate.provider} / {candidate.model}
                        </strong>
                        <p>
                          Supports {candidate.supportedTaskTypes.length} task
                          type{candidate.supportedTaskTypes.length === 1 ? "" : "s"}.
                        </p>
                      </div>

                      <dl>
                        <div>
                          <dt>Cost</dt>
                          <dd>{candidate.costTier}</dd>
                        </div>

                        <div>
                          <dt>Latency</dt>
                          <dd>{candidate.latencyTier}</dd>
                        </div>

                        <div>
                          <dt>Quality</dt>
                          <dd>{candidate.qualityTier}</dd>
                        </div>

                        <div>
                          <dt>Executable</dt>
                          <dd>{String(candidate.enabledForExecution)}</dd>
                        </div>
                      </dl>
                    </article>
                  ),
                )}
              </div>
            </div>

            <div>
              <h4>Rejected Providers</h4>

              {preview.routingDecision.rejectedCandidates.length === 0 ? (
                <EmptyState
                  title="No rejected provider options"
                  message="Every considered provider/model matched this routing request."
                />
              ) : (
                <div className="model-routing-candidate-list">
                  {preview.routingDecision.rejectedCandidates.map(
                    (candidate: ModelRouteRejectedCandidate) => (
                      <article
                        className="model-routing-candidate-card model-routing-candidate-card--rejected"
                        key={`${candidate.provider}-${candidate.model}`}
                      >
                        <div>
                          <strong>
                            {candidate.provider} / {candidate.model}
                          </strong>
                          <p>{candidate.rejectedReasons.join(", ")}</p>
                        </div>

                        <dl>
                          <div>
                            <dt>Cost</dt>
                            <dd>{candidate.costTier}</dd>
                          </div>

                          <div>
                            <dt>Latency</dt>
                            <dd>{candidate.latencyTier}</dd>
                          </div>

                          <div>
                            <dt>Quality</dt>
                            <dd>{candidate.qualityTier}</dd>
                          </div>

                          <div>
                            <dt>JSON</dt>
                            <dd>{String(candidate.supportsJson)}</dd>
                          </div>
                        </dl>
                      </article>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          title="No model route preview yet"
          message="Choose a task and goal to preview how SwingOps selects a model provider."
        />
      )}
    </DashboardSection>
  );
}
