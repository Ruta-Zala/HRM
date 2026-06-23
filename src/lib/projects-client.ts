export type ProjectInfo = {
  name: string;
  organization: string;
  employees: string[];
  projectManager: string;
  status: string;
};

let cachedProjects: ProjectInfo[] = [];

function normalizeEmployeeName(name: string): string {
  return name.trim().toLowerCase();
}

export async function fetchProjects(): Promise<ProjectInfo[]> {
  if (cachedProjects.length > 0) {
    return cachedProjects;
  }

  const response = await fetch("/api/employee/projects");
  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || "Failed to load projects");
  }

  cachedProjects = Array.isArray(result.projects) ? result.projects : [];
  return cachedProjects;
}

export function getProjectsForEmployee(name: string, projects: ProjectInfo[]): ProjectInfo[] {
  const normalizedName = normalizeEmployeeName(name);
  if (!normalizedName) return [];

  return projects
    .filter((project) =>
      project.employees.some((employee) => normalizeEmployeeName(employee) === normalizedName),
    )
    .sort((a, b) => {
      const aIsInactive = a.status.toLowerCase() === "inactive";
      const bIsInactive = b.status.toLowerCase() === "inactive";
      if (aIsInactive === bIsInactive) return 0;
      return aIsInactive ? 1 : -1;
    });
}
