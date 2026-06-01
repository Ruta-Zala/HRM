import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import type { SessionUser } from "@/types/auth";

import { isSessionUserActive } from "./account-status";
import { getSessionFromCookie } from "./server";

/** Optional route context (dynamic segments). */
export type ApiRouteContext = {
  params: Promise<Record<string, string>>;
};

export const ACCOUNT_INACTIVE_MESSAGE =
  "You cannot access this route. Your account is deactivated.";

export function inactiveAccountResponse() {
  return NextResponse.json(
    {
      success: false,
      message: ACCOUNT_INACTIVE_MESSAGE,
      code: "ACCOUNT_INACTIVE",
    },
    { status: 403 },
  );
}

export function unauthorizedResponse() {
  return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
}

/** Require a signed-in, Active employee before handling an API route. */
export async function requireActiveSession(): Promise<
  { ok: true; user: SessionUser } | { ok: false; response: NextResponse }
> {
  const user = await getSessionFromCookie();
  if (!user) {
    return { ok: false, response: unauthorizedResponse() };
  }

  if (!(await isSessionUserActive(user))) {
    return { ok: false, response: inactiveAccountResponse() };
  }

  return { ok: true, user };
}

type ActiveSessionHandler<TRequest extends Request = NextRequest, TContext = ApiRouteContext> = (
  request: TRequest,
  user: SessionUser,
  context: TContext,
) => Promise<Response>;

/**
 * Wraps an API route handler with active-session auth (signed in + Status Active).
 *
 * @example
 * export const GET = withActiveSession(async (req, user) => { ... });
 */
export function withActiveSession<
  TRequest extends Request = NextRequest,
  TContext = ApiRouteContext,
>(handler: ActiveSessionHandler<TRequest, TContext>) {
  return async (request: TRequest, context: TContext): Promise<Response> => {
    const auth = await requireActiveSession();
    if (!auth.ok) return auth.response;
    return handler(request, auth.user, context);
  };
}
