import { sendEmail } from "@/lib/email/send";
import type { EmailDeliveryResult } from "@/lib/email/types";

const COMPANY = {
  name: "ExhiByte Solutions",
  tagline: "Human Resource Management",
  logoUrl:
    "https://exhibytesolution.com/wp-content/uploads/2023/06/cropped-Exhibyte_Logo_Black_Logo-removebg-preview-1.png",
  websiteUrl: "https://exhibytesolution.com",
  supportEmail: "hr@exhibytesolution.com",
  address: "364, Raj Imperia, Vraj Chowk, Vrajbhoomi Ground, Nana Varachha, Surat, Gujarat 395006",
} as const;

/** White mark for dark-mode clients (local asset when app URL is public, else CDN invert). */
function resolveLogoUrls(): { logoLight: string; logoDark: string } {
  const logoLight = COMPANY.logoUrl;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const canUseAppAsset = /^https:\/\//i.test(appUrl) && !/localhost|127\.0\.0\.1/i.test(appUrl);

  const logoDark = canUseAppAsset
    ? `${appUrl}/email/exhibyte-logo-white.png`
    : `https://wsrv.nl/?url=${encodeURIComponent(COMPANY.logoUrl)}&filt=negate`;

  return { logoLight, logoDark };
}

function formatLeaveTypeLabel(leaveType: string): string {
  const labels: Record<string, string> = {
    paid: "Paid",
    casual: "Casual",
    sick: "Sick",
    birthday: "Birthday",
    unpaid: "Unpaid",
  };
  return labels[leaveType] ?? leaveType;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildLeaveReviewedText(params: {
  employeeName: string;
  leaveTypeLabel: string;
  dateRange: string;
  status: "Accepted" | "Rejected";
  rejectReason?: string;
}): string {
  const isApproved = params.status === "Accepted";
  let body = isApproved
    ? `Hi ${params.employeeName},\n\nYour ${params.leaveTypeLabel} leave request for ${params.dateRange} has been approved.`
    : `Hi ${params.employeeName},\n\nYour ${params.leaveTypeLabel} leave request for ${params.dateRange} has been rejected.`;

  if (!isApproved && params.rejectReason?.trim()) {
    body += `\n\nReason: ${params.rejectReason.trim()}`;
  }

  body += `\n\nIf you have questions, reply to ${COMPANY.supportEmail} or visit ${COMPANY.websiteUrl}.`;
  body += `\n\n— ${COMPANY.name}\n${COMPANY.address}`;
  return body;
}

function buildLeaveReviewedHtml(params: {
  employeeName: string;
  leaveTypeLabel: string;
  dateRange: string;
  status: "Accepted" | "Rejected";
  rejectReason?: string;
}): string {
  const isApproved = params.status === "Accepted";
  const statusLabel = isApproved ? "Approved" : "Rejected";
  const statusColor = isApproved ? "#15803d" : "#b91c1c";
  const statusBg = isApproved ? "#dcfce7" : "#fee2e2";
  const accent = isApproved ? "#16a34a" : "#dc2626";

  const name = escapeHtml(params.employeeName);
  const leaveLabel = escapeHtml(params.leaveTypeLabel);
  const dateRange = escapeHtml(params.dateRange);
  const dateFieldLabel = params.dateRange.includes(" - ") ? "Dates" : "Date";
  const reason = escapeHtml(params.rejectReason?.trim() || "");
  const companyName = escapeHtml(COMPANY.name);
  const tagline = escapeHtml(COMPANY.tagline);
  const address = escapeHtml(COMPANY.address);
  const supportEmail = escapeHtml(COMPANY.supportEmail);
  const websiteUrl = escapeHtml(COMPANY.websiteUrl);
  const { logoLight } = resolveLogoUrls();
  const logoLightUrl = escapeHtml(logoLight);
  const subject = isApproved ? "Your leave is approved" : "Your leave is rejected";

  const reasonBlock =
    !isApproved && reason
      ? `<tr>
          <td style="padding:0 32px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;">
              <tr>
                <td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#9a3412;">
                  <strong style="display:block;margin-bottom:4px;">Reason</strong>
                  ${reason}
                </td>
              </tr>
            </table>
          </td>
        </tr>`
      : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(subject)}</title>
  <style type="text/css">
    :root { color-scheme: light only; supported-color-schemes: light; }
    [data-ogsc] .logo-plate { background-color: #ffffff !important; }
  </style>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f3f4f6" style="background:#f3f4f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td align="center" bgcolor="#ffffff" style="padding:28px 32px 18px;text-align:center;background-color:#ffffff;border-bottom:1px solid #eef2f7;">
              <!-- Logo sits on an opaque white plate so the black mark stays visible in dark-mode clients -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="logo-plate" bgcolor="#ffffff" style="margin:0 auto;background-color:#ffffff;border-radius:12px;">
                <tr>
                  <td align="center" bgcolor="#ffffff" style="padding:14px 20px;background-color:#ffffff;">
                    <img src="${logoLightUrl}" alt="${companyName}" width="180" height="auto" style="display:block;max-width:180px;width:180px;height:auto;border:0;outline:none;text-decoration:none;background-color:#ffffff;" />
                  </td>
                </tr>
              </table>
              <div style="margin-top:10px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:#64748b;">
                ${tagline}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;font-family:Arial,Helvetica,sans-serif;">
              <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:${statusBg};color:${statusColor};font-size:12px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;">
                Leave ${statusLabel}
              </div>
              <h1 style="margin:16px 0 0;font-size:22px;line-height:1.3;color:#0f172a;font-weight:700;">
                ${isApproved ? "Your leave request was approved" : "Your leave request was rejected"}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 32px 8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#334155;">
              Hi ${name},
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#334155;">
              Your <strong>${leaveLabel}</strong> leave request for <strong>${dateRange}</strong> has been
              <strong style="color:${accent};">${statusLabel.toLowerCase()}</strong>.
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
                <tr>
                  <td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#64748b;width:40%;">Leave type</td>
                  <td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;font-weight:600;">${leaveLabel}</td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#64748b;border-top:1px solid #e2e8f0;">${dateFieldLabel}</td>
                  <td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;font-weight:600;border-top:1px solid #e2e8f0;">${dateRange}</td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#64748b;border-top:1px solid #e2e8f0;">Status</td>
                  <td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${statusColor};font-weight:700;border-top:1px solid #e2e8f0;">${statusLabel}</td>
                </tr>
              </table>
            </td>
          </tr>
          ${reasonBlock}
          <tr>
            <td style="padding:4px 32px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#475569;">
              You can review leave updates anytime in
              <strong style="color:#0f172a;">ExhiByte HRM</strong>.
              For help, email
              <a href="mailto:${supportEmail}" style="color:#0f766e;text-decoration:none;font-weight:600;">${supportEmail}</a>.
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#0f172a;font-family:Arial,Helvetica,sans-serif;color:#cbd5e1;">
              <div style="font-size:14px;font-weight:700;color:#ffffff;">${companyName}</div>
              <div style="margin-top:8px;font-size:12px;line-height:1.55;">${address}</div>
              <div style="margin-top:8px;font-size:12px;line-height:1.55;">
                <a href="mailto:${supportEmail}" style="color:#5eead4;text-decoration:none;">${supportEmail}</a>
                &nbsp;·&nbsp;
                <a href="${websiteUrl}" style="color:#5eead4;text-decoration:none;">${websiteUrl.replace(/^https?:\/\//, "")}</a>
              </div>
            </td>
          </tr>
        </table>
        <div style="max-width:560px;margin:14px auto 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#94a3b8;text-align:center;">
          This is an automated message from ${companyName} HRM. Please do not reply with sensitive credentials.
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendLeaveReviewedEmail(params: {
  to: string;
  employeeName: string;
  leaveType: string;
  dateRange: string;
  status: "Accepted" | "Rejected";
  rejectReason?: string;
}): Promise<EmailDeliveryResult> {
  const leaveTypeLabel = formatLeaveTypeLabel(params.leaveType);
  const content = {
    employeeName: params.employeeName,
    leaveTypeLabel,
    dateRange: params.dateRange,
    status: params.status,
    rejectReason: params.rejectReason,
  };

  return sendEmail({
    to: params.to,
    subject: params.status === "Accepted" ? "Your leave is approved" : "Your leave is rejected",
    text: buildLeaveReviewedText(content),
    html: buildLeaveReviewedHtml(content),
  });
}
