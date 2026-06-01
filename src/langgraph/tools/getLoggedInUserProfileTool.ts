import { tool, type ToolRuntime } from "langchain";
import { z } from "zod";

import { resolveEmployeeRecordForSession } from "../../lib/auth/employee-record";
import { sheetRowToForm } from "../../lib/employee";
import type { SupportAgentContext } from "../agents/context";

export const getLoggedInUserProfileTool = tool(
  async (_input, runtime: ToolRuntime<unknown, SupportAgentContext>) => {
    const user = runtime.context?.user;

    if (!user) {
      return JSON.stringify({
        success: false,
        message: "No logged-in user context was provided to the support agent.",
      });
    }

    const record = await resolveEmployeeRecordForSession(user);
    if (!record) {
      return JSON.stringify({
        success: false,
        message: "No employee record is linked to the logged-in user.",
      });
    }

    const { headers, row } = record;
    const profile = sheetRowToForm(headers, row);

    return JSON.stringify({
      success: true,
      profile: {
        name: profile.name,
        status: profile.status,
        ParentName: profile.parentName,
        designation: profile.position,
        role: profile.role,
        birthDate: profile.birthdayDate,
        joiningDate: profile.joiningDate,
        experience: profile.experience,
        skills: profile.skills,
        salary: profile.salary,
        lastIncrementDate: profile.lastIncrementDate,
      },
    });
  },
  {
    name: "get_logged_in_user_profile",
    description:
      "Get a safe profile summary for the currently logged-in HRM user. Returns non-sensitive own-profile fields such as name, active status, designation, role, birth date, joining date, experience, skills, and last increment date. It must not expose email, username, employee ID, salary, contact details, address, PAN/Aadhaar, document links, sheet row, spreadsheet IDs, or private employee fields.",
    schema: z.object({}),
  },
);
