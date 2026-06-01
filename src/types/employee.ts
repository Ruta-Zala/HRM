export type EmployeeRow = {
  id: string;
} & Record<string, string>;

export type EmployeeStatus = "Active" | "Inactive";

/** Employee record for lists, pickers, and offboarding flows. */
export interface Employee {
  sheetRow: string;
  employeeId: string;
  name: string;
  email: string;
  role: string;
  position: string;
  status: EmployeeStatus;
  department?: string;
  designation?: string;
}
