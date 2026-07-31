/**
 * User-facing copy for failed data loads. Never surface raw Google/API / JSON text.
 */
export const DATA_FETCH_ERROR_MESSAGE =
  "We are getting some issue while fetching data. Please refresh to get updated data.";

export const DATA_ACTION_ERROR_MESSAGE =
  "We are getting some issue while saving. Please try again.";

const TECHNICAL_ERROR_PATTERN =
  /quota exceeded|sheets\.googleapis|googleapis\.com|project_number:|read requests|write requests|rate limit|ECONNREFUSED|ENOTFOUND|fetch failed|network ?error|socket hang up|timeout|503|429|PERMISSION_DENIED|UNAUTHENTICATED|invalid_grant|unexpected end of json|json input|failed to execute ['"]?json['"]?|syntaxerror|invalid response|internal server error|bad gateway|service unavailable/i;

function asMessage(error: unknown): string {
  if (error instanceof Error) return error.message.trim();
  if (typeof error === "string") return error.trim();
  return "";
}

/** True when the message looks like a raw API / infrastructure error. */
export function isTechnicalApiErrorMessage(message: string): boolean {
  const text = message.trim();
  if (!text) return true;
  if (text.length > 120) return true;
  return TECHNICAL_ERROR_PATTERN.test(text);
}

/**
 * Sanitize errors for API JSON `message` fields.
 * Quota / Google / infra text → friendly refresh prompt; short app messages pass through.
 */
export function toApiErrorMessage(error: unknown, fallback: string): string {
  const raw = asMessage(error);
  if (!raw) return fallback;
  if (isTechnicalApiErrorMessage(raw)) return DATA_FETCH_ERROR_MESSAGE;
  return raw;
}

/**
 * Map load/fetch failures to a clear non-technical message.
 * Always uses the refresh prompt — never show raw API/JSON errors to users.
 */
export function toUserFacingFetchError(error?: unknown): string {
  void error;
  return DATA_FETCH_ERROR_MESSAGE;
}

/**
 * Map save/review/action failures to a clear non-technical message.
 * Passes through short app-authored messages (e.g. "Subject is required").
 * Sheets quota / read-limit failures use the fetch refresh prompt.
 */
export function toUserFacingActionError(error: unknown): string {
  const raw = asMessage(error);
  if (!raw || isTechnicalApiErrorMessage(raw)) {
    if (
      /quota exceeded|read requests|write requests|sheets\.googleapis|project_number:|rate limit/i.test(
        raw,
      )
    ) {
      return DATA_FETCH_ERROR_MESSAGE;
    }
    return DATA_ACTION_ERROR_MESSAGE;
  }
  return raw;
}
