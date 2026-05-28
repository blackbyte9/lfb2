import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { itemUpdateSchema } from "@/lib/book-schemas";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const item = await prisma.item.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      bookId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!item || item.status === "REMOVED") {
    return NextResponse.json({ error: "Item nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  const canManage = session?.user.role === "ADMIN" || session?.user.role === "USER";
  if (!canManage) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = itemUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabedaten" }, { status: 400 });
  }

  if (!parsed.data.status && !parsed.data.bookId) {
    return NextResponse.json({ error: "Keine Felder zum Aktualisieren" }, { status: 400 });
  }

  try {
    const item = await prisma.item.update({
      where: { id },
      data: {
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.bookId ? { bookId: parsed.data.bookId } : {}),
      },
      select: {
        id: true,
        status: true,
        bookId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: "Item nicht gefunden oder ungültige Buch-ID" }, { status: 404 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  const canManage = session?.user.role === "ADMIN" || session?.user.role === "USER";
  if (!canManage) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.item.update({
      where: { id },
      data: { status: "REMOVED" },
    });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Item nicht gefunden" }, { status: 404 });
  }
}
