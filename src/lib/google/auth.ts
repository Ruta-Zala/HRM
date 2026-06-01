import { google } from "googleapis";

const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_DRIVE_IMPERSONATE_USER = process.env.GOOGLE_DRIVE_IMPERSONATE_USER?.trim();

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
export const SPREADSHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const SCOPES = [DRIVE_SCOPE, SPREADSHEETS_SCOPE];

if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
  throw new Error("Missing Google service account environment variables");
}

const googleAuth = new google.auth.GoogleAuth({
  credentials: {
    client_email: GOOGLE_CLIENT_EMAIL,
    private_key: GOOGLE_PRIVATE_KEY,
  },
  scopes: SCOPES,
});

/** Service account Drive auth (Shared Drive or Workspace impersonation). */
export function getServiceAccountDriveAuth() {
  if (GOOGLE_DRIVE_IMPERSONATE_USER) {
    return new google.auth.JWT({
      email: GOOGLE_CLIENT_EMAIL,
      key: GOOGLE_PRIVATE_KEY,
      scopes: SCOPES,
      subject: GOOGLE_DRIVE_IMPERSONATE_USER,
    });
  }

  return googleAuth;
}

export const sheets = google.sheets({
  version: "v4",
  auth: googleAuth,
});

export function isDriveImpersonationEnabled(): boolean {
  return Boolean(GOOGLE_DRIVE_IMPERSONATE_USER);
}
