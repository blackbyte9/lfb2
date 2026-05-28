import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  const canManage = session?.user.role === "ADMIN" || session?.user.role === "USER";
  if (!canManage) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const { id } = await params;

  const lease = await prisma.lease.findFirst({
    where: { itemId: id, active: true },
    select: { id: true },
  });

  if (!lease) {
    return NextResponse.json({ error: "Keine aktive Ausleihe für dieses Item gefunden" }, { status: 404 });
  }

  await prisma.lease.update({
    where: { id: lease.id },
    data: { active: false, returnedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
