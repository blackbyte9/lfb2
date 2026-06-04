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
      _count: { select: { leases: { where: { active: true } } } },
    },
  });

  return NextResponse.json(
    students.map((student) => ({
      id: student.id,
      idOld: student.idOld,
      firstname: student.firstname,
      lastname: student.lastname,
      course: student.course,
      status: student.status,
      activeLeasesCount: student._count.leases,
      createdAt: student.createdAt,
    }))
  );
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    idOld?: string | null;
    firstname?: string;
    lastname?: string;
    course?: string;
    status?: "ACTIVE" | "INACTIVE" | "SPECIAL";
  };

  const firstname = typeof body.firstname === "string" ? body.firstname.trim() : "";
  const lastname = typeof body.lastname === "string" ? body.lastname.trim() : "";
  const course = typeof body.course === "string" ? body.course.trim() : "";
  const status = body.status ?? "SPECIAL";

  if (!firstname) {
    return NextResponse.json({ error: "Vorname ist erforderlich" }, { status: 400 });
  }
  if (!lastname) {
    return NextResponse.json({ error: "Nachname ist erforderlich" }, { status: 400 });
  }
  if (!["ACTIVE", "INACTIVE", "SPECIAL"].includes(status)) {
    return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
  }

  let idOld: string | null = null;
  if (body.idOld !== undefined) {
    if (body.idOld === null) {
      idOld = null;
    } else if (typeof body.idOld === "string") {
      const normalizedIdOld = body.idOld.trim();
      idOld = normalizedIdOld.length > 0 ? normalizedIdOld : null;
    } else {
      return NextResponse.json({ error: "Ungültige alte ID" }, { status: 400 });
    }
  }

  try {
    const created = await prisma.student.create({
      data: {
        idOld,
        firstname,
        lastname,
        course,
        status,
      },
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

    return NextResponse.json({ ...created, activeLeasesCount: 0 }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Schüler konnte nicht erstellt werden";
    if (message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Diese alte ID existiert bereits" }, { status: 409 });
    }

    return NextResponse.json({ error: "Schüler konnte nicht erstellt werden" }, { status: 500 });
  }
}