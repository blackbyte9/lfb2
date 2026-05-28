import { NextRequest } from "next/server";

import { readUploadedFileText, runManagedImport } from "@/lib/import-route";
import { parseItemImportPayload, type ItemImportIssue } from "@/lib/item-import";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  return runManagedImport(request, {
    readText: () => readUploadedFileText(request),
    importText: async (text) => {
      const payload = JSON.parse(text);
      const { entries, issues } = parseItemImportPayload(payload);

      const isbns = [...new Set(entries.map(({ entry }) => entry.bookId))];
      const books = await prisma.book.findMany({
        where: { isbn: { in: isbns } },
        select: { id: true, isbn: true },
      });

      const bookByIsbn = new Map(books.map((book) => [book.isbn, book.id]));
      let imported = 0;
      const allIssues: ItemImportIssue[] = [...issues];

      for (const { line, entry } of entries) {
        const mappedBookId = bookByIsbn.get(entry.bookId);
        if (!mappedBookId) {
          allIssues.push({
            line,
            reason: `Kein Buch mit ISBN ${entry.bookId} gefunden`,
          });
          continue;
        }

        await prisma.item.upsert({
          where: { id: entry.id },
          create: {
            id: entry.id,
            status: entry.status,
            bookId: mappedBookId,
          },
          update: {
            status: entry.status,
            bookId: mappedBookId,
          },
        });

        imported += 1;
      }

      return {
        message: `${imported} Items importiert${allIssues.length > 0 ? `, ${allIssues.length} Zeilen übersprungen` : ""}`,
        imported,
        skipped: allIssues.length,
        issues: allIssues,
      };
    },
  });
}