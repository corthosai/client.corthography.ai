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
}

export class PressApiError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly detail?: string;
  readonly requestId?: string;

  constructor(status: number, body: ApiErrorBody, message?: string) {
    super(message ?? `${body.error}${body.detail ? `: ${body.detail}` : ""}`);
    this.name = "PressApiError";
    this.status = status;
    this.errorCode = body.error;
    this.detail = body.detail ?? undefined;
    this.requestId = body.request_id ?? undefined;
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
