import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

import {
  getServiceAccountDriveAuth,
  isDriveImpersonationEnabled,
  SPREADSHEETS_SCOPE,
} from "./auth";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const DRIVE_AND_SHEETS_SCOPES = [DRIVE_SCOPE, SPREADSHEETS_SCOPE];
function isVercelServerless(): boolean {
  return Boolean(process.env.VERCEL);
}

/** Vercel lambdas cannot write under /var/task; use /tmp (ephemeral) unless env token is set. */
function getTokenFilePath(): string {
  const dir = isVercelServerless()
    ? path.join("/tmp", "exhibyte-hrm")
    : path.join(process.cwd(), ".data");
  return path.join(dir, "google-drive-oauth.json");
}

type StoredDriveTokens = {
  refresh_token?: string | null;
  access_token?: string | null;
  expiry_date?: number | null;
};

const DRIVE_OAUTH_CALLBACK_PATH = "/api/integrations/google-drive/callback";

function normalizeAppOrigin(url: string | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/$/, "");
}

/**
 * OAuth redirect URI for the current request host (browser flow) or env (status/docs).
 * Request origin wins so a localhost value in Vercel env cannot break production Connect.
 */
export function getDriveOAuthRedirectUri(requestOrigin?: string): string {
  const fromRequest = normalizeAppOrigin(requestOrigin);
  if (fromRequest) return `${fromRequest}${DRIVE_OAUTH_CALLBACK_PATH}`;

  const explicit = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;

  const appOrigin = normalizeAppOrigin(process.env.NEXT_PUBLIC_APP_URL);
  if (appOrigin) return `${appOrigin}${DRIVE_OAUTH_CALLBACK_PATH}`;

  return "";
}

/** URIs from env to register in Google Cloud Console for this deployment. */
export function getDriveOAuthSetupRedirectUris(): string[] {
  const explicit = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  const appOrigin = normalizeAppOrigin(process.env.NEXT_PUBLIC_APP_URL);
  const fromAppUrl = appOrigin ? `${appOrigin}${DRIVE_OAUTH_CALLBACK_PATH}` : null;

  return [...new Set([explicit, fromAppUrl].filter((uri): uri is string => Boolean(uri)))];
}

function getOAuthClientConfig(redirectUri?: string) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const resolvedRedirect = redirectUri?.trim() || getDriveOAuthRedirectUri();

  if (!clientId || !clientSecret || !resolvedRedirect) return null;
  return { clientId, clientSecret, redirectUri: resolvedRedirect };
}

export function createDriveOAuth2Client(redirectUri?: string): OAuth2Client | null {
  const config = getOAuthClientConfig(redirectUri);
  if (!config) return null;

  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}

export function getDriveOAuthConsentUrl(redirectUri?: string): string | null {
  const client = createDriveOAuth2Client(redirectUri);
  if (!client) return null;

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: DRIVE_AND_SHEETS_SCOPES,
  });
}

export type DriveOAuthTokenPersistence = "env" | "file" | "ephemeral" | "none";

export function getDriveOAuthTokenPersistence(): DriveOAuthTokenPersistence {
  if (process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim()) return "env";
  const tokenFile = getTokenFilePath();
  if (existsSync(tokenFile)) return isVercelServerless() ? "ephemeral" : "file";
  return "none";
}

export function needsDriveOAuthRefreshTokenInEnv(): boolean {
  return isVercelServerless() && !process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim();
}

async function readStoredTokens(): Promise<StoredDriveTokens | null> {
  const envRefresh = process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim();
  if (envRefresh) return { refresh_token: envRefresh };

  try {
    const raw = await readFile(getTokenFilePath(), "utf8");
    const parsed = JSON.parse(raw) as StoredDriveTokens;
    return parsed.refresh_token ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveDriveOAuthTokens(tokens: StoredDriveTokens) {
  let refreshToken = tokens.refresh_token;

  if (!refreshToken) {
    const existing = await readStoredTokens();
    refreshToken = existing?.refresh_token ?? undefined;
  }

  if (!refreshToken) {
    throw new Error(
      "Google did not return a refresh token. Revoke app access at " +
        "https://myaccount.google.com/permissions then connect again.",
    );
  }

  if (process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim()) {
    return;
  }

  const toSave: StoredDriveTokens = { ...tokens, refresh_token: refreshToken };
  const tokenFile = getTokenFilePath();
  const tokenDir = path.dirname(tokenFile);

  try {
    await mkdir(tokenDir, { recursive: true });
    await writeFile(tokenFile, JSON.stringify(toSave, null, 2), "utf8");
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : "";
    if (isVercelServerless() || code === "ENOENT" || code === "EROFS") {
      throw new Error(
        "Cannot save Google tokens on Vercel disk. Connect locally (npm run dev), copy the " +
          "refresh_token from .data/google-drive-oauth.json into Vercel env as " +
          "GOOGLE_OAUTH_REFRESH_TOKEN, then redeploy.",
      );
    }
    throw error;
  }
}

export async function isDriveOAuthConnected(): Promise<boolean> {
  if (!shouldPreferOAuth()) return false;
  const stored = await readStoredTokens();
  return Boolean(stored?.refresh_token);
}

/** When false (default), Drive/Sheets APIs use the service account — not a stale local OAuth file. */
export function shouldPreferOAuth(): boolean {
  return process.env.GOOGLE_PREFER_OAUTH === "true";
}

/** Remove a revoked local OAuth token file (does not touch env GOOGLE_OAUTH_REFRESH_TOKEN). */
export async function clearStoredOAuthTokensIfNotFromEnv(): Promise<void> {
  if (process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim()) return;
  try {
    const tokenFile = getTokenFilePath();
    if (existsSync(tokenFile)) {
      await writeFile(tokenFile, "{}", "utf8");
    }
  } catch {
    // ignore
  }
}

export function isInvalidGrantError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const code = (error as { code?: string })?.code;
  const responseData = (error as { response?: { data?: { error?: string } } })?.response?.data
    ?.error;
  return (
    code === "invalid_grant" ||
    message.includes("invalid_grant") ||
    responseData === "invalid_grant"
  );
}

export function isDriveOAuthConfigured(): boolean {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  return Boolean(clientId && clientSecret);
}

/**
 * Personal Gmail My Drive → OAuth user.
 * Google Workspace Shared Drive → service account (optional impersonation).
 */
export async function getDriveAuth(): Promise<
  OAuth2Client | ReturnType<typeof getServiceAccountDriveAuth>
> {
  if (isDriveImpersonationEnabled()) {
    return getServiceAccountDriveAuth();
  }

  // Default: service account (Shared Drive). OAuth only when GOOGLE_PREFER_OAUTH=true.
  // Avoids invalid_grant from an old .data/google-drive-oauth.json breaking punch/attendance.
  if (shouldPreferOAuth()) {
    const stored = await readStoredTokens();
    const oauth2 = createDriveOAuth2Client();
    if (stored?.refresh_token && oauth2) {
      oauth2.setCredentials(stored);
      return oauth2;
    }
  }

  return getServiceAccountDriveAuth();
}

export async function getDrive() {
  const auth = await getDriveAuth();
  return google.drive({ version: "v3", auth });
}

/**
 * Same credentials as Drive (OAuth user or service account) so attendance
 * spreadsheets created in Shared Drive / My Drive remain accessible.
 */
export async function getSheetsAuth() {
  return getDriveAuth();
}

export async function getSheetsClient() {
  const auth = await getSheetsAuth();
  return google.sheets({ version: "v4", auth });
}

export function formatDriveError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error ?? "Unknown Drive error");

  if (message.includes("storage quota")) {
    return new Error(
      "Service accounts cannot upload to personal My Drive. " +
        "An HR admin can connect Google Drive once under Integrations, " +
        "or move the HRM folder to a Workspace Shared Drive.",
    );
  }

  if (/permission|forbidden|403/i.test(message)) {
    return new Error(
      "Google permission denied. An HR admin should open Integrations → Google Drive, " +
        "reconnect if needed, and ensure the HRM folder is shared with the connected account " +
        "or service account.",
    );
  }

  return error instanceof Error ? error : new Error(message);
}

/** User-facing API message — employees are never asked to connect Google themselves. */
export function formatGoogleApiClientMessage(
  error: unknown,
  options: { forHrAdmin?: boolean } = {},
): string {
  const message = formatDriveError(error).message;
  const forHrAdmin = options.forHrAdmin ?? false;

  if (/Connect your Gmail|Integrations → Google Drive/i.test(message)) {
    return forHrAdmin
      ? "Google integration is not connected. Connect Google Drive once under Integrations (HR setup)."
      : "This action is unavailable. Please contact HR — company Google setup is incomplete.";
  }

  if (message.includes("storage quota")) {
    return forHrAdmin
      ? message
      : "File storage is unavailable. Please contact HR to complete Google workspace setup.";
  }

  if (/permission|forbidden|403/i.test(message)) {
    return forHrAdmin
      ? message
      : "Google access is not configured for your account. Please contact HR.";
  }

  if (/invalid_grant/i.test(message)) {
    return forHrAdmin
      ? "Google Drive connection expired. Reconnect under Integrations → Google Drive, or unset GOOGLE_PREFER_OAUTH to use the service account."
      : "Please contact HR — company Google setup needs to be refreshed.";
  }

  return message;
}
