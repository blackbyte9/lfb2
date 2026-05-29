import assert from "node:assert/strict";
import test from "node:test";

import { ensureTestEnv, readJson } from "../../../../../../helpers";

ensureTestEnv();

test("GET /api/students/[id]/leases rejects guest role", async () => {
  const { GET } = await import("@/app/api/students/[id]/leases/route");
  const { auth } = await import("@/lib/auth");

  const originalGetSession = auth.api.getSession;
  auth.api.getSession = (async () => ({ user: { role: "GUEST" } })) as typeof auth.api.getSession;

  try {
    const response = await GET(new Request("http://localhost/api/students/1/leases") as never, {
      params: Promise.resolve({ id: "1" }),
    });
    assert.equal(response.status, 403);
  } finally {
    auth.api.getSession = originalGetSession;
  }
});

test("GET /api/students/[id]/leases accepts admin role", async () => {
  const { GET } = await import("@/app/api/students/[id]/leases/route");
  const { auth } = await import("@/lib/auth");
  const { prisma } = await import("@/lib/prisma");

  const originalGetSession = auth.api.getSession;
  const originalFindUnique = prisma.student.findUnique;
  const originalFindMany = prisma.lease.findMany;
  auth.api.getSession = (async () => ({ user: { role: "ADMIN" } })) as typeof auth.api.getSession;
  prisma.student.findUnique = (async () => ({
    id: 1,
    idOld: "1001",
    firstname: "Anna",
    lastname: "Meyer",
    course: "10A",
  })) as typeof prisma.student.findUnique;
  prisma.lease.findMany = (async () => []) as typeof prisma.lease.findMany;

  try {
    const response = await GET(new Request("http://localhost/api/students/1/leases") as never, {
      params: Promise.resolve({ id: "1" }),
    });
    assert.equal(response.status, 200);
  } finally {
    auth.api.getSession = originalGetSession;
    prisma.student.findUnique = originalFindUnique;
    prisma.lease.findMany = originalFindMany;
  }
});

test("GET /api/students/[id]/leases validates id and missing student", async () => {
  const { GET } = await import("@/app/api/students/[id]/leases/route");
  const { auth } = await import("@/lib/auth");
  const { prisma } = await import("@/lib/prisma");

  const originalGetSession = auth.api.getSession;
  const originalFindUnique = prisma.student.findUnique;

  auth.api.getSession = (async () => ({ user: { role: "USER" } })) as typeof auth.api.getSession;
  prisma.student.findUnique = (async () => null) as typeof prisma.student.findUnique;

  try {
    const invalidId = await GET(new Request("http://localhost/api/students/x/leases") as never, {
      params: Promise.resolve({ id: "x" }),
    });
    assert.equal(invalidId.status, 400);

    const missingStudent = await GET(new Request("http://localhost/api/students/1/leases") as never, {
      params: Promise.resolve({ id: "1" }),
    });
    assert.equal(missingStudent.status, 404);
  } finally {
    auth.api.getSession = originalGetSession;
    prisma.student.findUnique = originalFindUnique;
  }
});

test("GET /api/students/[id]/leases returns student and active leases", async () => {
  const { GET } = await import("@/app/api/students/[id]/leases/route");
  const { auth } = await import("@/lib/auth");
  const { prisma } = await import("@/lib/prisma");

  const originalGetSession = auth.api.getSession;
  const originalFindUnique = prisma.student.findUnique;
  const originalFindMany = prisma.lease.findMany;

  auth.api.getSession = (async () => ({ user: { role: "USER" } })) as typeof auth.api.getSession;
  prisma.student.findUnique = (async () => ({
    id: 1,
    idOld: "1001",
    firstname: "Anna",
    lastname: "Meyer",
    course: "10A",
  })) as typeof prisma.student.findUnique;
  prisma.lease.findMany = (async () => [
    {
      id: 7,
      leasedAt: new Date("2026-01-12T10:00:00.000Z"),
      returnedAt: null,
      active: true,
      item: {
        id: "RSV1",
        status: "NEW",
        book: { id: 5, isbn: "978-1", name: "Book A" },
      },
    },
  ]) as typeof prisma.lease.findMany;

  try {
    const response = await GET(new Request("http://localhost/api/students/1/leases") as never, {
      params: Promise.resolve({ id: "1" }),
    });
    assert.equal(response.status, 200);

    const body = (await readJson(response)) as { student: { id: number }; leases: Array<{ id: number }> };
    assert.equal(body.student.id, 1);
    assert.equal(body.leases.length, 1);
    assert.equal(body.leases[0]?.id, 7);
  } finally {
    auth.api.getSession = originalGetSession;
    prisma.student.findUnique = originalFindUnique;
    prisma.lease.findMany = originalFindMany;
  }
});
