import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessStudents } from "@/lib/students-access";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!canAccessStudents(session?.user.role)) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const students = await prisma.student.findMany({
    orderBy: [{ lastname: "asc" }, { firstname: "asc" }, { idOld: "asc" }],
    select: {
      id: true,
      idOld: true,
      firstname: true,
      lastname: true,
      course: true,
      status: true,
      createdAt: true,
    },
  });

  return NextResponse.json(students);
}