import type { CompanyHoliday } from "@/lib/company-holidays";
import { isFirebaseDailyStorage } from "@/lib/storage/backend";

import {
  createCompanyHolidayFirestore,
  deleteCompanyHolidayFirestore,
  listCompanyHolidaysFirestore,
  updateCompanyHolidayFirestore,
} from "./firestore";

/**
 * Company holidays for leave/attendance gates.
 * Firebase when DAILY_DATA_STORAGE=firebase; otherwise Google Sheets.
 */
export async function listCompanyHolidays(year?: number): Promise<CompanyHoliday[]> {
  if (isFirebaseDailyStorage()) {
    return listCompanyHolidaysFirestore(year);
  }
  const sheets = await import("@/lib/company-holiday-sheets");
  return sheets.listCompanyHolidays(year);
}

export async function createCompanyHoliday(input: {
  date: string;
  name: string;
  type: CompanyHoliday["type"];
}): Promise<CompanyHoliday> {
  if (isFirebaseDailyStorage()) {
    return createCompanyHolidayFirestore(input);
  }
  const sheets = await import("@/lib/company-holiday-sheets");
  return sheets.createCompanyHoliday(input);
}

export async function updateCompanyHoliday(input: CompanyHoliday): Promise<CompanyHoliday | null> {
  if (isFirebaseDailyStorage()) {
    return updateCompanyHolidayFirestore(input);
  }
  const sheets = await import("@/lib/company-holiday-sheets");
  return sheets.updateCompanyHoliday(input);
}

export async function deleteCompanyHoliday(id: string): Promise<boolean> {
  if (isFirebaseDailyStorage()) {
    return deleteCompanyHolidayFirestore(id);
  }
  const sheets = await import("@/lib/company-holiday-sheets");
  return sheets.deleteCompanyHoliday(id);
}
