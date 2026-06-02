/** Parse a fetch Response body safely (never throws on empty or invalid JSON). */
export async function parseJsonResponse<T = Record<string, unknown>>(
  res: Response,
): Promise<{ data: T | null; empty: boolean; invalid: boolean }> {
  let text = "";
  try {
    text = await res.text();
  } catch {
    return { data: null, empty: true, invalid: false };
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return { data: null, empty: true, invalid: false };
  }

  try {
    return { data: JSON.parse(trimmed) as T, empty: false, invalid: false };
  } catch {
    return { data: null, empty: false, invalid: true };
  }
}

export function apiResponseErrorMessage(
  res: Response,
  parsed: { empty: boolean; invalid: boolean },
  fallback = "Request failed",
): string {
  if (parsed.invalid) {
    return "Server returned an invalid response. Please try again.";
  }
  if (parsed.empty) {
    if (res.status >= 500) {
      return "Server error. Check Google Sheets env vars and try again.";
    }
    if (!res.ok) {
      return fallback;
    }
    return fallback;
  }
  return fallback;
}
