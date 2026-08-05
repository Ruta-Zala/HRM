import { getSheetHeaders } from "@/lib/employee";
import { EMPLOYEE_SHEET_RANGE, readSheet } from "@/lib/google/sheets";
import { getAdminFirestore } from "@/lib/firebase/admin";

const EMPLOYEES_COLLECTION = "employees";
const META_DOC_ID = "meta";

export type EmployeeRowRecord = {
  sheetRow: number;
  headers: string[];
  row: string[];
};

let bootstrapPromise: Promise<void> | null = null;

function employeesCollection() {
  return getAdminFirestore().collection(EMPLOYEES_COLLECTION);
}

async function ensureEmployeesBootstrapped(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    const db = getAdminFirestore();
    const metaSnap = await db.collection(EMPLOYEES_COLLECTION).doc(META_DOC_ID).get();
    if (metaSnap.exists) return;

    const raw = await readSheet(EMPLOYEE_SHEET_RANGE);
    if (raw.length < 2) {
      await db
        .collection(EMPLOYEES_COLLECTION)
        .doc(META_DOC_ID)
        .set({ headers: getSheetHeaders(raw) });
      return;
    }

    const headers = getSheetHeaders(raw);
    const batch = db.batch();
    batch.set(db.collection(EMPLOYEES_COLLECTION).doc(META_DOC_ID), { headers });

    for (let index = 1; index < raw.length; index++) {
      const sheetRow = index + 1;
      const row = raw[index] ?? [];
      batch.set(db.collection(EMPLOYEES_COLLECTION).doc(String(sheetRow)), {
        sheetRow,
        row,
      });
    }

    await batch.commit();
    console.info("[firebase] bootstrapped employees from Google Sheets");
  })().finally(() => {
    bootstrapPromise = null;
  });

  return bootstrapPromise;
}

async function getHeaders(): Promise<string[]> {
  await ensureEmployeesBootstrapped();
  const snap = await employeesCollection().doc(META_DOC_ID).get();
  const headers = (snap.data()?.headers as string[] | undefined) ?? [];
  return headers;
}

export async function getEmployeeBySheetRow(sheetRow: number): Promise<EmployeeRowRecord | null> {
  if (sheetRow < 2) return null;
  await ensureEmployeesBootstrapped();
  const snap = await employeesCollection().doc(String(sheetRow)).get();
  if (!snap.exists) return null;
  const data = snap.data() as { row?: string[] };
  const headers = await getHeaders();
  return {
    sheetRow,
    headers,
    row: (data.row as string[]) ?? [],
  };
}

export async function findEmployeeByLogin(login: string): Promise<EmployeeRowRecord | null> {
  const loginNorm = login.trim().toLowerCase();
  if (!loginNorm) return null;

  await ensureEmployeesBootstrapped();
  const headers = await getHeaders();
  const snap = await employeesCollection().get();

  for (const doc of snap.docs) {
    if (doc.id === META_DOC_ID) continue;
    const sheetRow = Number(doc.id);
    if (!Number.isFinite(sheetRow) || sheetRow < 2) continue;
    const row = (doc.data().row as string[]) ?? [];
    const { sheetRowToForm } = await import("@/lib/employee");
    const form = sheetRowToForm(headers, row);
    const email = form.email.trim().toLowerCase();
    const username = form.username.trim().toLowerCase();
    if (email === loginNorm || (username && username === loginNorm)) {
      return { sheetRow, headers, row };
    }
  }

  return null;
}

export async function updateEmployeeRow(sheetRow: number, row: string[]): Promise<void> {
  await employeesCollection().doc(String(sheetRow)).set({ sheetRow, row }, { merge: true });
}

export async function listAllEmployeeRows(): Promise<EmployeeRowRecord[]> {
  await ensureEmployeesBootstrapped();
  const headers = await getHeaders();
  const snap = await employeesCollection().get();
  const records: EmployeeRowRecord[] = [];

  for (const doc of snap.docs) {
    if (doc.id === META_DOC_ID) continue;
    const sheetRow = Number(doc.id);
    if (!Number.isFinite(sheetRow) || sheetRow < 2) continue;
    records.push({
      sheetRow,
      headers,
      row: (doc.data().row as string[]) ?? [],
    });
  }

  return records.sort((a, b) => a.sheetRow - b.sheetRow);
}
