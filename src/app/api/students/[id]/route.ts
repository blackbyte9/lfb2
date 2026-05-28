import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_STATUSES = ["ACTIVE", "INACTIVE", "SPECIAL"] as const;
type StudentStatusInput = (typeof ALLOWED_STATUSES)[number];

function isStudentStatus(value: unknown): value is StudentStatusInput {
  return typeof value === "string" && ALLOWED_STATUSES.includes(value as StudentStatusInput);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  const canManage = session?.user.role === "ADMIN" || session?.user.role === "USER";
  if (!canManage) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const { id } = await params;
  const studentId = Number(id);
  if (!Number.isInteger(studentId) || studentId <= 0) {
    return NextResponse.json({ error: "Ungültige Schüler-ID" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    idOld?: string | null;
    firstname?: string;
    lastname?: string;
    course?: string;
    status?: string;
  };

  const updateData: {
    idOld?: string | null;
    firstname?: string;
    lastname?: string;
    course?: string;
    status?: StudentStatusInput;
  } = {};

  if (body.idOld !== undefined) {
    if (body.idOld === null) {
      updateData.idOld = null;
    } else if (typeof body.idOld === "string") {
      const normalized = body.idOld.trim();
      updateData.idOld = normalized.length > 0 ? normalized : null;
    } else {
      return NextResponse.json({ error: "Ungültige alte ID" }, { status: 400 });
    }
  }

  if (body.firstname !== undefined) {
    const firstname = body.firstname.trim();
    if (!firstname) {
      return NextResponse.json({ error: "Vorname ist erforderlich" }, { status: 400 });
    }
    updateData.firstname = firstname;
  }

  if (body.lastname !== undefined) {
    const lastname = body.lastname.trim();
    if (!lastname) {
      return NextResponse.json({ error: "Nachname ist erforderlich" }, { status: 400 });
    }
    updateData.lastname = lastname;
  }

  if (body.course !== undefined) {
    updateData.course = body.course.trim();
  }

  if (body.status !== undefined) {
    if (!isStudentStatus(body.status)) {
      return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
    }
    updateData.status = body.status;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Keine Änderungen angegeben" }, { status: 400 });
  }

  try {
    const updated = await prisma.student.update({
      where: { id: studentId },
      data: updateData,
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

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Schüler konnte nicht gespeichert werden";
    if (message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Diese alte ID existiert bereits" }, { status: 409 });
    }

    return NextResponse.json({ error: "Schüler konnte nicht gespeichert werden" }, { status: 500 });
  }
}