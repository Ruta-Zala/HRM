import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import { parseSkillsValue, normalizeSkillInput } from "@/app/consts/tech-skills";
import { appendSheetRows, readSheet } from "@/lib/google/sheets";

const SKILLS_SHEET_NAME = "Skills";
const SKILLS_SHEET_RANGE = `'${SKILLS_SHEET_NAME}'!A:A`;
const SKILLS_HEADER_TITLES = new Set(["skill", "skills", "tech skills", "technology"]);

function extractSkillsFromRows(rows: string[][]): string[] {
  const raw = rows
    .map((row) => String(row[0] ?? "").trim())
    .filter(Boolean)
    .filter((value, index) => {
      if (index === 0 && SKILLS_HEADER_TITLES.has(value.toLowerCase())) return false;
      return true;
    });

  // De-dupe case-insensitively, keep first casing
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of raw) {
    const key = normalizeSkillInput(s).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(normalizeSkillInput(s));
  }

  out.sort((a, b) => a.localeCompare(b));
  return out;
}

async function listSkillsFromSheet(): Promise<string[]> {
  const rows = await readSheet(SKILLS_SHEET_RANGE);
  return extractSkillsFromRows(rows);
}

export const GET = withActiveSession(async () => {
  try {
    const skills = await listSkillsFromSheet();

    return NextResponse.json({ success: true, skills }, { status: 200 });
  } catch (error: unknown) {
    console.error("GET employee skill suggestions error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load skill suggestions",
      },
      { status: 500 },
    );
  }
});

export const POST = withActiveSession(async (req) => {
  try {
    const body = (await req.json()) as { skill?: string; skills?: string[] };
    const incoming: string[] = [];

    if (Array.isArray(body.skills)) {
      incoming.push(...body.skills);
    }
    if (typeof body.skill === "string") {
      incoming.push(...parseSkillsValue(body.skill));
    }

    const wanted = incoming.map((s) => normalizeSkillInput(s)).filter(Boolean);
    if (!wanted.length) {
      return NextResponse.json({ success: false, message: "skill is required" }, { status: 400 });
    }

    const existing = await listSkillsFromSheet();
    const existingLower = new Set(existing.map((s) => s.toLowerCase()));

    const missing: string[] = [];
    for (const s of wanted) {
      const key = s.toLowerCase();
      if (!existingLower.has(key)) {
        existingLower.add(key);
        missing.push(s);
      }
    }

    if (missing.length > 0) {
      await appendSheetRows(
        SKILLS_SHEET_RANGE,
        missing.map((s) => [s]),
      );
    }

    return NextResponse.json({ success: true, added: missing.length }, { status: 200 });
  } catch (error: unknown) {
    console.error("POST employee skill error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to save skill",
      },
      { status: 500 },
    );
  }
});
