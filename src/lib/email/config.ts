export type EmailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
  appUrl?: string;
};

const PLACEHOLDER_PATTERNS = [
  /^your-/i,
  /example\.com$/i,
  /password-or-app-password$/i,
  /changeme/i,
  /placeholder/i,
];

function looksLikePlaceholder(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function getEmailConfig(): EmailConfig | null {
  const issue = getEmailConfigIssue();
  if (issue) return null;

  const host = process.env.SMTP_HOST!.trim();
  const from = process.env.SMTP_FROM!.trim();
  const port = Number(process.env.SMTP_PORT?.trim() || "587");
  const secure = process.env.SMTP_SECURE?.trim() === "true" || port === 465;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  return {
    host,
    port,
    secure,
    user: user || undefined,
    pass: pass || undefined,
    from,
    appUrl: appUrl || undefined,
  };
}

export function getEmailConfigIssue(): string | null {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (!host || !from) {
    return "SMTP is not configured. Set SMTP_HOST and SMTP_FROM in .env.local.";
  }

  if (!user || !pass) {
    return "SMTP credentials missing. Set SMTP_USER and SMTP_PASS in .env.local.";
  }

  if (looksLikePlaceholder(user) || looksLikePlaceholder(pass)) {
    return "SMTP credentials still use placeholder values. Replace SMTP_USER and SMTP_PASS with real values.";
  }

  return null;
}

export function isEmailConfigured(): boolean {
  return getEmailConfigIssue() === null;
}
