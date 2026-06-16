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
      // Find the highest existing RSV number from BOTH PrintedLabel AND Item tables
      // so we never generate an ID that is already in use by an imported item.
      const [highestLabel, highestItem] = await Promise.all([
        tx.printedLabel.findFirst({
          orderBy: { labelId: "desc" },
          select: { labelId: true },
        }),
        tx.item.findFirst({
          where: { id: { startsWith: "RSV" } },
          orderBy: { id: "desc" },
          select: { id: true },
        }),
      ]);

      const numFromLabel = highestLabel ? parseInt(highestLabel.labelId.slice(3), 10) : 0;
      const numFromItem  = highestItem  ? parseInt(highestItem.id.slice(3), 10)       : 0;
      const highestNum   = Math.max(numFromLabel, numFromItem);

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
