import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildStudentNameFixProposals } from "@/lib/student-name-fixes";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const students = await prisma.student.findMany({
    select: {
      id: true,
      idOld: true,
      firstname: true,
      lastname: true,
    },
  });

  const fixes = buildStudentNameFixProposals(students);

  return NextResponse.json({
    scanned: students.length,
    suggested: fixes.length,
    fixes,
  });
}