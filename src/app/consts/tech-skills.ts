export const SKILLS_DELIMITER = ", ";

export function parseSkillsValue(value: string): string[] {
  if (!value.trim()) return [];

  return value
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
}

export function joinSkillsValue(skills: string[]): string {
  return skills.join(SKILLS_DELIMITER);
}
