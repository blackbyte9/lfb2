import assert from "node:assert/strict";
import test from "node:test";

import { ensureTestEnv, readJson } from "../../../../helpers";

ensureTestEnv();

test("GET /api/items returns 400 for invalid bookId", async () => {
  const { GET } = await import("@/app/api/items/route");

  const response = await GET(new Request("http://localhost/api/items?bookId=abc") as never);
  assert.equal(response.status, 400);
});

test("GET /api/items maps lease and student fields", async () => {
  const { GET } = await import("@/app/api/items/route");
  const { prisma } = await import("@/lib/prisma");

  const originalFindMany = prisma.item.findMany;
  prisma.item.findMany = (async () => [
    {
      id: "RSV1",
      status: "NEW",
      bookId: 1,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      leases: [{ studentId: 10, student: { firstname: "Anna", lastname: "Meyer" } }],
    },
  ]) as unknown as typeof prisma.item.findMany;

  try {
    const response = await GET(new Request("http://localhost/api/items") as never);
    assert.equal(response.status, 200);
    const body = (await readJson(response)) as Array<{ isLeased: boolean; leasedStudentId: number; leasedStudentName: string }>;
    assert.equal(body[0]?.isLeased, true);
    assert.equal(body[0]?.leasedStudentId, 10);
    assert.equal(body[0]?.leasedStudentName, "Meyer, Anna");
  } finally {
    prisma.item.findMany = originalFindMany;
  }
});

test("POST /api/items rejects guest role", async () => {
  const { POST } = await import("@/app/api/items/route");
  const { auth } = await import("@/lib/auth");

  const originalGetSession = auth.api.getSession;
  auth.api.getSession = (async () => ({ user: { role: "GUEST" } })) as typeof auth.api.getSession;

  try {
    const response = await POST(
      new Request("http://localhost/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "RSV2", status: "NEW", bookId: 1 }),
      }) as never,
    );

    assert.equal(response.status, 403);
  } finally {
    auth.api.getSession = originalGetSession;
  }
});
