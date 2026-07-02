import type {
  ExecuteMultiSourceIntakeDemoRequest,
  ExecuteMultiSourceIntakeDemoResponse,
} from "../../../types/workflow";

export type SourceInputMode = "PASTE" | "UPLOAD";

export type GuidedSourceIntakeBuilderProps = {
  result: ExecuteMultiSourceIntakeDemoResponse | null;
  isRunning: boolean;
  error: string | null;
  success: string | null;
  onRunSources: (request?: ExecuteMultiSourceIntakeDemoRequest) => void;
};
