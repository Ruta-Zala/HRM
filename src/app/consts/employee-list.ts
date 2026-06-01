import type { EmployeeFormState } from "@/lib/employee";
import { EMPLOYEE_LIST_PUBLIC_FIELDS } from "@/lib/employee/list-fields";

export type EmployeeListColumn = {
  key: keyof EmployeeFormState;
  header: string;
  sortable?: boolean;
};

const LIST_COLUMN_HEADERS: Record<(typeof EMPLOYEE_LIST_PUBLIC_FIELDS)[number], string> = {
  profileImage: "",
  name: "Name",
  role: "Role",
  position: "Position",
  status: "Status",
};

/** Columns shown on the employee directory table (all roles). */
export const EMPLOYEE_LIST_COLUMNS: EmployeeListColumn[] = EMPLOYEE_LIST_PUBLIC_FIELDS.map(
  (key) => ({
    key,
    header: LIST_COLUMN_HEADERS[key],
    sortable: key !== "profileImage" && key !== "status",
  }),
);
