import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessStudents } from "@/lib/students-access";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!canAccessStudents(session?.user.role)) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const { id } = await params;
  const studentId = Number(id);

  if (Number.isNaN(studentId)) {
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
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Schüler nicht gefunden" }, { status: 404 });
  }

  const leases = await prisma.lease.findMany({
    where: { studentId, active: true },
    orderBy: { leasedAt: "desc" },
    select: {
      id: true,
      leasedAt: true,
      returnedAt: true,
      active: true,
      item: {
        select: {
          id: true,
          status: true,
          book: {
            select: {
              id: true,
              isbn: true,
              name: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ student, leases });
}
