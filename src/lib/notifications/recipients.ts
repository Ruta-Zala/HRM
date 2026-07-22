import { ROLES, STATUS } from "@/app/consts/common";
import {
  getEmployeeIdFromRow,
  getSheetHeaders,
  headerToFormKey,
  isEmployeeStatusActive,
  sheetRowToForm,
} from "@/lib/employee";
import { EMPLOYEE_SHEET_RANGE, readSheet } from "@/lib/google/sheets";

export type NotificationRecipient = {
  sheetRow: number;
  employeeId: string;
  name: string;
  role: string;
  birthdayDate: string;
  joiningDate: string;
  lastIncrementDate: string;
};

const ACTIVE_EMPLOYEES_CACHE_MS = 60 * 1000;
let activeEmployeesCache: {
  value: NotificationRecipient[];
  loadedAt: number;
} | null = null;
let activeEmployeesRequest: Promise<NotificationRecipient[]> | null = null;

export async function listActiveEmployees(): Promise<NotificationRecipient[]> {
  if (
    activeEmployeesCache &&
    Date.now() - activeEmployeesCache.loadedAt < ACTIVE_EMPLOYEES_CACHE_MS
  ) {
    return activeEmployeesCache.value;
  }
  if (activeEmployeesRequest) return activeEmployeesRequest;

  activeEmployeesRequest = (async () => {
    const raw = await readSheet(EMPLOYEE_SHEET_RANGE);
    const headers = getSheetHeaders(raw);
    const statusColIndex = headers.findIndex((h) => headerToFormKey(h) === "status");
    const recipients: NotificationRecipient[] = [];

    for (let i = 1; i < raw.length; i++) {
      const row = raw[i] ?? [];
      const sheetRow = i + 1;
      const status = statusColIndex >= 0 ? String(row[statusColIndex] ?? "") : STATUS.ACTIVE;
      if (!isEmployeeStatusActive(status)) continue;

      const form = sheetRowToForm(headers, row);
      recipients.push({
        sheetRow,
        employeeId: getEmployeeIdFromRow(headers, row, sheetRow),
        name: form.name.trim() || "Employee",
        role: form.role.trim().toLowerCase(),
        birthdayDate: form.birthdayDate.trim(),
        joiningDate: form.joiningDate.trim(),
        lastIncrementDate: form.lastIncrementDate.trim(),
      });
    }

    activeEmployeesCache = { value: recipients, loadedAt: Date.now() };
    return recipients;
  })().finally(() => {
    activeEmployeesRequest = null;
  });

  return activeEmployeesRequest;
}

export async function listHrAndSuperAdminRecipients(): Promise<NotificationRecipient[]> {
  const employees = await listActiveEmployees();
  return employees.filter(
    (employee) => employee.role === ROLES.HR_MANAGER || employee.role === ROLES.SUPER_ADMIN,
  );
}
