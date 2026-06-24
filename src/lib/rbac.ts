import type { UserRole } from "@/types/auth";
import { ROLES } from "@/app/consts/common";

const { SUPER_ADMIN, HR_MANAGER, EMPLOYEE } = ROLES;

export type NavChild = {
  label: string;
  href: string;
  roles: UserRole[];
};

export type NavItem = {
  label: string;
  href: string;
  icon: string;
  roles: UserRole[];
  children?: NavChild[];
};

/** Section index links (e.g. /employee) must not match deeper sibling routes (e.g. /employee/punch). */
export function isNavLinkActive(
  pathname: string,
  href: string,
  options?: { exactOnly?: boolean },
): boolean {
  if (pathname === href) return true;
  if (options?.exactOnly) return false;
  return pathname.startsWith(`${href}/`);
}

/** Any route under the Employee module (directory, profile by row, edit, new, etc.). */
export function isEmployeeSectionPath(pathname: string): boolean {
  return pathname === "/employee" || pathname.startsWith("/employee/");
}

/**
 * Employee directory routes: list, add, and per-employee pages (`/employee/6/profile`).
 * Excludes static module pages that have their own nav item (punch, attendance, …).
 */
export function isEmployeeDirectoryPath(pathname: string): boolean {
  if (pathname === "/employee") return true;
  if (!pathname.startsWith("/employee/")) return false;

  const firstSegment = pathname.slice("/employee/".length).split("/")[0] ?? "";
  if (firstSegment === "new") return true;
  if (/^\d+$/.test(firstSegment)) return true;

  return false;
}

/** Resolve sidebar active state for a nav child link. */
export function isNavChildActive(pathname: string, childHref: string, parentHref: string): boolean {
  if (parentHref === "/employee") {
    if (childHref === "/employee") {
      return isEmployeeDirectoryPath(pathname);
    }
    if (childHref === "/employee/profile") {
      return pathname === "/employee/profile";
    }
  }

  return isNavLinkActive(pathname, childHref, {
    exactOnly: childHref === parentHref,
  });
}

/** Resolve sidebar active state for a top-level nav group. */
export function isNavGroupActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/employee") {
    return isEmployeeSectionPath(pathname);
  }

  if (pathname === item.href) return true;

  return item.children?.some((child) => isNavChildActive(pathname, child.href, item.href)) ?? false;
}

export const navStructure: NavItem[] = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: "LayoutDashboard",
    roles: [SUPER_ADMIN, HR_MANAGER, EMPLOYEE],
  },
  {
    label: "Employee",
    href: "/employee",
    icon: "Users",
    roles: [SUPER_ADMIN, HR_MANAGER, EMPLOYEE],
    children: [
      {
        label: "All Employees",
        href: "/employee",
        roles: [SUPER_ADMIN, HR_MANAGER, EMPLOYEE],
      },
      {
        label: "Onboarding / offboarding",
        href: "/employee/onboarding",
        roles: [SUPER_ADMIN, HR_MANAGER],
      },
      {
        label: "Employee profile",
        href: "/employee/profile",
        roles: [SUPER_ADMIN, HR_MANAGER, EMPLOYEE],
      },
      {
        label: "Punch in / out",
        href: "/employee/punch",
        roles: [SUPER_ADMIN, HR_MANAGER, EMPLOYEE],
      },
      {
        label: "Overtime & approvals",
        href: "/employee/overtime",
        roles: [SUPER_ADMIN, HR_MANAGER],
      },
      {
        label: "Salary slips",
        href: "/employee/salary-slips",
        roles: [SUPER_ADMIN, HR_MANAGER, EMPLOYEE],
      },
      { label: "Complaints", href: "/employee/complaints", roles: [] },
      {
        label: "Attendance history",
        href: "/employee/attendance",
        roles: [SUPER_ADMIN, HR_MANAGER, EMPLOYEE],
      },
      { label: "Leave & festivals", href: "/employee/leave-festival", roles: [] },
      { label: "Leave privacy", href: "/employee/privacy", roles: [] },
    ],
  },
  {
    label: "Leave",
    href: "/leave",
    icon: "CalendarDays",
    roles: [SUPER_ADMIN, HR_MANAGER, EMPLOYEE],
    children: [
      { roles: [SUPER_ADMIN, HR_MANAGER, EMPLOYEE], label: "Leave desk", href: "/leave" },
      { roles: [], label: "Approvals & chain", href: "/leave/approvals" },
      { roles: [], label: "Early leave", href: "/leave/early-leave" },
      { roles: [], label: "Working vs on leave", href: "/leave/dashboard" },
    ],
  },
  {
    label: "Notifications",
    href: "/notifications",
    icon: "Bell",
    roles: [],
    children: [
      { roles: [], label: "Center", href: "/notifications" },
      { roles: [], label: "Announcements", href: "/notifications/announcements" },
      { roles: [], label: "Automation rules", href: "/notifications/rules" },
    ],
  },
  {
    label: "Integrations",
    href: "/integrations",
    icon: "Plug",
    roles: [SUPER_ADMIN, HR_MANAGER],
    children: [
      { roles: [], label: "Overview", href: "/integrations" },
      {
        roles: [SUPER_ADMIN, HR_MANAGER],
        label: "Google Drive",
        href: "/integrations/google-drive",
      },
      { roles: [], label: "Slack", href: "/integrations/slack" },
      { roles: [], label: "Media uploads", href: "/integrations/media" },
    ],
  },
  {
    label: "Access control",
    href: "/settings/network",
    icon: "Shield",
    roles: [],
    children: [{ roles: [], label: "LAN / Wi-Fi restriction", href: "/settings/network" }],
  },
];

function filterNavChildren(
  children: NavChild[] | undefined,
  role: UserRole,
): NavChild[] | undefined {
  if (!children?.length) return undefined;
  const filtered = children.filter((child) => child.roles.includes(role));
  return filtered.length ? filtered : undefined;
}

export function filterNav(role: UserRole | null): NavItem[] {
  if (!role) return [];

  return navStructure
    .filter((item) => item.roles.includes(role))
    .map((item) => ({
      ...item,
      children: filterNavChildren(item.children, role),
    }))
    .filter((item) => !item.children || item.children.length > 0);
}

export function canAccessPath(role: UserRole, pathname: string): boolean {
  if (role === ROLES.SUPER_ADMIN) return true;

  for (const item of navStructure) {
    if (!item.roles.includes(role)) continue;

    if (item.children?.length) {
      const children = [...item.children].sort((a, b) => b.href.length - a.href.length);
      for (const child of children) {
        if (
          isNavLinkActive(pathname, child.href, {
            exactOnly: child.href === item.href,
          })
        ) {
          return child.roles.includes(role);
        }
      }
    }

    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      return item.roles.includes(role);
    }
  }

  if (pathname.startsWith("/settings/network")) return false;
  if (pathname.startsWith("/integrations") && role === "employee") return false;
  return true;
}
