import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { itemCreateSchema } from "@/lib/book-schemas";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bookIdParam = searchParams.get("bookId");

  const where = bookIdParam ? { bookId: Number(bookIdParam), status: { not: "REMOVED" as const } } : { status: { not: "REMOVED" as const } };
  if (bookIdParam && Number.isNaN(Number(bookIdParam))) {
    return NextResponse.json({ error: "Ungültige Buch-ID" }, { status: 400 });
  }

  const items = await prisma.item.findMany({
    where,
    orderBy: { id: "asc" },
    select: {
      id: true,
      status: true,
      bookId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  const canManage = session?.user.role === "ADMIN" || session?.user.role === "USER";
  if (!canManage) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = itemCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabedaten" }, { status: 400 });
  }

  try {
    const item = await prisma.item.create({
      data: {
        id: parsed.data.id,
        status: parsed.data.status,
        bookId: parsed.data.bookId,
      },
      select: {
        id: true,
        status: true,
        bookId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Item konnte nicht erstellt werden" }, { status: 409 });
  }
}
