import { NextResponse } from "next/server";
import { withActiveSession } from "@/lib/auth/api-guard";
import { readSheet } from "@/lib/google/sheets";

const SKILLS_SHEET_NAME = "Skills";
const SKILLS_SHEET_RANGE = `'${SKILLS_SHEET_NAME}'!A:A`;
const SKILLS_HEADER_TITLES = new Set(["skill", "skills", "tech skills", "technology"]);

export const GET = withActiveSession(async () => {
  try {
    const rows = await readSheet(SKILLS_SHEET_RANGE);
    const skillValues = rows
      .map((row) => String(row[0] ?? "").trim())
      .filter(Boolean)
      .filter((value, index) => {
        if (index === 0 && SKILLS_HEADER_TITLES.has(value.toLowerCase())) {
          return false;
        }
        return true;
      });

    const uniqueSkills = Array.from(new Set(skillValues)).sort((a, b) => a.localeCompare(b));

    return NextResponse.json(
      {
        success: true,
        skills: uniqueSkills,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error("GET Skills Sheet Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load skills",
      },
      { status: 500 },
    );
  }
});
