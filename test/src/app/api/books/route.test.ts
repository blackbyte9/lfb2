import assert from "node:assert/strict";
import test from "node:test";

import { ensureTestEnv, readJson } from "../../../../helpers";

ensureTestEnv();

test("GET /api/books maps itemCount and leasedCount", async () => {
  const { GET } = await import("@/app/api/books/route");
  const { prisma } = await import("@/lib/prisma");

  const originalFindMany = prisma.book.findMany;
  prisma.book.findMany = (async () => [
    {
      id: 1,
      isbn: "978-1",
      name: "Alpha",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      items: [
        { id: "I1", _count: { leases: 0 } },
        { id: "I2", _count: { leases: 1 } },
      ],
    },
  ]) as unknown as typeof prisma.book.findMany;

  try {
    const response = await GET();
    assert.equal(response.status, 200);
    const body = (await readJson(response)) as Array<{ itemCount: number; leasedCount: number }>;
    assert.equal(body[0]?.itemCount, 2);
    assert.equal(body[0]?.leasedCount, 1);
  } finally {
    prisma.book.findMany = originalFindMany;
  }
});

test("POST /api/books rejects guest role", async () => {
  const { POST } = await import("@/app/api/books/route");
  const { auth } = await import("@/lib/auth");

  const originalGetSession = auth.api.getSession;
  auth.api.getSession = (async () => ({ user: { role: "GUEST" } })) as typeof auth.api.getSession;

  try {
    const request = new Request("http://localhost/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isbn: "978-1", name: "Alpha" }),
    });

    const response = await POST(request as never);
    assert.equal(response.status, 403);
  } finally {
    auth.api.getSession = originalGetSession;
  }
});

test("POST /api/books returns 409 on unique conflicts", async () => {
  const { POST } = await import("@/app/api/books/route");
  const { auth } = await import("@/lib/auth");
  const { prisma } = await import("@/lib/prisma");

  const originalGetSession = auth.api.getSession;
  const originalCreate = prisma.book.create;

  auth.api.getSession = (async () => ({ user: { role: "USER" } })) as typeof auth.api.getSession;
  prisma.book.create = (async () => {
    throw new Error("Unique constraint failed");
  }) as unknown as typeof prisma.book.create;

  try {
    const request = new Request("http://localhost/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isbn: "978-1", name: "Alpha" }),
    });

    const response = await POST(request as never);
    assert.equal(response.status, 409);
  } finally {
    auth.api.getSession = originalGetSession;
    prisma.book.create = originalCreate;
  }
});
