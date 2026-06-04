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
        orderBy: [{ leasedAt: "asc" }, { id: "asc" }],
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
      comments: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          body: true,
          createdAt: true,
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

  const events = [
    ...item.leases.flatMap((lease) => {
      const leasedEvent = {
        id: `lease-${lease.id}-leased`,
        type: "LEASED" as const,
        date: lease.leasedAt.toISOString(),
        student: lease.student,
        leaseId: lease.id,
      };

      if (!lease.returnedAt) {
        return [leasedEvent];
      }

      return [
        leasedEvent,
        {
          id: `lease-${lease.id}-returned`,
          type: "RETURNED" as const,
          date: lease.returnedAt.toISOString(),
          student: lease.student,
          leaseId: lease.id,
        },
      ];
    }),
    ...item.comments.map((comment) => ({
      id: `comment-${comment.id}`,
      type: "COMMENT" as const,
      date: comment.createdAt.toISOString(),
      student: comment.student,
      commentId: comment.id,
      body: comment.body,
    })),
  ].sort((left, right) => {
    const dateDiff = new Date(left.date).getTime() - new Date(right.date).getTime();
    if (dateDiff !== 0) {
      return dateDiff;
    }

    const typeOrder: Record<string, number> = { LEASED: 0, COMMENT: 1, RETURNED: 2 };
    return (typeOrder[left.type] ?? 99) - (typeOrder[right.type] ?? 99);
  });

  return NextResponse.json({
    item: {
      id: item.id,
      status: item.status,
    },
    events,
  });
}
