import { isFirebaseDailyStorage } from "@/lib/storage/backend";

import type { CreateNotificationInput } from "../sheets";
import type { NotificationDto, NotificationRecord } from "../types";
import {
  createNotificationFirestore,
  createNotificationsFirestore,
  countUnreadNotificationsFirestore,
  listNotificationsForRecipientFirestore,
  markNotificationReadFirestore,
} from "./firestore";

export type { CreateNotificationInput };

export async function createNotification(
  input: CreateNotificationInput,
): Promise<NotificationRecord | null> {
  if (isFirebaseDailyStorage()) {
    return createNotificationFirestore(input);
  }
  const { createNotification: createSheets } = await import("../sheets");
  return createSheets(input);
}

export async function createNotifications(inputs: CreateNotificationInput[]): Promise<number> {
  if (isFirebaseDailyStorage()) {
    return createNotificationsFirestore(inputs);
  }
  const { createNotifications: createSheets } = await import("../sheets");
  return createSheets(inputs);
}

export async function listNotificationsForRecipient(
  recipientSheetRow: number,
): Promise<NotificationDto[]> {
  if (isFirebaseDailyStorage()) {
    return listNotificationsForRecipientFirestore(recipientSheetRow);
  }
  const { listNotificationsForRecipient: listSheets } = await import("../sheets");
  return listSheets(recipientSheetRow);
}

export async function markNotificationRead(params: {
  notificationId: string;
  recipientSheetRow: number;
}): Promise<boolean> {
  if (isFirebaseDailyStorage()) {
    return markNotificationReadFirestore(params);
  }
  const { markNotificationRead: markSheets } = await import("../sheets");
  return markSheets(params);
}

export async function countUnreadNotifications(recipientSheetRow: number): Promise<number> {
  if (isFirebaseDailyStorage()) {
    return countUnreadNotificationsFirestore(recipientSheetRow);
  }
  const { countUnreadNotifications: countSheets } = await import("../sheets");
  return countSheets(recipientSheetRow);
}
