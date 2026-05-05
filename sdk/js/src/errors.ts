/** Typed error hierarchy for the Corthography Press API.
 *
 * The API returns a uniform `ApiError` envelope (see api.corthography.ai
 * `src/models.py`); we map status codes to typed exceptions so callers can
 * branch cleanly on intent.
 */

export interface ApiErrorBody {
  error: string;
  detail?: string | null;
  request_id?: string | null;
  /** Optional context the SDK attaches for diagnosability. */
  url?: string;
  rawBody?: string;
}

export class PressApiError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly detail?: string;
  readonly requestId?: string;
  readonly url?: string;
  readonly rawBody?: string;

  constructor(status: number, body: ApiErrorBody, message?: string) {
    super(message ?? formatApiMessage(status, body));
    this.name = "PressApiError";
    this.status = status;
    this.errorCode = body.error;
    this.detail = body.detail ?? undefined;
    this.requestId = body.request_id ?? undefined;
    this.url = body.url ?? undefined;
    this.rawBody = body.rawBody ?? undefined;
  }
}

function formatApiMessage(status: number, body: ApiErrorBody): string {
  const head = body.url ? `HTTP ${status} from ${body.url}: ${body.error}` : `HTTP ${status}: ${body.error}`;
  const detail = body.detail ? ` — ${body.detail}` : "";
  const reqId = body.request_id ? ` [request_id=${body.request_id}]` : "";
  // Only show raw body if it adds information beyond the structured fields.
  const raw =
    body.rawBody && body.error === "UnknownError" && !body.detail
      ? ` — body: ${truncate(body.rawBody, 500)}`
      : "";
  return `${head}${detail}${reqId}${raw}`;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…[truncated, ${s.length - max} more chars]`;
}

/** Network-layer failure (DNS, connection refused, TLS, timeout) — no HTTP response. */
export class PressNetworkError extends Error {
  readonly url: string;
  readonly cause?: unknown;

  constructor(url: string, cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(`could not reach ${url}: ${reason}`);
    this.name = "PressNetworkError";
    this.url = url;
    this.cause = cause;
  }
}

/** 401: missing, malformed, unknown, or revoked bearer token. */
export class PressAuthError extends PressApiError {
  constructor(body: ApiErrorBody) {
    super(401, body);
    this.name = "PressAuthError";
  }
}

/** 403: token is valid but the caller is not authorized for this action/target/destination/environment. */
export class PressScopeError extends PressApiError {
  constructor(body: ApiErrorBody) {
    super(403, body);
    this.name = "PressScopeError";
  }
}

/** 404: run/project/template not found (or scoped away from this caller). */
export class PressNotFoundError extends PressApiError {
  constructor(body: ApiErrorBody) {
    super(404, body);
    this.name = "PressNotFoundError";
  }
}

/** 429: per-partner concurrent or daily quota exceeded. */
export class PressQuotaError extends PressApiError {
  constructor(body: ApiErrorBody) {
    super(429, body);
    this.name = "PressQuotaError";
  }
}

/** Pick the right subclass for a given status + body. */
export function makeApiError(status: number, body: ApiErrorBody): PressApiError {
  switch (status) {
    case 401:
      return new PressAuthError(body);
    case 403:
      return new PressScopeError(body);
    case 404:
      return new PressNotFoundError(body);
    case 429:
      return new PressQuotaError(body);
    default:
      return new PressApiError(status, body);
  }
}
