/**
 * Daily multi-user flows (attendance, login, notifications, absence gate) use Firebase
 * when configured. Infrequent HR flows stay on Google Sheets.
 */
export function isFirebaseDailyStorage(): boolean {
  const daily = process.env.DAILY_DATA_STORAGE?.trim().toLowerCase();
  if (daily === "firebase") return true;
  if (daily === "sheets") return false;

  const attendance = process.env.ATTENDANCE_STORAGE?.trim().toLowerCase();
  if (attendance === "firebase") return true;
  if (attendance === "sheets") return false;

  return Boolean(process.env.FIREBASE_PROJECT_ID?.trim());
}
