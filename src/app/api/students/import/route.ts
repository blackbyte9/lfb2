import { NextRequest } from "next/server";

import { runManagedImport } from "@/lib/import-route";
import { parseStudentImportPayload, type StudentImportIssue } from "@/lib/student-import";
import { normalizeSchoolYear } from "@/lib/student-import-wib";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const formDataPromise = request.formData();
  let schoolYearInput = "";

  return runManagedImport(request, {
    readText: async () => {
      const formData = await formDataPromise;
      schoolYearInput = typeof formData.get("schoolYear") === "string" ? (formData.get("schoolYear") as string) : "";
      const file = formData.get("file");
      if (!file || typeof file === "string") {
        throw new Error("Keine Datei hochgeladen");
      }

      return file.text();
    },
    importText: async (text) => {
      const payload = JSON.parse(text);
      const { entries, issues } = parseStudentImportPayload(payload);
      const schoolYear = normalizeSchoolYear(schoolYearInput);

      let imported = 0;
      const allIssues: StudentImportIssue[] = [...issues];

      for (const { entry } of entries) {
        const student = await prisma.student.upsert({
          where: { idOld: entry.idOld },
          create: {
            idOld: entry.idOld,
            firstname: entry.firstname,
            lastname: entry.lastname,
            course: entry.course,
            status: "ACTIVE",
          },
          update: {
            firstname: entry.firstname,
            lastname: entry.lastname,
            course: entry.course,
            status: "ACTIVE",
          },
          select: { id: true },
        });

        await prisma.studentGradeHistory.upsert({
          where: {
            studentId_schoolYear_source: {
              studentId: student.id,
              schoolYear,
              source: "JSON",
            },
          },
          create: {
            studentId: student.id,
            schoolYear,
            grade: entry.course,
            source: "JSON",
          },
          update: {
            grade: entry.course,
          },
        });

        imported += 1;
      }

      return {
        message: `${imported} Schüler importiert (${schoolYear})${allIssues.length > 0 ? `, ${allIssues.length} Zeilen übersprungen` : ""}`,
        imported,
        schoolYear,
        skipped: allIssues.length,
        issues: allIssues,
      };
    },
  });
}