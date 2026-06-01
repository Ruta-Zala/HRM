/** Client-safe document field names (no Google APIs). */

export const EMPLOYEE_DOCUMENT_FIELDS = [
  "pancard",
  "aadharCard",
  "marksheet",
  "profileImage",
] as const;

export type EmployeeDocumentField = (typeof EMPLOYEE_DOCUMENT_FIELDS)[number];

/** Base filename on Google Drive (without extension). */
export const EMPLOYEE_DOCUMENT_DRIVE_NAMES: Record<EmployeeDocumentField, string> = {
  pancard: "pancard",
  aadharCard: "aadhar",
  marksheet: "marksheet",
  profileImage: "profileImage",
};

function extensionFromUpload(originalName: string, mimeType: string): string {
  const match = originalName.match(/\.[^.]+$/i);
  if (match) return match[0].toLowerCase();

  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return ".jpg";
  if (mimeType === "image/webp") return ".webp";

  return "";
}

/** e.g. aadharCard + "photo.jpg" → "aadhar.jpg" */
export function driveFileNameForField(
  field: EmployeeDocumentField,
  originalName: string,
  mimeType: string,
): string {
  const base = EMPLOYEE_DOCUMENT_DRIVE_NAMES[field];
  const ext = extensionFromUpload(originalName, mimeType);
  return `${base}${ext}`;
}

export function isGoogleDriveFileUrl(value: string): boolean {
  return /^https?:\/\/(?:drive\.google\.com|docs\.google\.com)\//i.test(value.trim());
}

/** Extract Google Drive file id from view/share links. */
export function parseGoogleDriveFileId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match =
    trimmed.match(/\/file\/d\/([\w-]+)/i) ||
    trimmed.match(/[?&]id=([\w-]+)/i) ||
    trimmed.match(/\/d\/([\w-]+)/i);

  return match?.[1] ?? null;
}

export function getDriveFileProxyUrl(fileId: string): string {
  return `/api/employee/drive-file?fileId=${encodeURIComponent(fileId)}`;
}

/** Image src for profile preview (Drive proxy, blob preview, or direct URL). */
export function resolveProfileImageSrc(
  storedValue: string,
  localPreviewUrl?: string | null,
): string | null {
  if (localPreviewUrl) return localPreviewUrl;

  const trimmed = storedValue.trim();
  if (!trimmed) return null;

  const fileId = parseGoogleDriveFileId(trimmed);
  if (fileId) return getDriveFileProxyUrl(fileId);

  if (
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:image/")
  ) {
    return trimmed;
  }

  return null;
}

/** Show a short document label instead of a stored Drive URL. */
export function getDocumentDisplayName(field: EmployeeDocumentField, storedValue: string): string {
  const trimmed = storedValue.trim();
  if (!trimmed) return "";

  if (isGoogleDriveFileUrl(trimmed)) {
    return EMPLOYEE_DOCUMENT_DRIVE_NAMES[field];
  }

  return trimmed;
}

/** Open URL for a stored document (Drive proxy or direct http(s) link). */
export function getDocumentHref(storedValue: string): string | null {
  const trimmed = storedValue.trim();
  if (!trimmed) return null;

  const fileId = parseGoogleDriveFileId(trimmed);
  if (fileId) return getDriveFileProxyUrl(fileId);

  if (isGoogleDriveFileUrl(trimmed)) return null;

  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  return null;
}
