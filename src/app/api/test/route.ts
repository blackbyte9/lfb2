import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.test.findMany({
    orderBy: { id: "asc" },
  });

  return NextResponse.json(rows);
}
