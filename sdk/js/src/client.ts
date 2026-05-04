import { makeApiError, PressApiError } from "./errors.js";
import type {
  ApproveRunRequest,
  ClientOptions,
  HealthResponse,
  ProjectListItem,
  RunSummary,
  StartRunRequest,
  StartRunResponse,
  TemplateListItem,
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.corthography.ai/v1";
const DEFAULT_TIMEOUT_MS = 30_000;

/** Typed wrapper around the api.corthography.ai REST API.
 *
 * Construct with at minimum `{ token }`. All methods return Promises that
 * resolve with parsed JSON bodies on 2xx, or reject with one of the typed
 * error subclasses (PressAuthError, PressScopeError, etc.) on 4xx/5xx.
 */
export class PressClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: ClientOptions) {
    if (!opts.token) {
      throw new Error("PressClient: `token` is required");
    }
    this.token = opts.token;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = opts.fetch ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  // ------------------------------------------------------------------ runs

  /** Start a new workflow run. Returns the run id; poll with `getRun` for status. */
  async startRun(req: StartRunRequest): Promise<StartRunResponse> {
    const body = await this.request<{ run_id: string; status: "queued" }>("POST", "/v1/runs", {
      body: {
        workflow: req.workflow,
        target: req.target,
        environment: req.environment ?? "test",
        template_ref: req.templateRef,
      },
    });
    return { runId: body.run_id, status: body.status };
  }

  async getRun(runId: string): Promise<RunSummary> {
    const body = await this.request<Record<string, unknown>>("GET", `/v1/runs/${encodeURIComponent(runId)}`);
    return toRunSummary(body);
  }

  async listRuns(opts?: { limit?: number; status?: string }): Promise<RunSummary[]> {
    const qs = new URLSearchParams();
    if (opts?.limit) qs.set("limit", String(opts.limit));
    if (opts?.status) qs.set("status", opts.status);
    const path = qs.toString() ? `/v1/runs?${qs}` : "/v1/runs";
    const body = await this.request<{ runs: Record<string, unknown>[] }>("GET", path);
    return body.runs.map(toRunSummary);
  }

  async getRunLogs(runId: string): Promise<{ logGroup: string; runId: string }> {
    const body = await this.request<{ log_group: string; run_id: string }>(
      "GET",
      `/v1/runs/${encodeURIComponent(runId)}/logs`,
    );
    return { logGroup: body.log_group, runId: body.run_id };
  }

  async approveRun(runId: string, req: ApproveRunRequest = {}): Promise<{ runId: string; decision: string }> {
    const body = await this.request<{ run_id: string; decision: string }>(
      "POST",
      `/v1/runs/${encodeURIComponent(runId)}/approve`,
      { body: { decision: req.decision ?? "approve", reason: req.reason } },
    );
    return { runId: body.run_id, decision: body.decision };
  }

  // ------------------------------------------------------------- discovery

  async listProjects(): Promise<ProjectListItem[]> {
    const body = await this.request<{ projects: Array<{ template_key: string; project_slugs: string[] }> }>(
      "GET",
      "/v1/projects",
    );
    return body.projects.map((p) => ({ templateKey: p.template_key, projectSlugs: p.project_slugs }));
  }

  async listTemplates(): Promise<TemplateListItem[]> {
    const body = await this.request<{ templates: Array<{ template_key: string }> }>(
      "GET",
      "/v1/templates",
    );
    return body.templates.map((t) => ({ templateKey: t.template_key }));
  }

  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("GET", "/v1/health", { unauthenticated: true });
  }

  // -------------------------------------------------------------- internal

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    opts: { body?: unknown; unauthenticated?: boolean } = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/v1") ? path.slice(3) : path}`;
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
    };
    if (!opts.unauthenticated) {
      headers.authorization = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const text = await response.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        // Non-JSON body; let it fall through.
      }
    }

    if (!response.ok) {
      const body =
        parsed && typeof parsed === "object"
          ? (parsed as { error?: string; detail?: string; request_id?: string })
          : { error: "UnknownError", detail: text };
      throw makeApiError(response.status, {
        error: body.error ?? "UnknownError",
        detail: body.detail ?? null,
        request_id: body.request_id ?? null,
      });
    }
    return parsed as T;
  }
}

// ---------------------------------------------------------------- helpers

function toRunSummary(raw: Record<string, unknown>): RunSummary {
  return {
    runId: String(raw.run_id ?? raw.runId ?? ""),
    partnerId: String(raw.partner_id ?? raw.partnerId ?? ""),
    workflow: raw.workflow as RunSummary["workflow"],
    target: String(raw.target ?? ""),
    environment: (raw.environment as RunSummary["environment"]) ?? "test",
    status: (raw.status as RunSummary["status"]) ?? "queued",
    currentPhase: (raw.current_phase as string | undefined) ?? undefined,
    startedAt: String(raw.started_at ?? raw.startedAt ?? ""),
    completedAt: (raw.completed_at as string | undefined) ?? undefined,
    sfnExecutionArn: (raw.sfn_execution_arn as string | undefined) ?? undefined,
    outputPaths: (raw.output_paths as Record<string, string> | undefined) ?? undefined,
    error: (raw.error as string | undefined) ?? undefined,
  };
}
