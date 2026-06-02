/** SDK option types — matches the api.corthography.ai response schemas. */

export type Workflow = "template-query" | "template-render" | "template-publish";
export type Environment = "test" | "prod";
export type RunStatus =
  | "queued"
  | "running"
  | "awaiting_approval"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface ClientOptions {
  /** Bearer token for authenticating to api.corthography.ai. */
  token: string;
  /** Base URL of the API. Defaults to `https://api.corthography.ai/v1`. */
  baseUrl?: string;
  /** Custom fetch implementation (Node 20+ has global fetch; tests inject a mock). */
  fetch?: typeof fetch;
  /** Request timeout in ms (defaults to 30000). */
  timeoutMs?: number;
}

export interface StartRunRequest {
  workflow: Workflow;
  target: string;
  environment?: Environment;
  /** Optional pin to a partner-repo git ref. */
  templateRef?: string;
}

export interface StartRunResponse {
  runId: string;
  status: "queued";
}

/** Live, best-effort progress for an in-flight run, written by the engine as a
 * long-running job advances (e.g. template-query). Absent until a job reports
 * it. For sharded queries `itemsFetched` stays 0 until the run finalizes (the
 * per-entity live count lives in the engine's S3 heartbeat, not the run
 * record); `totalShards` shows the fan-out. Not a substitute for `status`. */
export interface RunProgress {
  phase?: string;
  status?: string;
  itemsFetched?: number;
  chunksCreated?: number;
  totalShards?: number;
  updatedAt?: string;
}

export interface RunSummary {
  runId: string;
  partnerId: string;
  workflow: Workflow;
  target: string;
  environment: Environment;
  status: RunStatus;
  currentPhase?: string;
  startedAt: string;
  completedAt?: string;
  sfnExecutionArn?: string;
  outputPaths?: Record<string, string>;
  error?: string;
  progress?: RunProgress;
}

export interface ProjectListItem {
  templateKey: string;
  projectSlugs: string[];
}

export interface TemplateListItem {
  templateKey: string;
}

export interface HealthResponse {
  status: "ok";
  version: string;
}

export interface ApproveRunRequest {
  decision?: "approve" | "reject";
  reason?: string;
}
