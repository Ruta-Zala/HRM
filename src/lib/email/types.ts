export type EmailDeliveryResult =
  { sent: true; to: string } | { sent: false; reason: string; to?: string };
