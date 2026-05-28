import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { bookImportSchema } from "@/lib/book-schemas";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Keine Datei hochgeladen" }, { status: 400 });
    }
    const text = await (file as Blob).text();
    const parsed = bookImportSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige JSON-Datei" }, { status: 400 });
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
  } catch {
    return NextResponse.json({ error: "Ungültige JSON-Datei" }, { status: 400 });
  }
}
