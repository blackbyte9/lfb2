import { z } from "zod";

const leaseImportEntrySchema = z
  .object({
    leased: z.string().datetime("Ungültiges leased-Datum"),
    returned: z.string().datetime("Ungültiges returned-Datum").nullable(),
    active: z.boolean(),
    itemId: z.string().trim().min(1, "Item-ID ist erforderlich"),
    studentId: z.string().trim().min(1, "Student-ID ist erforderlich"),
  })
  .strict();

export type LeaseImportIssue = {
  line: number;
  reason: string;
};

export type ParsedLeaseImportEntry = {
  line: number;
  entry: {
    leased: string;
    returned: string | null;
    active: boolean;
    itemId: string;
    studentId: string;
  };
};

export function parseLeaseImportPayload(payload: unknown): {
  entries: ParsedLeaseImportEntry[];
  issues: LeaseImportIssue[];
} {
  if (!Array.isArray(payload)) {
    throw new Error("Die Datei muss ein JSON-Array enthalten");
  }

  const entries: ParsedLeaseImportEntry[] = [];
  const issues: LeaseImportIssue[] = [];

  for (const [index, rawEntry] of payload.entries()) {
    const parsed = leaseImportEntrySchema.safeParse(rawEntry);
    if (!parsed.success) {
      issues.push({
        line: index + 1,
        reason: parsed.error.issues[0]?.message ?? "Ungültiger Eintrag",
      });
      continue;
    }

    entries.push({
      line: index + 1,
      entry: parsed.data,
    });
  }

  return { entries, issues };
}
