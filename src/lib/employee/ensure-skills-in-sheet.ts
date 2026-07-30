import { parseSkillsValue, normalizeSkillInput } from "@/app/consts/tech-skills";
import { appendSheetRows, readSheet } from "@/lib/google/sheets";

const SKILLS_SHEET_RANGE = `'Skills'!A:A`;
const SKILLS_HEADER_TITLES = new Set(["skill", "skills", "tech skills", "technology"]);

function extractSkillsFromRows(rows: string[][]): string[] {
  const raw = rows
    .map((row) => String(row[0] ?? "").trim())
    .filter(Boolean)
    .filter((value, index) => {
      if (index === 0 && SKILLS_HEADER_TITLES.has(value.toLowerCase())) return false;
      return true;
    });

  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of raw) {
    const normalized = normalizeSkillInput(s);
    const key = normalized.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }

  out.sort((a, b) => a.localeCompare(b));
  return out;
}

export async function ensureSkillsInSkillsSheet(skillsValue: string): Promise<{ added: number }> {
  const incoming = parseSkillsValue(skillsValue)
    .map((s) => normalizeSkillInput(s))
    .filter(Boolean);

  if (!incoming.length) return { added: 0 };

  const existing = await readSheet(SKILLS_SHEET_RANGE);
  const existingSkills = extractSkillsFromRows(existing);
  const existingLower = new Set(existingSkills.map((s) => s.toLowerCase()));

  const missing: string[] = [];
  for (const skill of incoming) {
    const key = skill.toLowerCase();
    if (existingLower.has(key)) continue;
    existingLower.add(key);
    missing.push(skill);
  }

  if (!missing.length) return { added: 0 };
  await appendSheetRows(
    SKILLS_SHEET_RANGE,
    missing.map((s) => [s]),
  );
  return { added: missing.length };
}
