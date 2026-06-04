import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { itemCommentCreateSchema } from "@/lib/book-schemas";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  const canAccess = session?.user.role === "USER" || session?.user.role === "ADMIN";
  if (!canAccess) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const parsed = itemCommentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabedaten" }, { status: 400 });
  }

  const item = await prisma.item.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
    },
  });

  if (!item || item.status === "REMOVED") {
    return NextResponse.json({ error: "Item nicht gefunden" }, { status: 404 });
  }

  // Resolve which student to attach: explicit override beats active-lease lookup
  let resolvedStudentId: number | null = parsed.data.studentId ?? null;
  if (resolvedStudentId === null) {
    const activeLease = await prisma.lease.findFirst({
      where: { itemId: id, active: true },
      select: { student: { select: { id: true } } },
    });
    resolvedStudentId = activeLease?.student.id ?? null;
  }

  // Run comment creation (and optional status update) in an interactive transaction
  const { comment, updatedItem } = await prisma.$transaction(async (tx) => {
    const newComment = await tx.comment.create({
      data: {
        itemId: id,
        body: parsed.data.comment,
        studentId: resolvedStudentId,
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
        student: {
          select: {
            id: true,
            idOld: true,
            firstname: true,
            lastname: true,
            course: true,
          },
        },
      },
    });

    let itemAfterUpdate: { id: string; status: string } | null = null;
    if (parsed.data.status) {
      itemAfterUpdate = await tx.item.update({
        where: { id },
        data: { status: parsed.data.status },
        select: { id: true, status: true },
      });
    }

    return { comment: newComment, updatedItem: itemAfterUpdate };
  });

  return NextResponse.json({ comment, item: updatedItem }, { status: 201 });
}