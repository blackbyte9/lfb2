import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessStudents } from "@/lib/students-access";

type FieldChoice = "target" | "source";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!canAccessStudents(session?.user.role)) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const { id } = await params;
  const targetId = Number(id);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return NextResponse.json({ error: "Ungültige Ziel-Schüler-ID" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    sourceId?: unknown;
    fields?: {
      idOld?: FieldChoice;
      firstname?: FieldChoice;
      lastname?: FieldChoice;
      course?: FieldChoice;
      status?: FieldChoice;
    };
  };

  const sourceId = Number(body.sourceId);
  if (!Number.isInteger(sourceId) || sourceId <= 0) {
    return NextResponse.json({ error: "Ungültige Quell-Schüler-ID" }, { status: 400 });
  }

  if (sourceId === targetId) {
    return NextResponse.json({ error: "Ziel- und Quell-Schüler sind identisch" }, { status: 400 });
  }

  const fields = body.fields ?? {};

  try {
    const merged = await prisma.$transaction(async (tx) => {
      const [target, source] = await Promise.all([
        tx.student.findUnique({ where: { id: targetId } }),
        tx.student.findUnique({ where: { id: sourceId } }),
      ]);

      if (!target) throw new Error("Ziel-Schüler nicht gefunden");
      if (!source) throw new Error("Quell-Schüler nicht gefunden");

      // Determine final field values based on user's choice
      const finalIdOld = fields.idOld === "source" ? source.idOld : target.idOld;
      const finalFirstname = fields.firstname === "source" ? source.firstname : target.firstname;
      const finalLastname = fields.lastname === "source" ? source.lastname : target.lastname;
      const finalCourse = fields.course === "source" ? source.course : target.course;
      const finalStatus = fields.status === "source" ? source.status : target.status;

      // Null out source idOld first to avoid unique constraint conflict when updating target
      if (source.idOld !== null) {
        await tx.student.update({ where: { id: sourceId }, data: { idOld: null } });
      }

      // Move all leases from source to target
      await tx.lease.updateMany({ where: { studentId: sourceId }, data: { studentId: targetId } });

      // Move all comments from source to target
      await tx.comment.updateMany({ where: { studentId: sourceId }, data: { studentId: targetId } });

      // Merge grade history — upsert each source entry onto target, keeping existing on conflict
      const sourceHistory = await tx.studentGradeHistory.findMany({ where: { studentId: sourceId } });
      for (const entry of sourceHistory) {
        await tx.studentGradeHistory.upsert({
          where: {
            studentId_schoolYear_source: {
              studentId: targetId,
              schoolYear: entry.schoolYear,
              source: entry.source,
            },
          },
          create: {
            studentId: targetId,
            schoolYear: entry.schoolYear,
            grade: entry.grade,
            source: entry.source,
          },
          update: {}, // keep existing target entry on conflict
        });
      }

      // Update target with chosen field values
      const updated = await tx.student.update({
        where: { id: targetId },
        data: {
          idOld: finalIdOld,
          firstname: finalFirstname,
          lastname: finalLastname,
          course: finalCourse,
          status: finalStatus,
        },
        select: {
          id: true,
          idOld: true,
          firstname: true,
          lastname: true,
          course: true,
          status: true,
          createdAt: true,
          _count: { select: { leases: { where: { active: true } } } },
        },
      });

      // Delete the source student (cascades delete its now-empty gradeHistory)
      await tx.student.delete({ where: { id: sourceId } });

      return updated;
    });

    return NextResponse.json({
      id: merged.id,
      idOld: merged.idOld,
      firstname: merged.firstname,
      lastname: merged.lastname,
      course: merged.course,
      status: merged.status,
      activeLeasesCount: merged._count.leases,
      createdAt: merged.createdAt.toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Zusammenführen fehlgeschlagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
