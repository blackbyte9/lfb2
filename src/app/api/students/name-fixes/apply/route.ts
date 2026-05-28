import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildStudentNameFixProposals } from "@/lib/student-name-fixes";
import { canAccessStudents } from "@/lib/students-access";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!canAccessStudents(session?.user.role)) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    ids?: number[];
    overrides?: Array<{ id: number; firstname?: string; lastname?: string }>;
  };
  const selectedIds = new Set((body.ids ?? []).filter((id) => Number.isInteger(id)));
  const overrideById = new Map<number, { firstname?: string; lastname?: string }>();
  for (const override of body.overrides ?? []) {
    if (!Number.isInteger(override.id)) {
      continue;
    }

    overrideById.set(override.id, {
      firstname: override.firstname?.trim(),
      lastname: override.lastname?.trim(),
    });
  }

  const students = await prisma.student.findMany({
    select: {
      id: true,
      idOld: true,
      firstname: true,
      lastname: true,
    },
  });

  const fixes = buildStudentNameFixProposals(students).filter((fix) => selectedIds.size === 0 || selectedIds.has(fix.id));

  if (fixes.length === 0) {
    return NextResponse.json({ message: "Keine Namenskorrekturen angewendet", applied: 0 });
  }

  for (const fix of fixes) {
    const override = overrideById.get(fix.id);
    const firstname = override?.firstname || fix.firstnameAfter;
    const lastname = override?.lastname || fix.lastnameAfter;

    await prisma.student.update({
      where: { id: fix.id },
      data: {
        firstname,
        lastname,
      },
    });
  }

  return NextResponse.json({
    message: `${fixes.length} Namenskorrekturen angewendet`,
    applied: fixes.length,
    fixes,
  });
}