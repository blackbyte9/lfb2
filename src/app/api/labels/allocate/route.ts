import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LABELS_PER_PAGE = 51; // 3 columns × 17 rows (matching LFB label sheet)
const MAX_PAGES = 50;

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { pages?: unknown };
  const pages = typeof body.pages === "number" && Number.isInteger(body.pages) && body.pages >= 1 && body.pages <= MAX_PAGES
    ? body.pages
    : null;

  if (!pages) {
    return NextResponse.json(
      { error: `Ungültige Seitenanzahl (1–${MAX_PAGES})` },
      { status: 400 },
    );
  }

  const count = pages * LABELS_PER_PAGE;

  try {
    const run = await prisma.$transaction(async (tx) => {
      // Find the highest printed label to determine next ID — lock with serializable-ish reads
      const highest = await tx.printedLabel.findFirst({
        orderBy: { labelId: "desc" },
        select: { labelId: true },
      });

      const highestNum = highest ? parseInt(highest.labelId.slice(3), 10) : 0;

      const labelIds = Array.from({ length: count }, (_, i) => {
        const num = highestNum + i + 1;
        return `RSV${num.toString().padStart(7, "0")}`;
      });

      const firstId = labelIds[0]!;
      const lastId = labelIds[labelIds.length - 1]!;

      const printRun = await tx.labelPrintRun.create({
        data: {
          pages,
          count,
          firstId,
          lastId,
          labels: {
            create: labelIds.map((labelId) => ({ labelId })),
          },
        },
      });

      return { runId: printRun.id, labels: labelIds, firstId, lastId };
    }, { isolationLevel: "Serializable" });

    return NextResponse.json(run);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fehler beim Generieren der IDs" },
      { status: 500 },
    );
  }
}
