import { randomUUID } from "node:crypto";

import { sheets } from "@/lib/google/auth";
import { applySheetHeaderFormatByTitle } from "@/lib/google/sheet-format";
import { isValidIpv4, normalizeIp } from "@/lib/network-access/ip";
import type { OfficeNetwork } from "@/lib/network-access/types";

const spreadsheetId = process.env.GOOGLE_SHEET_ID as string;
const SHEET_NAME = "Office Networks";
const SHEET_RANGE = `'${SHEET_NAME}'`;

const HEADERS = ["id", "label", "ip", "createdAt", "updatedAt"] as const;

let sheetReady = false;
let sheetRequest: Promise<void> | null = null;
let allowlistCache: { at: number; networks: OfficeNetwork[] } | null = null;
const CACHE_TTL_MS = 120_000;

function nowIso(): string {
  return new Date().toISOString();
}

function invalidateCache(): void {
  allowlistCache = null;
}

function rowToNetwork(row: string[]): OfficeNetwork | null {
  const id = String(row[0] ?? "").trim();
  const label = String(row[1] ?? "").trim();
  const ip = normalizeIp(String(row[2] ?? ""));
  const createdAt = String(row[3] ?? "").trim();
  const updatedAt = String(row[4] ?? "").trim();

  if (!id || !label || !isValidIpv4(ip)) return null;
  return { id, label, ip, createdAt, updatedAt };
}

async function getSheetId(): Promise<number> {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });
  const sheet = metadata.data.sheets?.find((s) => s.properties?.title === SHEET_NAME);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId == null) {
    throw new Error(`Sheet "${SHEET_NAME}" not found`);
  }
  return sheetId;
}

async function ensureSheet(): Promise<void> {
  if (sheetReady) return;
  if (sheetRequest) return sheetRequest;

  sheetRequest = (async () => {
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties",
    });
    const exists = metadata.data.sheets?.some((sheet) => sheet.properties?.title === SHEET_NAME);

    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: SHEET_NAME } } }],
        },
      });
    }

    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_RANGE}!1:1`,
    });
    const headerRow = (headerResponse.data.values?.[0] as string[] | undefined) ?? [];
    const headersMatch = HEADERS.every(
      (header, index) => String(headerRow[index] ?? "").trim() === header,
    );

    if (!headersMatch) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_RANGE}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [[...HEADERS]] },
      });
      await applySheetHeaderFormatByTitle(spreadsheetId, SHEET_NAME, HEADERS.length);
    }

    sheetReady = true;
  })().finally(() => {
    sheetRequest = null;
  });

  return sheetRequest;
}

async function readRows(): Promise<string[][]> {
  await ensureSheet();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_RANGE}!A2:E`,
  });
  return (response.data.values as string[][] | undefined) ?? [];
}

export async function listOfficeNetworks(): Promise<OfficeNetwork[]> {
  if (allowlistCache && Date.now() - allowlistCache.at < CACHE_TTL_MS) {
    return allowlistCache.networks;
  }

  const rows = await readRows();
  const networks = rows
    .map(rowToNetwork)
    .filter((row): row is OfficeNetwork => Boolean(row))
    .sort((a, b) => a.label.localeCompare(b.label));

  allowlistCache = { at: Date.now(), networks };
  return networks;
}

export async function createOfficeNetwork(input: {
  label: string;
  ip: string;
}): Promise<OfficeNetwork> {
  await ensureSheet();
  const label = input.label.trim();
  const ip = normalizeIp(input.ip);
  if (!label || label.length > 80) {
    throw new Error("Label is required (max 80 characters)");
  }
  if (!isValidIpv4(ip)) {
    throw new Error("A valid IPv4 address is required");
  }

  const existing = await listOfficeNetworks();
  if (existing.some((row) => row.ip === ip)) {
    throw new Error("This IP is already in the allowlist");
  }

  const timestamp = nowIso();
  const network: OfficeNetwork = {
    id: randomUUID(),
    label,
    ip,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_RANGE}!A:E`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[network.id, network.label, network.ip, network.createdAt, network.updatedAt]],
    },
  });

  invalidateCache();
  return network;
}

export async function updateOfficeNetwork(input: {
  id: string;
  label: string;
  ip: string;
}): Promise<OfficeNetwork | null> {
  const rows = await readRows();
  const rowIndex = rows.findIndex((row) => String(row[0] ?? "").trim() === input.id);
  if (rowIndex < 0) return null;

  const label = input.label.trim();
  const ip = normalizeIp(input.ip);
  if (!label || label.length > 80) {
    throw new Error("Label is required (max 80 characters)");
  }
  if (!isValidIpv4(ip)) {
    throw new Error("A valid IPv4 address is required");
  }

  const networks = rows.map(rowToNetwork).filter((row): row is OfficeNetwork => Boolean(row));
  if (networks.some((row) => row.ip === ip && row.id !== input.id)) {
    throw new Error("This IP is already in the allowlist");
  }

  const existing = rows[rowIndex] ?? [];
  const updated: OfficeNetwork = {
    id: input.id,
    label,
    ip,
    createdAt: String(existing[3] ?? "").trim() || nowIso(),
    updatedAt: nowIso(),
  };

  const sheetRow = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_RANGE}!A${sheetRow}:E${sheetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[updated.id, updated.label, updated.ip, updated.createdAt, updated.updatedAt]],
    },
  });

  invalidateCache();
  return updated;
}

export async function deleteOfficeNetwork(id: string): Promise<boolean> {
  const rows = await readRows();
  const rowIndex = rows.findIndex((row) => String(row[0] ?? "").trim() === id);
  if (rowIndex < 0) return false;

  const sheetId = await getSheetId();
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

  invalidateCache();
  return true;
}

export function clearOfficeNetworksCache(): void {
  invalidateCache();
}
