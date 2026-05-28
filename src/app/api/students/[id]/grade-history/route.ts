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

  const history = await prisma.studentGradeHistory.findMany({
    where: { studentId },
    orderBy: [{ schoolYear: "asc" }, { source: "asc" }],
    select: {
      id: true,
      schoolYear: true,
      grade: true,
      source: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(history);
}