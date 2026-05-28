import { studentImportSchema } from "@/lib/student-schemas";

export type ParsedStudentImportEntry = {
  line: number;
  entry: {
    idOld: string;
    firstname: string;
    lastname: string;
    course: string;
  };
};

export type StudentImportIssue = {
  line: number;
  reason: string;
};

export function parseStudentImportPayload(payload: unknown): {
  entries: ParsedStudentImportEntry[];
  issues: StudentImportIssue[];
} {
  if (!Array.isArray(payload)) {
    throw new Error("Die Datei muss ein JSON-Array enthalten");
  }

  const entries: ParsedStudentImportEntry[] = [];
  const issues: StudentImportIssue[] = [];

  for (const [index, rawEntry] of payload.entries()) {
    const parsed = studentImportSchema.element.safeParse(rawEntry);
    if (!parsed.success) {
      issues.push({
        line: index + 1,
        reason: parsed.error.issues[0]?.message ?? "Ungültiger Eintrag",
      });
      continue;
    }

    entries.push({
      line: index + 1,
      entry: {
        idOld: parsed.data.idOld,
        firstname: parsed.data.firstname ?? "",
        lastname: parsed.data.lastname ?? "",
        course: parsed.data.course ?? "",
      },
    });
  }

  return { entries, issues };
}