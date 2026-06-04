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

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true },
  });

  if (!student) {
    return NextResponse.json({ error: "Schüler nicht gefunden" }, { status: 404 });
  }

  const [leases, comments, grades] = await Promise.all([
    prisma.lease.findMany({
      where: { studentId },
      orderBy: [{ leasedAt: "asc" }, { id: "asc" }],
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
    }),
    prisma.comment.findMany({
      where: { studentId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        body: true,
        createdAt: true,
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
    }),
    prisma.studentGradeHistory.findMany({
      where: { studentId },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        schoolYear: true,
        grade: true,
        source: true,
        updatedAt: true,
      },
    }),
  ]);

  const events = [
    ...grades.map((grade) => ({
      id: `grade-${grade.id}`,
      type: "GRADE_IMPORT" as const,
      date: grade.updatedAt.toISOString(),
      schoolYear: grade.schoolYear,
      grade: grade.grade,
      source: grade.source,
    })),
    ...leases.flatMap((lease) => {
      const leasedEvent = {
        id: `lease-${lease.id}-leased`,
        type: "LEASED" as const,
        date: lease.leasedAt.toISOString(),
        item: lease.item,
        active: lease.active,
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
          item: lease.item,
          active: lease.active,
          leaseId: lease.id,
        },
      ];
    }),
    ...comments.map((comment) => ({
      id: `comment-${comment.id}`,
      type: "COMMENT" as const,
      date: comment.createdAt.toISOString(),
      item: comment.item,
      commentId: comment.id,
      body: comment.body,
    })),
  ].sort((left, right) => {
    const dateDiff = new Date(left.date).getTime() - new Date(right.date).getTime();
    if (dateDiff !== 0) {
      return dateDiff;
    }

    const typeOrder: Record<string, number> = { GRADE_IMPORT: 0, LEASED: 1, COMMENT: 2, RETURNED: 3 };
    return (typeOrder[left.type] ?? 99) - (typeOrder[right.type] ?? 99);
  });

  return NextResponse.json({
    student: {
      id: student.id,
    },
    events,
  });
}