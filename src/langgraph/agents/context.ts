import { z } from "zod";

export const SupportAgentContextSchema = z.object({
  user: z
    .object({
      id: z.string(),
      email: z.string(),
      name: z.string(),
      role: z.enum(["super_admin", "hr", "employee"]),
      department: z.string().optional(),
      sheetRow: z.number().optional(),
    })
    .optional(),
});

export type SupportAgentContext = z.infer<typeof SupportAgentContextSchema>;
