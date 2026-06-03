import { Readable } from "node:stream";

import {
  driveFileNameForField,
  EMPLOYEE_DOCUMENT_FIELDS,
  type EmployeeDocumentField,
} from "@/lib/employee/documents";

import { formatDriveError, getDrive } from "./drive-auth";

const HRM_FOLDER_ID = process.env.GOOGLE_HRM_FOLDER_ID!;

const SHARED_DRIVE_OPTIONS = {
  supportsAllDrives: true,
} as const;

export type { EmployeeDocumentField };
export { EMPLOYEE_DOCUMENT_FIELDS };

export async function uploadFileToFolder(
  fileName: string,
  mimeType: string,
  buffer: Buffer,
  parentFolderId: string,
): Promise<string> {
  const drive = await getDrive();

  try {
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [parentFolderId],
      },
      media: {
        mimeType: mimeType || "application/octet-stream",
        body: Readable.from(buffer),
      },
      fields: "id, webViewLink",
      ...SHARED_DRIVE_OPTIONS,
    });

    const fileId = response.data.id;
    return (
      response.data.webViewLink ??
      (fileId ? `https://drive.google.com/file/d/${fileId}/view` : fileName)
    );
  } catch (error) {
    throw formatDriveError(error);
  }
}

export async function uploadBinaryFileToFolder(
  fileName: string,
  mimeType: string,
  buffer: Buffer,
  parentFolderId: string,
): Promise<{ fileId: string; fileName: string }> {
  const drive = await getDrive();
  try {
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [parentFolderId],
      },
      media: {
        mimeType: mimeType || "application/octet-stream",
        body: Readable.from(buffer),
      },
      fields: "id,name",
      ...SHARED_DRIVE_OPTIONS,
    });
    const fileId = response.data.id?.trim();
    if (!fileId) throw new Error("Drive upload succeeded but file id is missing");
    return { fileId, fileName: response.data.name ?? fileName };
  } catch (error) {
    throw formatDriveError(error);
  }
}

export async function uploadEmployeeDocuments(
  documentsFolderId: string,
  files: Partial<Record<EmployeeDocumentField, { name: string; type: string; buffer: Buffer }>>,
): Promise<Partial<Record<EmployeeDocumentField, string>>> {
  const links: Partial<Record<EmployeeDocumentField, string>> = {};

  for (const field of EMPLOYEE_DOCUMENT_FIELDS) {
    const file = files[field];
    if (!file) continue;

    links[field] = await uploadFileToFolder(
      driveFileNameForField(field, file.name, file.type),
      file.type,
      file.buffer,
      documentsFolderId,
    );
  }

  return links;
}

/** Root under {@link HRM_FOLDER_ID}: `HRM/Employees/{employeeId}_{name}/documents/`. */
const EMPLOYEES_ROOT_FOLDER_NAME = "Employees";

/** Previous root folder name; still resolved if present (rename in Drive or rely on lookup). */
const LEGACY_EMPLOYEES_ROOT_FOLDER_NAME = "documents";

export const createFolder = async (name: string, parentFolderId?: string) => {
  const drive = await getDrive();

  try {
    const response = await drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: parentFolderId ? [parentFolderId] : [HRM_FOLDER_ID],
      },
      fields: "id,name",
      ...SHARED_DRIVE_OPTIONS,
    });

    return response.data;
  } catch (error) {
    throw formatDriveError(error);
  }
};

async function findFolder(name: string, parentFolderId: string): Promise<string | null> {
  const drive = await getDrive();

  const query = [
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
    `name = '${name.replace(/'/g, "\\'")}'`,
    `'${parentFolderId}' in parents`,
  ].join(" and ");

  const list = await drive.files.list({
    q: query,
    fields: "files(id)",
    pageSize: 1,
    ...SHARED_DRIVE_OPTIONS,
  });

  return list.data.files?.[0]?.id ?? null;
}

async function getOrCreateFolder(name: string, parentFolderId: string): Promise<string> {
  try {
    const existingId = await findFolder(name, parentFolderId);
    if (existingId) return existingId;

    const created = await createFolder(name, parentFolderId);
    if (!created.id) {
      throw new Error(`Failed to create folder: ${name}`);
    }
    return created.id;
  } catch (error) {
    throw formatDriveError(error);
  }
}

/** Employees root: prefers `Employees`, falls back to legacy `documents` folder. */
async function getOrCreateEmployeesRootFolder(): Promise<string> {
  const preferred = await findFolder(EMPLOYEES_ROOT_FOLDER_NAME, HRM_FOLDER_ID);
  if (preferred) return preferred;

  const legacy = await findFolder(LEGACY_EMPLOYEES_ROOT_FOLDER_NAME, HRM_FOLDER_ID);
  if (legacy) return legacy;

  return getOrCreateFolder(EMPLOYEES_ROOT_FOLDER_NAME, HRM_FOLDER_ID);
}

export async function getParentFolderId(folderId: string): Promise<string | null> {
  const drive = await getDrive();
  const response = await drive.files.get({
    fileId: folderId,
    fields: "parents",
    supportsAllDrives: true,
  });
  return response.data.parents?.[0] ?? null;
}

export const createEmployeeFolderStructure = async (employeeId: string, employeeName: string) => {
  const documentsRootId = await getOrCreateEmployeesRootFolder();

  const employeeFolderName = `${employeeId}_${employeeName}`;
  const employeeFolderId = await getOrCreateFolder(employeeFolderName, documentsRootId);

  const documentsFolderId = await getOrCreateFolder("documents", employeeFolderId);

  return { employeeFolderId, documentsFolderId };
};

export async function getOrCreateSalarySlipsYearFolder(args: {
  employeeId: string;
  employeeName: string;
  year: number;
}): Promise<{ salarySlipsFolderId: string; yearFolderId: string }> {
  const { documentsFolderId } = await createEmployeeFolderStructure(
    args.employeeId,
    args.employeeName,
  );
  const salarySlipsFolderId = await getOrCreateFolder("salary_slips", documentsFolderId);
  const yearFolderId = await getOrCreateFolder(String(args.year), salarySlipsFolderId);
  return { salarySlipsFolderId, yearFolderId };
}

export async function downloadDriveFileBufferById(
  fileId: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const drive = await getDrive();
  try {
    const meta = await drive.files.get({
      fileId,
      fields: "mimeType",
      ...SHARED_DRIVE_OPTIONS,
    });
    const mimeType = meta.data.mimeType ?? "application/octet-stream";
    const response = await drive.files.get(
      {
        fileId,
        alt: "media",
        ...SHARED_DRIVE_OPTIONS,
      },
      { responseType: "arraybuffer" },
    );
    return { buffer: Buffer.from(response.data as ArrayBuffer), mimeType };
  } catch (error) {
    throw formatDriveError(error);
  }
}

export async function trashDriveFile(fileId: string): Promise<void> {
  const drive = await getDrive();
  try {
    await drive.files.update({
      fileId,
      requestBody: { trashed: true },
      ...SHARED_DRIVE_OPTIONS,
    });
  } catch (error) {
    throw formatDriveError(error);
  }
}
