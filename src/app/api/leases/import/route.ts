import { NextRequest } from "next/server";

import { readUploadedFileText, runManagedImport } from "@/lib/import-route";
import { parseLeaseImportPayload, type LeaseImportIssue } from "@/lib/lease-import";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  return runManagedImport(request, {
    readText: () => readUploadedFileText(request),
    importText: async (text) => {
      const payload = JSON.parse(text);
      const { entries, issues } = parseLeaseImportPayload(payload);

      const itemIds = [...new Set(entries.map(({ entry }) => entry.itemId))];
      const studentIdsOld = [...new Set(entries.map(({ entry }) => entry.studentId))];

      const items = await prisma.item.findMany({
        where: { id: { in: itemIds } },
        select: { id: true },
      });

      const students = await prisma.student.findMany({
        where: { idOld: { in: studentIdsOld } },
        select: { id: true, idOld: true },
      });

      const itemById = new Set(items.map((item) => item.id));
      const studentByIdOld = new Map(students.map((student) => [student.idOld, student.id]));

      let imported = 0;
      const allIssues: LeaseImportIssue[] = [...issues];

      for (const { line, entry } of entries) {
        if (!itemById.has(entry.itemId)) {
          allIssues.push({
            line,
            reason: `Kein Item mit ID ${entry.itemId} gefunden`,
          });
          continue;
        }

        const mappedStudentId = studentByIdOld.get(entry.studentId) ?? null;
        if (!mappedStudentId) {
          allIssues.push({
            line,
            reason: `Kein Schüler mit alter ID ${entry.studentId} gefunden`,
          });
          continue;
        }

        const leasedAt = new Date(entry.leased);
        const returnedAt = entry.returned ? new Date(entry.returned) : null;

        await prisma.lease.upsert({
          where: {
            studentId_itemId_leasedAt: {
              studentId: mappedStudentId,
              itemId: entry.itemId,
              leasedAt,
            },
          },
          create: {
            studentId: mappedStudentId,
            itemId: entry.itemId,
            leasedAt,
            returnedAt,
            active: entry.active,
          },
          update: {
            returnedAt,
            active: entry.active,
          },
        });

        imported += 1;
      }

      return {
        message: `${imported} Ausleihen importiert${allIssues.length > 0 ? `, ${allIssues.length} Zeilen übersprungen` : ""}`,
        imported,
        skipped: allIssues.length,
        issues: allIssues,
      };
    },
  });
}
