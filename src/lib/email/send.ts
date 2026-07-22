import nodemailer from "nodemailer";

import { getEmailConfig, getEmailConfigIssue } from "@/lib/email/config";
import type { EmailDeliveryResult } from "@/lib/email/types";

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<EmailDeliveryResult> {
  const configIssue = getEmailConfigIssue();
  if (configIssue) {
    console.warn(`Email skipped: ${configIssue}`);
    return { sent: false, reason: configIssue };
  }

  const config = getEmailConfig();
  if (!config) {
    const reason = "Email configuration is invalid.";
    console.warn(`Email skipped: ${reason}`);
    return { sent: false, reason };
  }

  const to = input.to.trim();
  if (!to) {
    const reason = "Employee email address is missing.";
    console.warn(`Email skipped: ${reason}`);
    return { sent: false, reason };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user!,
        pass: config.pass!,
      },
    });

    await transporter.sendMail({
      from: config.from,
      to,
      subject: input.subject,
      text: input.text,
      html: input.html ?? input.text.replace(/\n/g, "<br />"),
    });

    console.info(`Email sent to ${to}: ${input.subject}`);
    return { sent: true, to };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error while sending email.";
    console.error(`Email failed for ${to}: ${reason}`);
    return { sent: false, reason, to };
  }
}
