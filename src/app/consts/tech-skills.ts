export const SKILLS_DELIMITER = ", ";

export function normalizeSkillInput(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function parseSkillsValue(value: string): string[] {
  if (!value.trim()) return [];

  return value
    .split(",")
    .map((skill) => normalizeSkillInput(skill))
    .filter(Boolean);
}

export function joinSkillsValue(skills: string[]): string {
  return skills.join(SKILLS_DELIMITER);
}

export function skillExistsInList(skill: string, skills: string[]): boolean {
  const normalized = normalizeSkillInput(skill).toLowerCase();
  if (!normalized) return false;
  return skills.some((item) => normalizeSkillInput(item).toLowerCase() === normalized);
}
