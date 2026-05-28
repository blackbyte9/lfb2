import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { bookCreateSchema } from "@/lib/book-schemas";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const books = await prisma.book.findMany({
    orderBy: { name: "asc" },
    select: { id: true, isbn: true, name: true, createdAt: true },
  });

  return NextResponse.json(books);
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = bookCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabedaten" }, { status: 400 });
  }

  try {
    const book = await prisma.book.create({
      data: parsed.data,
    });
    return NextResponse.json(book, { status: 201 });
  } catch {
    return NextResponse.json({ error: "ISBN bereits vorhanden" }, { status: 409 });
  }
}
