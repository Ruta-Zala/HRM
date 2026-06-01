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
const TOKEN_DIR = path.join(process.cwd(), ".data");
const TOKEN_FILE = path.join(TOKEN_DIR, "google-drive-oauth.json");

type StoredDriveTokens = {
  refresh_token?: string | null;
  access_token?: string | null;
  expiry_date?: number | null;
};

function getOAuthClientConfig() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ||
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/integrations/google-drive/callback`;

  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri };
}

export function createDriveOAuth2Client(): OAuth2Client | null {
  const config = getOAuthClientConfig();
  if (!config) return null;

  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}

export function getDriveOAuthConsentUrl(): string | null {
  const client = createDriveOAuth2Client();
  if (!client) return null;

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: DRIVE_AND_SHEETS_SCOPES,
  });
}

async function readStoredTokens(): Promise<StoredDriveTokens | null> {
  const envRefresh = process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim();
  if (envRefresh) return { refresh_token: envRefresh };

  try {
    const raw = await readFile(TOKEN_FILE, "utf8");
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

  const toSave: StoredDriveTokens = { ...tokens, refresh_token: refreshToken };

  await mkdir(TOKEN_DIR, { recursive: true });
  await writeFile(TOKEN_FILE, JSON.stringify(toSave, null, 2), "utf8");
}

export async function isDriveOAuthConnected(): Promise<boolean> {
  const stored = await readStoredTokens();
  return Boolean(stored?.refresh_token);
}

export function isDriveOAuthConfigured(): boolean {
  return Boolean(getOAuthClientConfig());
}

/**
 * Personal Gmail My Drive → OAuth user.
 * Google Workspace Shared Drive → service account (optional impersonation).
 */
export async function getDriveAuth(): Promise<
  OAuth2Client | ReturnType<typeof getServiceAccountDriveAuth>
> {
  const stored = await readStoredTokens();
  const oauth2 = createDriveOAuth2Client();

  if (stored?.refresh_token && oauth2) {
    oauth2.setCredentials(stored);
    return oauth2;
  }

  if (isDriveImpersonationEnabled()) {
    return getServiceAccountDriveAuth();
  }

  if (isDriveOAuthConfigured()) {
    throw new Error(
      "Connect your Gmail at Integrations → Google Drive. " +
        "Service accounts cannot upload files to personal My Drive.",
    );
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
        "Connect your Gmail at Integrations → Google Drive, " +
        "or move the HRM folder to a Workspace Shared Drive.",
    );
  }

  if (/permission|forbidden|403/i.test(message)) {
    return new Error(
      "Google permission denied. Open Integrations → Google Drive, disconnect, " +
        "then connect again (Drive + Sheets access). Ensure the HRM folder is shared " +
        "with the connected account.",
    );
  }

  return error instanceof Error ? error : new Error(message);
}
