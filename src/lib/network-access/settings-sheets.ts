import { randomUUID } from "node:crypto";

import { sheets } from "@/lib/google/auth";
import { applySheetHeaderFormatByTitle } from "@/lib/google/sheet-format";
import type { NetworkAccessSettings, RemoteAccessEmployee } from "@/lib/network-access/types";

const spreadsheetId = process.env.GOOGLE_SHEET_ID as string;

const SETTINGS_SHEET = "Network Settings";
const SETTINGS_RANGE = `'${SETTINGS_SHEET}'`;
const SETTINGS_HEADERS = ["key", "value"] as const;
const RESTRICTION_KEY = "restriction_enabled";

const REMOTE_SHEET = "Remote Access";
const REMOTE_RANGE = `'${REMOTE_SHEET}'`;
const REMOTE_HEADERS = [
  "id",
  "employeeSheetRow",
  "employeeId",
  "employeeName",
  "createdAt",
] as const;

let settingsReady = false;
let settingsRequest: Promise<void> | null = null;
let remoteReady = false;
let remoteRequest: Promise<void> | null = null;

let settingsCache: { at: number; settings: NetworkAccessSettings } | null = null;
let remoteCache: { at: number; employees: RemoteAccessEmployee[] } | null = null;
const CACHE_TTL_MS = 120_000;

function nowIso(): string {
  return new Date().toISOString();
}

function invalidateSettingsCache(): void {
  settingsCache = null;
}

function invalidateRemoteCache(): void {
  remoteCache = null;
}

async function ensureKeyValueSheet(title: string, headers: readonly string[]): Promise<void> {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });
  const exists = metadata.data.sheets?.some((sheet) => sheet.properties?.title === title);

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title } } }],
      },
    });
  }

  const range = `'${title}'`;
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${range}!1:1`,
  });
  const headerRow = (headerResponse.data.values?.[0] as string[] | undefined) ?? [];
  const headersMatch = headers.every(
    (header, index) => String(headerRow[index] ?? "").trim() === header,
  );

  if (!headersMatch) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${range}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [[...headers]] },
    });
    await applySheetHeaderFormatByTitle(spreadsheetId, title, headers.length);
  }
}

async function ensureSettingsSheet(): Promise<void> {
  if (settingsReady) return;
  if (settingsRequest) return settingsRequest;

  settingsRequest = (async () => {
    await ensureKeyValueSheet(SETTINGS_SHEET, SETTINGS_HEADERS);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SETTINGS_RANGE}!A2:B`,
    });
    const rows = (response.data.values as string[][] | undefined) ?? [];
    const hasKey = rows.some((row) => String(row[0] ?? "").trim() === RESTRICTION_KEY);
    if (!hasKey) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${SETTINGS_RANGE}!A:B`,
        valueInputOption: "RAW",
        requestBody: { values: [[RESTRICTION_KEY, "false"]] },
      });
    }

    settingsReady = true;
  })().finally(() => {
    settingsRequest = null;
  });

  return settingsRequest;
}

async function ensureRemoteSheet(): Promise<void> {
  if (remoteReady) return;
  if (remoteRequest) return remoteRequest;

  remoteRequest = (async () => {
    await ensureKeyValueSheet(REMOTE_SHEET, REMOTE_HEADERS);
    remoteReady = true;
  })().finally(() => {
    remoteRequest = null;
  });

  return remoteRequest;
}

async function getRemoteSheetId(): Promise<number> {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });
  const sheet = metadata.data.sheets?.find((s) => s.properties?.title === REMOTE_SHEET);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId == null) {
    throw new Error(`Sheet "${REMOTE_SHEET}" not found`);
  }
  return sheetId;
}

function parseEnabled(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

export async function getNetworkAccessSettings(): Promise<NetworkAccessSettings> {
  if (settingsCache && Date.now() - settingsCache.at < CACHE_TTL_MS) {
    return settingsCache.settings;
  }

  await ensureSettingsSheet();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SETTINGS_RANGE}!A2:B`,
  });
  const rows = (response.data.values as string[][] | undefined) ?? [];
  const enabledRow = rows.find((row) => String(row[0] ?? "").trim() === RESTRICTION_KEY);
  const settings: NetworkAccessSettings = {
    restrictionEnabled: parseEnabled(String(enabledRow?.[1] ?? "false")),
  };

  settingsCache = { at: Date.now(), settings };
  return settings;
}

export async function setNetworkRestrictionEnabled(
  enabled: boolean,
): Promise<NetworkAccessSettings> {
  await ensureSettingsSheet();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SETTINGS_RANGE}!A2:B`,
  });
  const rows = (response.data.values as string[][] | undefined) ?? [];
  const rowIndex = rows.findIndex((row) => String(row[0] ?? "").trim() === RESTRICTION_KEY);
  const value = enabled ? "true" : "false";

  if (rowIndex < 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SETTINGS_RANGE}!A:B`,
      valueInputOption: "RAW",
      requestBody: { values: [[RESTRICTION_KEY, value]] },
    });
  } else {
    const sheetRow = rowIndex + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SETTINGS_RANGE}!A${sheetRow}:B${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [[RESTRICTION_KEY, value]] },
    });
  }

  const settings: NetworkAccessSettings = { restrictionEnabled: enabled };
  settingsCache = { at: Date.now(), settings };
  return settings;
}

function rowToRemote(row: string[]): RemoteAccessEmployee | null {
  const id = String(row[0] ?? "").trim();
  const employeeSheetRow = Number(row[1] ?? 0);
  const employeeId = String(row[2] ?? "").trim();
  const employeeName = String(row[3] ?? "").trim();
  const createdAt = String(row[4] ?? "").trim();

  if (!id || !Number.isInteger(employeeSheetRow) || employeeSheetRow < 2 || !employeeName) {
    return null;
  }

  return { id, employeeSheetRow, employeeId, employeeName, createdAt };
}

export async function listRemoteAccessEmployees(): Promise<RemoteAccessEmployee[]> {
  if (remoteCache && Date.now() - remoteCache.at < CACHE_TTL_MS) {
    return remoteCache.employees;
  }

  await ensureRemoteSheet();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${REMOTE_RANGE}!A2:E`,
  });
  const rows = (response.data.values as string[][] | undefined) ?? [];
  const employees = rows
    .map(rowToRemote)
    .filter((row): row is RemoteAccessEmployee => Boolean(row))
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  remoteCache = { at: Date.now(), employees };
  return employees;
}

export async function addRemoteAccessEmployee(input: {
  employeeSheetRow: number;
  employeeId: string;
  employeeName: string;
}): Promise<RemoteAccessEmployee> {
  await ensureRemoteSheet();
  const existing = await listRemoteAccessEmployees();
  if (existing.some((row) => row.employeeSheetRow === input.employeeSheetRow)) {
    throw new Error("This employee is already allowed remote access");
  }

  const record: RemoteAccessEmployee = {
    id: randomUUID(),
    employeeSheetRow: input.employeeSheetRow,
    employeeId: input.employeeId.trim(),
    employeeName: input.employeeName.trim(),
    createdAt: nowIso(),
  };

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${REMOTE_RANGE}!A:E`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          record.id,
          String(record.employeeSheetRow),
          record.employeeId,
          record.employeeName,
          record.createdAt,
        ],
      ],
    },
  });

  invalidateRemoteCache();
  return record;
}

export async function removeRemoteAccessEmployee(id: string): Promise<boolean> {
  await ensureRemoteSheet();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${REMOTE_RANGE}!A2:E`,
  });
  const rows = (response.data.values as string[][] | undefined) ?? [];
  const rowIndex = rows.findIndex((row) => String(row[0] ?? "").trim() === id);
  if (rowIndex < 0) return false;

  const sheetId = await getRemoteSheetId();
  const sheetRow = rowIndex + 2;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: sheetRow - 1,
              endIndex: sheetRow,
            },
          },
        },
      ],
    },
  });

  invalidateRemoteCache();
  return true;
}

export function isEmployeeRemoteExempt(
  employees: RemoteAccessEmployee[],
  sheetRow: number | undefined,
  employeeId: string | undefined,
): boolean {
  if (sheetRow != null && employees.some((row) => row.employeeSheetRow === sheetRow)) {
    return true;
  }
  const id = employeeId?.trim();
  if (id && employees.some((row) => row.employeeId && row.employeeId === id)) {
    return true;
  }
  return false;
}

export function clearNetworkAccessCaches(): void {
  invalidateSettingsCache();
  invalidateRemoteCache();
}
