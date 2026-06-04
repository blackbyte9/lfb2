import assert from "node:assert/strict";
import test from "node:test";

import { ensureTestEnv, readJson } from "../../../../../../helpers";

ensureTestEnv();

test("GET /api/students/[id]/lease-history rejects guest role", async () => {
  const { GET } = await import("@/app/api/students/[id]/lease-history/route");
  const { auth } = await import("@/lib/auth");

  const originalGetSession = auth.api.getSession;
  auth.api.getSession = (async () => ({ user: { role: "GUEST" } })) as typeof auth.api.getSession;

  try {
    const response = await GET(new Request("http://localhost/api/students/1/lease-history") as never, {
      params: Promise.resolve({ id: "1" }),
    });
    assert.equal(response.status, 403);
  } finally {
    auth.api.getSession = originalGetSession;
  }
});

test("GET /api/students/[id]/lease-history validates id and returns history", async () => {
  const { GET } = await import("@/app/api/students/[id]/lease-history/route");
  const { auth } = await import("@/lib/auth");
  const { prisma } = await import("@/lib/prisma");

  const originalGetSession = auth.api.getSession;
  const originalFindMany = prisma.lease.findMany;

  auth.api.getSession = (async () => ({ user: { role: "USER" } })) as typeof auth.api.getSession;
  prisma.lease.findMany =
    ((async () => [
      {
        id: 9,
        leasedAt: new Date("2026-01-01T00:00:00.000Z"),
        returnedAt: null,
        active: true,
        item: {
          id: "RSV0010001",
          book: {
            id: 7,
            name: "Deutsch 2",
          },
        },
      },
    ]) as unknown) as unknown as typeof prisma.lease.findMany;

  try {
    const invalid = await GET(new Request("http://localhost/api/students/x/lease-history") as never, {
      params: Promise.resolve({ id: "x" }),
    });
    assert.equal(invalid.status, 400);

    const response = await GET(new Request("http://localhost/api/students/1/lease-history") as never, {
      params: Promise.resolve({ id: "1" }),
    });
    assert.equal(response.status, 200);
    const body = (await readJson(response)) as Array<{ id: number; item: { id: string } }>;
    assert.equal(body[0]?.id, 9);
    assert.equal(body[0]?.item.id, "RSV0010001");
  } finally {
    auth.api.getSession = originalGetSession;
    prisma.lease.findMany = originalFindMany;
  }
});
