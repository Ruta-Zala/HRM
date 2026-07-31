import {
  DATA_ACTION_ERROR_MESSAGE,
  DATA_FETCH_ERROR_MESSAGE,
  toUserFacingActionError,
  toUserFacingFetchError,
} from "@/lib/api/user-facing-error";
import { parseJsonResponse } from "@/lib/api/json-response";

/**
 * Safely read JSON from a fetch Response.
 * Never throws the browser "Unexpected end of JSON input" error.
 */
export async function readResponseJson<T extends { success?: boolean; message?: string }>(
  res: Response,
  kind: "fetch" | "action" = "fetch",
): Promise<T> {
  const parsed = await parseJsonResponse<T>(res);
  if (parsed.invalid || parsed.empty || !parsed.data) {
    throw new Error(kind === "fetch" ? DATA_FETCH_ERROR_MESSAGE : DATA_ACTION_ERROR_MESSAGE);
  }
  return parsed.data;
}

export function assertApiSuccess<T extends { success?: boolean; message?: string }>(
  data: T,
  kind: "fetch" | "action" = "fetch",
): asserts data is T & { success: true } {
  if (!data.success) {
    throw new Error(
      kind === "fetch"
        ? toUserFacingFetchError(data.message)
        : toUserFacingActionError(data.message),
    );
  }
}
