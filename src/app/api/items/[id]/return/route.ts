import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  const canAccess = session?.user.role === "USER" || session?.user.role === "ADMIN";
  if (!canAccess) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const { id } = await params;

  const lease = await prisma.lease.findFirst({
    where: { itemId: id, active: true },
    select: {
      id: true,
      studentId: true,
      item: {
        select: {
          id: true,
          book: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
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

  if (!lease) {
    return NextResponse.json({ error: "Keine aktive Ausleihe für dieses Item gefunden" }, { status: 404 });
  }

  await prisma.lease.update({
    where: { id: lease.id },
    data: { active: false, returnedAt: new Date() },
  });

  const remainingLeases = await prisma.lease.findMany({
    where: { studentId: lease.studentId, active: true },
    orderBy: { leasedAt: "desc" },
    select: {
      id: true,
      leasedAt: true,
      item: {
        select: {
          id: true,
          book: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    returnedItem: {
      id: lease.item.id,
      book: lease.item.book,
    },
    student: lease.student,
    remainingLeases,
  });
}
