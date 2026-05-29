import assert from "node:assert/strict";
import test from "node:test";

import { ensureTestEnv, readJson } from "../../../../../../helpers";

ensureTestEnv();

test("POST /api/items/[id]/lease rejects guest role", async () => {
  const { POST } = await import("@/app/api/items/[id]/lease/route");
  const { auth } = await import("@/lib/auth");

  const originalGetSession = auth.api.getSession;
  auth.api.getSession = (async () => ({ user: { role: "GUEST" } })) as typeof auth.api.getSession;

  try {
    const response = await POST(new Request("http://localhost/api/items/RSV1/lease", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: 1 }),
    }) as never, { params: Promise.resolve({ id: "RSV1" }) });
    assert.equal(response.status, 403);
  } finally {
    auth.api.getSession = originalGetSession;
  }
});

test("POST /api/items/[id]/lease accepts admin role", async () => {
  const { POST } = await import("@/app/api/items/[id]/lease/route");
  const { auth } = await import("@/lib/auth");
  const { prisma } = await import("@/lib/prisma");

  const originalGetSession = auth.api.getSession;
  const originalFindUniqueStudent = prisma.student.findUnique;
  const originalFindUniqueItem = prisma.item.findUnique;
  const originalCreate = prisma.lease.create;
  const originalFindMany = prisma.lease.findMany;

  auth.api.getSession = (async () => ({ user: { role: "ADMIN" } })) as typeof auth.api.getSession;
  prisma.student.findUnique = (async () => ({
    id: 7,
    idOld: "1001",
    firstname: "Anna",
    lastname: "Meyer",
    course: "10A",
    status: "ACTIVE",
  })) as typeof prisma.student.findUnique;
  prisma.item.findUnique = (async () => ({
    id: "RSV1",
    status: "NEW",
    book: { id: 5, name: "Book A" },
    leases: [],
  })) as typeof prisma.item.findUnique;
  prisma.lease.create = (async () => ({ id: 99 })) as typeof prisma.lease.create;
  prisma.lease.findMany = (async () => []) as typeof prisma.lease.findMany;

  try {
    const response = await POST(new Request("http://localhost/api/items/RSV1/lease", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: 1 }),
    }) as never, { params: Promise.resolve({ id: "RSV1" }) });
    assert.equal(response.status, 200);
  } finally {
    auth.api.getSession = originalGetSession;
    prisma.student.findUnique = originalFindUniqueStudent;
    prisma.item.findUnique = originalFindUniqueItem;
    prisma.lease.create = originalCreate;
    prisma.lease.findMany = originalFindMany;
  }
});

test("POST /api/items/[id]/lease returns leased item snapshot", async () => {
  const { POST } = await import("@/app/api/items/[id]/lease/route");
  const { auth } = await import("@/lib/auth");
  const { prisma } = await import("@/lib/prisma");

  const originalGetSession = auth.api.getSession;
  const originalFindUniqueStudent = prisma.student.findUnique;
  const originalFindUniqueItem = prisma.item.findUnique;
  const originalCreate = prisma.lease.create;
  const originalFindMany = prisma.lease.findMany;

  auth.api.getSession = (async () => ({ user: { role: "USER" } })) as typeof auth.api.getSession;
  prisma.student.findUnique = (async () => ({
    id: 7,
    idOld: "1001",
    firstname: "Anna",
    lastname: "Meyer",
    course: "10A",
    status: "ACTIVE",
  })) as typeof prisma.student.findUnique;
  prisma.item.findUnique = (async () => ({
    id: "RSV1",
    status: "NEW",
    book: { id: 5, name: "Book A" },
    leases: [],
  })) as typeof prisma.item.findUnique;
  prisma.lease.create = (async () => ({ id: 99 })) as typeof prisma.lease.create;
  prisma.lease.findMany = (async () => [
    {
      id: 99,
      leasedAt: new Date("2026-01-01T10:00:00.000Z"),
      item: {
        id: "RSV1",
        book: { id: 5, name: "Book A" },
      },
    },
  ]) as typeof prisma.lease.findMany;

  try {
    const response = await POST(
      new Request("http://localhost/api/items/RSV1/lease", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: 7 }),
      }) as never,
      { params: Promise.resolve({ id: "RSV1" }) },
    );
    assert.equal(response.status, 200);
    const body = (await readJson(response)) as { ok: boolean; student: { id: number }; leasedItem: { id: string } };
    assert.equal(body.ok, true);
    assert.equal(body.student.id, 7);
    assert.equal(body.leasedItem.id, "RSV1");
  } finally {
    auth.api.getSession = originalGetSession;
    prisma.student.findUnique = originalFindUniqueStudent;
    prisma.item.findUnique = originalFindUniqueItem;
    prisma.lease.create = originalCreate;
    prisma.lease.findMany = originalFindMany;
  }
});

test("POST /api/items/[id]/lease rejects damaged items as unavailable", async () => {
  const { POST } = await import("@/app/api/items/[id]/lease/route");
  const { auth } = await import("@/lib/auth");
  const { prisma } = await import("@/lib/prisma");

  const originalGetSession = auth.api.getSession;
  const originalFindUniqueStudent = prisma.student.findUnique;
  const originalFindUniqueItem = prisma.item.findUnique;

  auth.api.getSession = (async () => ({ user: { role: "USER" } })) as typeof auth.api.getSession;
  prisma.student.findUnique = (async () => ({
    id: 7,
    idOld: "1001",
    firstname: "Anna",
    lastname: "Meyer",
    course: "10A",
    status: "ACTIVE",
  })) as typeof prisma.student.findUnique;
  prisma.item.findUnique = (async () => ({
    id: "RSV1",
    status: "DAMAGED",
    book: { id: 5, name: "Book A" },
    leases: [],
  })) as typeof prisma.item.findUnique;

  try {
    const response = await POST(new Request("http://localhost/api/items/RSV1/lease", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: 7 }),
    }) as never, { params: Promise.resolve({ id: "RSV1" }) });

    assert.equal(response.status, 409);
    const body = (await readJson(response)) as { error?: string };
    assert.equal(body.error, "Item ist nicht verfügbar (Status: beschädigt)");
  } finally {
    auth.api.getSession = originalGetSession;
    prisma.student.findUnique = originalFindUniqueStudent;
    prisma.item.findUnique = originalFindUniqueItem;
  }
});
