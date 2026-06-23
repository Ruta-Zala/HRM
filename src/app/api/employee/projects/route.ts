import { NextResponse } from "next/server";
import { withActiveSession } from "@/lib/auth/api-guard";
import { readSheet } from "@/lib/google/sheets";

const PROJECTS_SHEET_NAME = "Projects";
const PROJECTS_SHEET_RANGE = `'${PROJECTS_SHEET_NAME}'!A:E`;
const PROJECT_NAME_HEADERS = new Set(["name", "project", "project name"]);

function parseEmployeeNames(value: string): string[] {
  return value
    .split(/[;,]/)
    .map((employee) => employee.trim())
    .filter(Boolean);
}

export const GET = withActiveSession(async () => {
  try {
    const rows = await readSheet(PROJECTS_SHEET_RANGE);

    const projects = rows
      .map((row) => ({
        name: String(row[0] ?? "").trim(),
        organization: String(row[1] ?? "").trim(),
        employees: parseEmployeeNames(String(row[2] ?? "")),
        projectManager: String(row[3] ?? "").trim(),
        status: String(row[4] ?? "")
          .trim()
          .toLowerCase(),
      }))
      .filter((project, index) => {
        if (!project.name) return false;
        if (index === 0 && PROJECT_NAME_HEADERS.has(project.name.toLowerCase())) {
          return false;
        }
        return true;
      });
    // .filter((project) => {
    //   if (!project.status) return true;
    //   return ACTIVE_STATUS_VALUES.has(project.status);
    // });

    const projectMap = new Map<string, (typeof projects)[number]>();
    for (const project of projects) {
      const key = project.name.toLowerCase();
      const existing = projectMap.get(key);
      if (existing) {
        existing.employees = Array.from(new Set([...existing.employees, ...project.employees]));
        existing.organization ||= project.organization;
        existing.projectManager ||= project.projectManager;
        existing.status ||= project.status;
      } else {
        projectMap.set(key, project);
      }
    }

    const uniqueProjects = Array.from(projectMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    return NextResponse.json(
      {
        success: true,
        projects: uniqueProjects,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error("GET Projects Sheet Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load project assignments",
      },
      { status: 500 },
    );
  }
});
