import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/labels/sync
 *
 * Back-fills PrintedLabel records for every RSV item that is in the Item table
 * but not yet tracked in PrintedLabel.  This prevents the allocate route from
 * handing out IDs that are already in use by imported items.
 *
 * Creates a single synthetic LabelPrintRun (pages = 0) to hold the records.
 * If there is nothing to sync the request is a no-op and returns { synced: 0 }.
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // All RSV item IDs that are not yet in PrintedLabel
      const untracked = await tx.$queryRaw<{ id: string }[]>`
        SELECT i.id
        FROM "Item" i
        WHERE i.id LIKE 'RSV%'
          AND NOT EXISTS (
            SELECT 1 FROM "PrintedLabel" pl WHERE pl."labelId" = i.id
          )
        ORDER BY i.id
      `;

      if (untracked.length === 0) {
        return { synced: 0 };
      }

      const ids = untracked.map((r) => r.id);
      const firstId = ids[0]!;
      const lastId  = ids[ids.length - 1]!;

      // Create a synthetic run (pages = 0 signals "imported, not printed")
      const run = await tx.labelPrintRun.create({
        data: {
          pages:   0,
          count:   ids.length,
          firstId,
          lastId,
          labels: {
            create: ids.map((labelId) => ({ labelId })),
          },
        },
      });

      return { synced: ids.length, runId: run.id, firstId, lastId };
    }, { isolationLevel: "Serializable" });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync fehlgeschlagen" },
      { status: 500 },
    );
  }
}
