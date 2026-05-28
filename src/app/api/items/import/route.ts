import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { parseItemImportPayload, type ItemImportIssue } from "@/lib/item-import";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  const canManage = session?.user.role === "ADMIN" || session?.user.role === "USER";
  if (!canManage) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Keine Datei hochgeladen" }, { status: 400 });
    }

    const text = await (file as Blob).text();
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

    return NextResponse.json({
      message: `${imported} Items importiert${allIssues.length > 0 ? `, ${allIssues.length} Zeilen übersprungen` : ""}`,
      imported,
      skipped: allIssues.length,
      issues: allIssues,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import fehlgeschlagen" },
      { status: 400 },
    );
  }
}