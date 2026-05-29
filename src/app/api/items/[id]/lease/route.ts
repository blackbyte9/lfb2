import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessStudents } from "@/lib/students-access";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!canAccessStudents(session?.user.role)) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const { id } = await params;
  const itemId = id.trim().toUpperCase();

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const studentId = Number((body as { studentId?: unknown })?.studentId);
  if (Number.isNaN(studentId) || studentId <= 0) {
    return NextResponse.json({ error: "Ungültige Schüler-ID" }, { status: 400 });
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      idOld: true,
      firstname: true,
      lastname: true,
      course: true,
      status: true,
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Schüler nicht gefunden" }, { status: 404 });
  }

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      status: true,
      book: {
        select: {
          id: true,
          name: true,
        },
      },
      leases: {
        where: { active: true },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!item || item.status === "REMOVED") {
    return NextResponse.json({ error: "Item nicht gefunden" }, { status: 404 });
  }

  if (item.leases.length > 0) {
    return NextResponse.json({ error: "Item ist bereits ausgeliehen" }, { status: 409 });
  }

  await prisma.lease.create({
    data: {
      studentId,
      itemId,
      leasedAt: new Date(),
      active: true,
    },
  });

  const activeLeases = await prisma.lease.findMany({
    where: { studentId, active: true },
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
    leasedItem: {
      id: item.id,
      book: item.book,
    },
    student: {
      id: student.id,
      idOld: student.idOld,
      firstname: student.firstname,
      lastname: student.lastname,
      course: student.course,
      status: student.status,
    },
    activeLeases,
  });
}
