import { parseSkillsValue } from "@/app/consts/tech-skills";

import { headerToFormKey } from "./form";
import { getSheetHeaders } from "./headers";

/** Unique skills from all employee rows (case-insensitive), sorted alphabetically. */
export function collectSkillsFromEmployeeSheet(rows: string[][]): string[] {
  if (rows.length < 2) return [];

  const headers = getSheetHeaders(rows);
  const skillsIndex = headers.findIndex((header) => headerToFormKey(header) === "skills");
  if (skillsIndex < 0) return [];

  const seen = new Map<string, string>();

  for (const row of rows.slice(1)) {
    const cell = String(row[skillsIndex] ?? "").trim();
    if (!cell) continue;

    for (const skill of parseSkillsValue(cell)) {
      const key = skill.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, skill);
      }
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}
