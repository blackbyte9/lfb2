import { NextRequest } from "next/server";

import { runManagedImport } from "@/lib/import-route";
import { parseWibCsvPayload, normalizeSchoolYear, type WibImportIssue } from "@/lib/student-import-wib";
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
      const { entries, issues } = parseWibCsvPayload(text);
      const schoolYear = normalizeSchoolYear(schoolYearInput);

      let imported = 0;
      let created = 0;
      let updated = 0;
      const allIssues: WibImportIssue[] = [...issues];

      for (const { line, entry } of entries) {
        const matches = await prisma.student.findMany({
          where: {
            firstname: { equals: entry.firstname, mode: "insensitive" },
            lastname: { equals: entry.lastname, mode: "insensitive" },
          },
          select: { id: true },
        });

        if (matches.length > 1) {
          allIssues.push({
            line,
            reason: `Mehrdeutiger Treffer für ${entry.lastname}, ${entry.firstname}`,
          });
          continue;
        }

        const student =
          matches.length === 1
            ? await prisma.student.update({
                where: { id: matches[0].id },
                data: {
                  course: entry.course,
                  status: "ACTIVE",
                },
                select: { id: true },
              })
            : await prisma.student.create({
                data: {
                  idOld: `WIB-${schoolYear}-${line}`,
                  firstname: entry.firstname,
                  lastname: entry.lastname,
                  course: entry.course,
                  status: "ACTIVE",
                },
                select: { id: true },
              });

        if (matches.length === 1) {
          updated += 1;
        } else {
          created += 1;
        }

        await prisma.studentGradeHistory.upsert({
          where: {
            studentId_schoolYear_source: {
              studentId: student.id,
              schoolYear,
              source: "WIB",
            },
          },
          create: {
            studentId: student.id,
            schoolYear,
            grade: entry.course,
            source: "WIB",
          },
          update: {
            grade: entry.course,
          },
        });

        imported += 1;
      }

      return {
        message: `${imported} Schüler aus WiB importiert (${updated} aktualisiert, ${created} neu)${allIssues.length > 0 ? `, ${allIssues.length} Zeilen übersprungen` : ""}`,
        imported,
        updated,
        created,
        schoolYear,
        skipped: allIssues.length,
        issues: allIssues,
      };
    },
  });
}