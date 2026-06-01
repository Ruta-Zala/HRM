/** Client-side handling when APIs return ACCOUNT_INACTIVE. */

export class AccountInactiveRedirectError extends Error {
  readonly code = "ACCOUNT_INACTIVE_REDIRECT";

  constructor() {
    super("Redirecting to account inactive page");
    this.name = "AccountInactiveRedirectError";
  }
}

let redirectPending = false;

const SKIP_INACTIVE_CHECK = [
  "/api/auth/login",
  "/api/auth/me",
  "/api/auth/status",
  "/api/auth/logout",
];

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.pathname;
  return input.url;
}

function shouldSkipInactiveCheck(input: RequestInfo | URL): boolean {
  const url = requestUrl(input);
  return SKIP_INACTIVE_CHECK.some((path) => url.includes(path));
}

export function isAccountInactiveRedirectPending(): boolean {
  return redirectPending;
}

function matchesInactiveRedirectSignal(
  value: { name?: string; message?: string; code?: string } | null | undefined,
): boolean {
  if (!value) return false;
  return (
    value.code === "ACCOUNT_INACTIVE_REDIRECT" ||
    value.name === "AccountInactiveRedirectError" ||
    Boolean(value.message?.includes("ACCOUNT_INACTIVE_REDIRECT"))
  );
}

export function isAccountInactiveRedirectError(
  error: unknown,
): error is AccountInactiveRedirectError {
  if (error instanceof AccountInactiveRedirectError) return true;
  if (matchesInactiveRedirectSignal(error as { name?: string; message?: string; code?: string })) {
    return true;
  }
  return false;
}

export function redirectToAccountInactive(): void {
  if (typeof window === "undefined") return;
  if (redirectPending) return;

  const path = window.location.pathname;
  if (path.startsWith("/account-inactive") || path.startsWith("/login")) {
    return;
  }

  redirectPending = true;
  window.location.replace("/account-inactive");
}

export function resetAccountInactiveRedirect(): void {
  redirectPending = false;
}

/** If response is ACCOUNT_INACTIVE, redirect and throw (stops UI error states). */
export async function assertActiveApiResponse(res: Response): Promise<Response> {
  if (res.status !== 403) return res;

  let body: { code?: string } = {};
  try {
    body = (await res.clone().json()) as { code?: string };
  } catch {
    return res;
  }

  if (body.code === "ACCOUNT_INACTIVE") {
    redirectToAccountInactive();
    throw new AccountInactiveRedirectError();
  }

  return res;
}

/** Patched fetch: redirect on ACCOUNT_INACTIVE before callers handle errors. */
export function installInactiveAccountFetchGuard(): () => void {
  if (typeof window === "undefined") return () => {};

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (isAccountInactiveRedirectPending()) {
      throw new AccountInactiveRedirectError();
    }

    const res = await originalFetch(input, init);

    if (!shouldSkipInactiveCheck(input)) {
      await assertActiveApiResponse(res);
    }

    return res;
  };

  return () => {
    window.fetch = originalFetch;
  };
}
