import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
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