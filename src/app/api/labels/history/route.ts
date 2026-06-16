import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const [runs, totalPrinted] = await Promise.all([
    prisma.labelPrintRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        pages: true,
        count: true,
        firstId: true,
        lastId: true,
        createdAt: true,
      },
    }),
    prisma.printedLabel.count(),
  ]);

  return NextResponse.json({
    totalPrinted,
    runs: runs.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  });
}
