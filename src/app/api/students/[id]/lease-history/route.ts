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
  if (!Number.isInteger(studentId) || studentId <= 0) {
    return NextResponse.json({ error: "Ungültige Schüler-ID" }, { status: 400 });
  }

  const history = await prisma.lease.findMany({
    where: { studentId },
    orderBy: [{ leasedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      leasedAt: true,
      returnedAt: true,
      active: true,
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

  return NextResponse.json(history);
}
