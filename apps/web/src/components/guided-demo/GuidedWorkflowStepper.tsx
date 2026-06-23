type GuidedWorkflowStep<TStep extends string> = {
  id: TStep;
  label: string;
  eyebrow: string;
  description: string;
};

type GuidedWorkflowStepperProps<TStep extends string> = {
  activeStep: TStep;
  canOpenStep: (step: TStep) => boolean;
  getStepStatus: (step: TStep, index: number) => string;
  onStepChange: (step: TStep) => void;
  steps: GuidedWorkflowStep<TStep>[];
};

export function GuidedWorkflowStepper<TStep extends string>({
  activeStep,
  canOpenStep,
  getStepStatus,
  onStepChange,
  steps,
}: GuidedWorkflowStepperProps<TStep>) {
  return (
    <aside className="guided-workflow-stepper" aria-label="Guided workflow steps">
      {steps.map((step, index) => {
        const status = getStepStatus(step.id, index);

        return (
          <button
            className={
              step.id === activeStep
                ? "guided-workflow-stepper__item guided-workflow-stepper__item--active"
                : "guided-workflow-stepper__item"
            }
            disabled={!canOpenStep(step.id)}
            key={step.id}
            onClick={() => onStepChange(step.id)}
            type="button"
          >
            <span>{index + 1}</span>
            <div>
              <small>{step.eyebrow}</small>
              <strong>{step.label}</strong>
              <em>{status}</em>
            </div>
          </button>
        );
      })}
    </aside>
  );
}
