import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const item = await prisma.item.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      leases: {
        orderBy: { leasedAt: "desc" },
        select: {
          id: true,
          leasedAt: true,
          returnedAt: true,
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
      },
    },
  });

  if (!item || item.status === "REMOVED") {
    return NextResponse.json({ error: "Item nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json({
    item: {
      id: item.id,
      status: item.status,
    },
    leases: item.leases,
  });
}
