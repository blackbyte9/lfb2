import { readFile } from "node:fs/promises";
import { NextRequest } from "next/server";

import { runManagedImport } from "@/lib/import-route";
import { parseStudentImportPayload, type StudentImportIssue } from "@/lib/student-import";
import { prisma } from "@/lib/prisma";

const DEFAULT_STUDENTS_FILE = "C:\\Programming\\sbm5\\data\\students.json";

export async function POST(request: NextRequest) {
  return runManagedImport(request, {
    readText: () => readFile(DEFAULT_STUDENTS_FILE, "utf-8"),
    failureStatus: 500,
    failureMessage: "Import aus students.json fehlgeschlagen",
    importText: async (text) => {
      const payload = JSON.parse(text);
      const { entries, issues } = parseStudentImportPayload(payload);

      let imported = 0;
      const allIssues: StudentImportIssue[] = [...issues];

      for (const { entry } of entries) {
        await prisma.student.upsert({
          where: { idOld: entry.idOld },
          create: {
            idOld: entry.idOld,
            firstname: entry.firstname,
            lastname: entry.lastname,
            course: entry.course,
          },
          update: {
            firstname: entry.firstname,
            lastname: entry.lastname,
            course: entry.course,
          },
        });

        imported += 1;
      }

      return {
        message: `${imported} Schüler importiert${allIssues.length > 0 ? `, ${allIssues.length} Zeilen übersprungen` : ""}`,
        imported,
        skipped: allIssues.length,
        issues: allIssues,
      };
    },
  });
}