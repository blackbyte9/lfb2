import assert from "node:assert/strict";
import test from "node:test";

import { ensureTestEnv, readJson } from "../../../../../../helpers";

ensureTestEnv();

test("POST /api/items/[id]/comments rejects guest role", async () => {
  const { POST } = await import("@/app/api/items/[id]/comments/route");
  const { auth } = await import("@/lib/auth");

  const originalGetSession = auth.api.getSession;
  auth.api.getSession = (async () => ({ user: { role: "GUEST" } })) as typeof auth.api.getSession;

  try {
    const response = await POST(new Request("http://localhost/api/items/RSV1/comments", {
      method: "POST",
      body: JSON.stringify({ comment: "Hello" }),
    }) as never, { params: Promise.resolve({ id: "RSV1" }) });
    assert.equal(response.status, 403);
  } finally {
    auth.api.getSession = originalGetSession;
  }
});

test("POST /api/items/[id]/comments links active student when available", async () => {
  const { POST } = await import("@/app/api/items/[id]/comments/route");
  const { auth } = await import("@/lib/auth");
  const { prisma } = await import("@/lib/prisma");

  const originalGetSession = auth.api.getSession;
  const originalFindUnique = prisma.item.findUnique;
  const originalFindFirst = prisma.lease.findFirst;
  const originalCreate = prisma.comment.create;
  const originalTransaction = prisma.$transaction;

  let createArgs: unknown;

  auth.api.getSession = (async () => ({ user: { role: "USER" } })) as typeof auth.api.getSession;
  prisma.item.findUnique = (async () => ({ id: "RSV1", status: "USED" })) as unknown as typeof prisma.item.findUnique;
  prisma.lease.findFirst = (async () => ({ student: { id: 7, idOld: "1001", firstname: "Anna", lastname: "Meyer", course: "10A" } })) as unknown as typeof prisma.lease.findFirst;
  prisma.comment.create = ((args: unknown) => {
    createArgs = args;
    return Promise.resolve({
      id: 22,
      body: "Bitte reparieren",
      createdAt: new Date("2026-01-04T08:00:00.000Z"),
      student: {
        id: 7,
        idOld: "1001",
        firstname: "Anna",
        lastname: "Meyer",
        course: "10A",
      },
    });
  }) as unknown as typeof prisma.comment.create;
  // Make $transaction execute the callback with the mocked prisma client
  prisma.$transaction = ((cb: unknown) => {
    if (typeof cb === "function") {
      return (cb as (tx: typeof prisma) => Promise<unknown>)(prisma);
    }
    return Promise.resolve([]);
  }) as unknown as typeof prisma.$transaction;

  try {
    const response = await POST(new Request("http://localhost/api/items/RSV1/comments", {
      method: "POST",
      body: JSON.stringify({ comment: "  Bitte reparieren  " }),
    }) as never, { params: Promise.resolve({ id: "RSV1" }) });

    assert.equal(response.status, 201);
    const body = (await readJson(response)) as { comment: { body: string; student?: { id: number } }; item: null };
    assert.equal(body.comment.body, "Bitte reparieren");
    assert.equal(body.comment.student?.id, 7);
    assert.match(JSON.stringify(createArgs), /"itemId":"RSV1"/);
    assert.match(JSON.stringify(createArgs), /"studentId":7/);
  } finally {
    auth.api.getSession = originalGetSession;
    prisma.item.findUnique = originalFindUnique;
    prisma.lease.findFirst = originalFindFirst;
    prisma.comment.create = originalCreate;
    prisma.$transaction = originalTransaction;
  }
});
