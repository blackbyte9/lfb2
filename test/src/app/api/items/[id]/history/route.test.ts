import assert from "node:assert/strict";
import test from "node:test";

import { ensureTestEnv, readJson } from "../../../../../../helpers";

ensureTestEnv();

test("GET /api/items/[id]/history returns comments and leases in chronological order", async () => {
  const { GET } = await import("@/app/api/items/[id]/history/route");
  const { prisma } = await import("@/lib/prisma");

  const originalFindUnique = prisma.item.findUnique;
  prisma.item.findUnique = (async () => ({
    id: "RSV1",
    status: "USED",
    leases: [
      {
        id: 1,
        leasedAt: new Date("2026-01-01T08:00:00.000Z"),
        returnedAt: new Date("2026-01-03T08:00:00.000Z"),
        student: {
          id: 11,
          idOld: "1001",
          firstname: "Anna",
          lastname: "Meyer",
          course: "10A",
        },
      },
    ],
    comments: [
      {
        id: 9,
        body: "Check-in vor Rückgabe",
        createdAt: new Date("2026-01-02T08:00:00.000Z"),
        student: {
          id: 11,
          idOld: "1001",
          firstname: "Anna",
          lastname: "Meyer",
          course: "10A",
        },
      },
    ],
  })) as unknown as typeof prisma.item.findUnique;

  try {
    const response = await GET(new Request("http://localhost/api/items/RSV1/history") as never, {
      params: Promise.resolve({ id: "RSV1" }),
    });

    assert.equal(response.status, 200);
    const body = (await readJson(response)) as {
      item: { id: string };
      events: Array<{ type: string; id: string; body?: string }>;
    };

    assert.equal(body.item.id, "RSV1");
    assert.deepEqual(body.events.map((event) => event.type), ["LEASED", "COMMENT", "RETURNED"]);
    assert.equal(body.events[1]?.body, "Check-in vor Rückgabe");
  } finally {
    prisma.item.findUnique = originalFindUnique;
  }
});
