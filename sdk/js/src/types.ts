/** SDK option types — matches the api.corthography.ai response schemas. */

/** A workflow the API can run. The first three are one pipeline stage each.
 * The last two are chained: several stages in a single run, so every stage
 * uses the same commit of the template repo (see `TemplateCommit`). */
export type Workflow =
  | "template-query"
  | "template-render"
  | "template-publish"
  | "template-query-render"
  | "template-query-render-publish";
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

/** One ref of the partner's template repo that a run used, and the commit it
 * resolved to. A run resolves each ref once and every job of that run uses
 * the same commit, so a push made after the run started is not part of it —
 * start a new run to pick it up. */
export interface TemplateCommit {
  /** The template repo, as `host/owner/name`. */
  repo: string;
  /** The ref that was resolved: a branch or tag name, or the commit SHA itself
   * when the run was pinned to an exact commit. */
  ref: string;
  /** The full commit SHA the run used for that ref. */
  sha: string;
  /** When the run resolved the ref (ISO 8601, UTC). */
  resolvedAt?: string;
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
  /** The commit each template-repo ref of this run resolved to, oldest first.
   * Usually one entry; a run started with a `templateRef` has a second one for
   * the project config, which loads from the default ref. Absent until the
   * run's first job has staged its templates (about a minute in), and on runs
   * that recorded none. */
  templateCommits?: TemplateCommit[];
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
