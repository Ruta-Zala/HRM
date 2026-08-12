import { randomUUID } from "node:crypto";

import { COMPANY_HOLIDAYS_2026, type CompanyHoliday } from "@/lib/company-holidays";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { sheets } from "@/lib/google/auth";

const COLLECTION = "company_holidays";
const META_DOC = "_meta";

type HolidayDoc = CompanyHoliday & {
  createdAt: string;
  updatedAt: string;
};

let bootstrapPromise: Promise<void> | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function holidaysCollection() {
  return getAdminFirestore().collection(COLLECTION);
}

function normalizeHoliday(data: Partial<HolidayDoc>, fallbackId: string): CompanyHoliday | null {
  const id = String(data.id ?? fallbackId).trim();
  const date = String(data.date ?? "").trim();
  const name = String(data.name ?? "").trim();
  const type = String(data.type ?? "")
    .trim()
    .toLowerCase();

  if (!id || !date || !name) return null;
  if (type !== "leave" && type !== "celebration") return null;

  return { id, date, name, type: type as CompanyHoliday["type"] };
}

async function importFromSheetsOnce(): Promise<HolidayDoc[]> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID?.trim();
  if (!spreadsheetId) return [];

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'Company Holidays'!A2:F",
    });
    const rows = (response.data.values as string[][] | undefined) ?? [];
    const timestamp = nowIso();
    const imported: HolidayDoc[] = [];

    for (const row of rows) {
      const holiday = normalizeHoliday(
        {
          id: String(row[0] ?? "").trim(),
          date: String(row[1] ?? "").trim(),
          name: String(row[2] ?? "").trim(),
          type: String(row[3] ?? "")
            .trim()
            .toLowerCase() as CompanyHoliday["type"],
        },
        "",
      );
      if (!holiday) continue;
      imported.push({
        ...holiday,
        createdAt: String(row[4] ?? "").trim() || timestamp,
        updatedAt: String(row[5] ?? "").trim() || timestamp,
      });
    }

    return imported;
  } catch (error) {
    console.warn("[company-holidays/firestore] one-time Sheets import failed:", error);
    return [];
  }
}

async function seedDefaults(): Promise<HolidayDoc[]> {
  const timestamp = nowIso();
  return COMPANY_HOLIDAYS_2026.map((holiday) => ({
    ...holiday,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}

async function ensureBootstrapped(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    const metaRef = holidaysCollection().doc(META_DOC);
    const metaSnap = await metaRef.get();
    if (metaSnap.exists) return;

    const existing = await holidaysCollection().limit(2).get();
    const hasData = existing.docs.some((doc) => doc.id !== META_DOC);
    if (hasData) {
      await metaRef.set({ bootstrappedAt: nowIso(), source: "existing" }, { merge: true });
      return;
    }

    const imported = await importFromSheetsOnce();
    const seed = imported.length > 0 ? imported : await seedDefaults();
    const batch = getAdminFirestore().batch();

    for (const holiday of seed) {
      batch.set(holidaysCollection().doc(holiday.id), holiday);
    }
    batch.set(metaRef, {
      bootstrappedAt: nowIso(),
      source: imported.length > 0 ? "sheets" : "defaults",
      count: seed.length,
    });
    await batch.commit();
  })().finally(() => {
    bootstrapPromise = null;
  });

  return bootstrapPromise;
}

export async function listCompanyHolidaysFirestore(year?: number): Promise<CompanyHoliday[]> {
  await ensureBootstrapped();
  const snap = await holidaysCollection().get();
  return snap.docs
    .filter((doc) => doc.id !== META_DOC)
    .map((doc) => normalizeHoliday(doc.data() as Partial<HolidayDoc>, doc.id))
    .filter((holiday): holiday is CompanyHoliday => {
      if (!holiday) return false;
      return year == null || holiday.date.startsWith(`${year}-`);
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function createCompanyHolidayFirestore(input: {
  date: string;
  name: string;
  type: CompanyHoliday["type"];
}): Promise<CompanyHoliday> {
  await ensureBootstrapped();
  const timestamp = nowIso();
  const holiday: HolidayDoc = {
    id: randomUUID(),
    date: input.date,
    name: input.name,
    type: input.type,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await holidaysCollection().doc(holiday.id).set(holiday);
  return {
    id: holiday.id,
    date: holiday.date,
    name: holiday.name,
    type: holiday.type,
  };
}

export async function updateCompanyHolidayFirestore(
  input: CompanyHoliday,
): Promise<CompanyHoliday | null> {
  await ensureBootstrapped();
  const ref = holidaysCollection().doc(input.id);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const previous = snap.data() as Partial<HolidayDoc>;
  const updated: HolidayDoc = {
    id: input.id,
    date: input.date,
    name: input.name,
    type: input.type,
    createdAt: String(previous.createdAt ?? "").trim() || nowIso(),
    updatedAt: nowIso(),
  };
  await ref.set(updated);
  return {
    id: updated.id,
    date: updated.date,
    name: updated.name,
    type: updated.type,
  };
}

export async function deleteCompanyHolidayFirestore(id: string): Promise<boolean> {
  await ensureBootstrapped();
  const ref = holidaysCollection().doc(id);
  const snap = await ref.get();
  if (!snap.exists || id === META_DOC) return false;
  await ref.delete();
  return true;
}
