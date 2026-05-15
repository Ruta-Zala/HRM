export type UserRole = "super_admin" | "hr" | "employee";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
};
