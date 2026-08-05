import { randomUUID } from "node:crypto";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { sheets } from "@/lib/google/auth";
import { NOTIFICATIONS_SHEET_NAME } from "@/lib/notifications/types";

import {
  effectiveNotificationExpiresAt,
  isNotificationExpired,
  notificationTodayIso,
  rowToNotificationRecord,
} from "../record-utils";
import type { CreateNotificationInput } from "../sheets";
import type { NotificationDto, NotificationRecord } from "../types";

const COLLECTION = "notifications";
const META_DOC = "meta";

let bootstrapPromise: Promise<void> | null = null;

async function ensureNotificationsBootstrapped(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    const db = getAdminFirestore();
    const metaSnap = await db.collection(COLLECTION).doc(META_DOC).get();
    if (metaSnap.exists) return;

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      await db.collection(COLLECTION).doc(META_DOC).set({ bootstrapped: true, source: "empty" });
      return;
    }

    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${NOTIFICATIONS_SHEET_NAME}!A2:K10000`,
      });
      const rows = (response.data.values as string[][]) ?? [];
      if (rows.length === 0) {
        await db.collection(COLLECTION).doc(META_DOC).set({ bootstrapped: true, source: "empty" });
        return;
      }

      const batch = db.batch();
      batch.set(db.collection(COLLECTION).doc(META_DOC), { bootstrapped: true, source: "sheets" });

      for (const row of rows) {
        const record = rowToNotificationRecord(row);
        if (!record) continue;
        batch.set(db.collection(COLLECTION).doc(record.id), { ...record });
      }

      await batch.commit();
      console.info("[firebase] bootstrapped notifications from Google Sheets");
    } catch (error) {
      console.error("[firebase] notifications bootstrap failed:", error);
      await db.collection(COLLECTION).doc(META_DOC).set({ bootstrapped: true, source: "failed" });
    }
  })().finally(() => {
    bootstrapPromise = null;
  });

  return bootstrapPromise;
}

async function listAllRecords(): Promise<NotificationRecord[]> {
  await ensureNotificationsBootstrapped();
  const snap = await getAdminFirestore().collection(COLLECTION).get();
  return snap.docs.map((doc) => doc.data() as NotificationRecord);
}

async function deleteExpiredRecords(records: NotificationRecord[]): Promise<void> {
  const todayIso = notificationTodayIso();
  const expired = records.filter((record) => isNotificationExpired(record, todayIso));
  if (expired.length === 0) return;

  const batch = getAdminFirestore().batch();
  for (const record of expired) {
    batch.delete(getAdminFirestore().collection(COLLECTION).doc(record.id));
  }
  await batch.commit();
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function createNotificationFirestore(
  input: CreateNotificationInput,
): Promise<NotificationRecord | null> {
  await ensureNotificationsBootstrapped();

  const dedupeKey = String(input.dedupeKey ?? "").trim();
  if (dedupeKey) {
    const existing = await listAllRecords();
    for (const record of existing) {
      if (record.dedupeKey === dedupeKey && record.recipientSheetRow === input.recipientSheetRow) {
        return null;
      }
    }
  }

  const record: NotificationRecord = {
    id: randomUUID(),
    recipientSheetRow: input.recipientSheetRow,
    recipientEmployeeId: input.recipientEmployeeId,
    type: input.type,
    title: input.title,
    body: input.body,
    href: input.href ?? "",
    read: false,
    createdAt: nowIso(),
    dedupeKey,
    expiresAt: String(input.expiresAt ?? "").trim(),
  };

  await getAdminFirestore().collection(COLLECTION).doc(record.id).set(record);
  return record;
}

export async function createNotificationsFirestore(
  inputs: CreateNotificationInput[],
): Promise<number> {
  if (inputs.length === 0) return 0;

  await ensureNotificationsBootstrapped();
  const existingKeys = new Set<string>();

  if (inputs.some((input) => String(input.dedupeKey ?? "").trim())) {
    const existing = await listAllRecords();
    for (const record of existing) {
      if (!record.dedupeKey) continue;
      existingKeys.add(`${record.recipientSheetRow}:${record.dedupeKey}`);
    }
  }

  const records: NotificationRecord[] = [];
  for (const input of inputs) {
    const dedupeKey = String(input.dedupeKey ?? "").trim();
    const uniqueKey = `${input.recipientSheetRow}:${dedupeKey}`;
    if (dedupeKey && existingKeys.has(uniqueKey)) continue;

    records.push({
      id: randomUUID(),
      recipientSheetRow: input.recipientSheetRow,
      recipientEmployeeId: input.recipientEmployeeId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href ?? "",
      read: false,
      createdAt: nowIso(),
      dedupeKey,
      expiresAt: String(input.expiresAt ?? "").trim(),
    });
    if (dedupeKey) existingKeys.add(uniqueKey);
  }

  if (records.length === 0) return 0;

  const batch = getAdminFirestore().batch();
  for (const record of records) {
    batch.set(getAdminFirestore().collection(COLLECTION).doc(record.id), record);
  }
  await batch.commit();

  return records.length;
}

export async function listNotificationsForRecipientFirestore(
  recipientSheetRow: number,
): Promise<NotificationDto[]> {
  const records = await listAllRecords();
  await deleteExpiredRecords(records);

  const fresh = await listAllRecords();
  const notifications: NotificationDto[] = [];

  for (const record of fresh) {
    if (record.recipientSheetRow !== recipientSheetRow) continue;
    notifications.push({
      ...record,
      expiresAt: effectiveNotificationExpiresAt(record),
      sheetRow: 0,
    });
  }

  return notifications.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function markNotificationReadFirestore(params: {
  notificationId: string;
  recipientSheetRow: number;
}): Promise<boolean> {
  const docRef = getAdminFirestore().collection(COLLECTION).doc(params.notificationId);
  const snap = await docRef.get();
  if (!snap.exists) return false;

  const record = snap.data() as NotificationRecord;
  if (record.recipientSheetRow !== params.recipientSheetRow) return false;

  await docRef.set({ ...record, read: true }, { merge: true });
  return true;
}

export async function countUnreadNotificationsFirestore(
  recipientSheetRow: number,
): Promise<number> {
  const notifications = await listNotificationsForRecipientFirestore(recipientSheetRow);
  return notifications.filter((n) => !n.read).length;
}
