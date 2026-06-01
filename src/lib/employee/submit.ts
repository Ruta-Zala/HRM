import { EMPLOYEE_DOCUMENT_FIELDS, type EmployeeDocumentField } from "./documents";

export type EmployeeSubmitPayload = {
  values: string[];
  sheetRow?: number;
  files: Partial<Record<EmployeeDocumentField, File>>;
};

export async function parseEmployeeSubmit(req: Request): Promise<EmployeeSubmitPayload> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const valuesRaw = formData.get("values");

    if (!valuesRaw) {
      throw new Error("Missing employee data");
    }

    const parsed = JSON.parse(String(valuesRaw)) as string[][];
    const values = parsed[0];

    if (!values?.length) {
      throw new Error("Missing employee data");
    }

    const sheetRowRaw = formData.get("sheetRow");
    const files: Partial<Record<EmployeeDocumentField, File>> = {};

    for (const field of EMPLOYEE_DOCUMENT_FIELDS) {
      const entry = formData.get(field);
      if (entry instanceof File && entry.size > 0) {
        files[field] = entry;
      }
    }

    return {
      values,
      sheetRow:
        sheetRowRaw != null && String(sheetRowRaw).trim() !== "" ? Number(sheetRowRaw) : undefined,
      files,
    };
  }

  const body = await req.json();
  const values = body.values?.[0] as string[] | undefined;

  if (!values?.length) {
    throw new Error("Missing employee data");
  }

  return {
    values,
    sheetRow: body.sheetRow != null ? Number(body.sheetRow) : undefined,
    files: {},
  };
}

export async function filesToUploadBuffers(
  files: Partial<Record<EmployeeDocumentField, File>>,
): Promise<Partial<Record<EmployeeDocumentField, { name: string; type: string; buffer: Buffer }>>> {
  const result: Partial<
    Record<EmployeeDocumentField, { name: string; type: string; buffer: Buffer }>
  > = {};

  for (const field of EMPLOYEE_DOCUMENT_FIELDS) {
    const file = files[field];
    if (!file) continue;

    result[field] = {
      name: file.name,
      type: file.type || "application/octet-stream",
      buffer: Buffer.from(await file.arrayBuffer()),
    };
  }

  return result;
}
