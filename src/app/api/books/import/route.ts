import { NextRequest, NextResponse } from "next/server";
import { bookImportSchema } from "@/lib/book-schemas";
import { readUploadedFileText, runManagedImport } from "@/lib/import-route";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  return runManagedImport(request, {
    readText: () => readUploadedFileText(request),
    importText: async (text) => {
    const parsed = bookImportSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Ungültige JSON-Datei");
    }

    for (const entry of parsed.data) {
      await prisma.book.upsert({
        where: { isbn: entry.isbn },
        create: { isbn: entry.isbn, name: entry.name },
        update: { name: entry.name },
      });
    }

    return NextResponse.json({
      message: `${parsed.data.length} Bücher erfolgreich importiert`,
      imported: parsed.data.length,
    });
    },
  });
}
