import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { bookUpdateSchema } from "@/lib/book-schemas";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  const canManage = session?.user.role === "ADMIN" || session?.user.role === "USER";
  if (!canManage) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const { id } = await params;
  const bookId = parseInt(id, 10);
  if (isNaN(bookId)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = bookUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabedaten" }, { status: 400 });
  }

  try {
    const book = await prisma.book.update({
      where: { id: bookId },
      data: {
        ...(parsed.data.isbn ? { isbn: parsed.data.isbn } : {}),
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
      },
    });
    return NextResponse.json(book);
  } catch {
    return NextResponse.json({ error: "Buch nicht gefunden oder ISBN bereits vorhanden" }, { status: 404 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  const canManage = session?.user.role === "ADMIN" || session?.user.role === "USER";
  if (!canManage) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const { id } = await params;
  const bookId = parseInt(id, 10);
  if (isNaN(bookId)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  try {
    await prisma.book.delete({ where: { id: bookId } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: "Buch kann nicht gelöscht werden. Es wird in anderen Tabellen referenziert." },
      { status: 409 },
    );
  }
}
