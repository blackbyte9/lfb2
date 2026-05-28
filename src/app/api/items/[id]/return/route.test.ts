import assert from "node:assert/strict";
import test from "node:test";

import { ensureTestEnv } from "@/test/helpers";

ensureTestEnv();

test("POST /api/items/[id]/return rejects guest role", async () => {
  const { POST } = await import("./route");
  const { auth } = await import("@/lib/auth");

  const originalGetSession = auth.api.getSession;
  auth.api.getSession = (async () => ({ user: { role: "GUEST" } })) as typeof auth.api.getSession;

  try {
    const response = await POST(new Request("http://localhost/api/items/RSV1/return") as never, { params: Promise.resolve({ id: "RSV1" }) });
    assert.equal(response.status, 403);
  } finally {
    auth.api.getSession = originalGetSession;
  }
});

test("POST /api/items/[id]/return returns 404 when no active lease exists", async () => {
  const { POST } = await import("./route");
  const { auth } = await import("@/lib/auth");
  const { prisma } = await import("@/lib/prisma");

  const originalGetSession = auth.api.getSession;
  const originalFindFirst = prisma.lease.findFirst;

  auth.api.getSession = (async () => ({ user: { role: "USER" } })) as typeof auth.api.getSession;
  prisma.lease.findFirst = (async () => null) as typeof prisma.lease.findFirst;

  try {
    const response = await POST(new Request("http://localhost/api/items/RSV1/return") as never, { params: Promise.resolve({ id: "RSV1" }) });
    assert.equal(response.status, 404);
  } finally {
    auth.api.getSession = originalGetSession;
    prisma.lease.findFirst = originalFindFirst;
  }
});

test("POST /api/items/[id]/return marks lease inactive", async () => {
  const { POST } = await import("./route");
  const { auth } = await import("@/lib/auth");
  const { prisma } = await import("@/lib/prisma");

  const originalGetSession = auth.api.getSession;
  const originalFindFirst = prisma.lease.findFirst;
  const originalUpdate = prisma.lease.update;

  let updateArgs: unknown;

  auth.api.getSession = (async () => ({ user: { role: "ADMIN" } })) as typeof auth.api.getSession;
  prisma.lease.findFirst = (async () => ({ id: 123 })) as typeof prisma.lease.findFirst;
  prisma.lease.update = (async (args) => {
    updateArgs = args;
    return { id: 123 };
  }) as typeof prisma.lease.update;

  try {
    const response = await POST(new Request("http://localhost/api/items/RSV1/return") as never, { params: Promise.resolve({ id: "RSV1" }) });
    assert.equal(response.status, 200);
    assert.match(JSON.stringify(updateArgs), /"active":false/);
    assert.match(JSON.stringify(updateArgs), /"returnedAt"/);
  } finally {
    auth.api.getSession = originalGetSession;
    prisma.lease.findFirst = originalFindFirst;
    prisma.lease.update = originalUpdate;
  }
});
