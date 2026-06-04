import assert from "node:assert/strict";
import test from "node:test";

import { ensureTestEnv, readJson } from "../../../../helpers";

ensureTestEnv();

test("GET /api/students rejects guest role", async () => {
  const { GET } = await import("@/app/api/students/route");
  const { auth } = await import("@/lib/auth");

  const originalGetSession = auth.api.getSession;
  auth.api.getSession = (async () => ({ user: { role: "GUEST" } })) as typeof auth.api.getSession;

  try {
    const response = await GET(new Request("http://localhost/api/students") as never);
    assert.equal(response.status, 403);
  } finally {
    auth.api.getSession = originalGetSession;
  }
});

test("GET /api/students maps activeLeasesCount", async () => {
  const { GET } = await import("@/app/api/students/route");
  const { auth } = await import("@/lib/auth");
  const { prisma } = await import("@/lib/prisma");

  const originalGetSession = auth.api.getSession;
  const originalFindMany = prisma.student.findMany;

  auth.api.getSession = (async () => ({ user: { role: "USER" } })) as typeof auth.api.getSession;
  prisma.student.findMany =
    ((async () => [
      {
        id: 1,
        idOld: "1001",
        firstname: "Anna",
        lastname: "Meyer",
        course: "10A",
        status: "ACTIVE",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        _count: { leases: 2 },
      },
    ]) as unknown) as typeof prisma.student.findMany;

  try {
    const response = await GET(new Request("http://localhost/api/students") as never);
    assert.equal(response.status, 200);
    const body = (await readJson(response)) as Array<{ activeLeasesCount: number }>;
    assert.equal(body[0]?.activeLeasesCount, 2);
  } finally {
    auth.api.getSession = originalGetSession;
    prisma.student.findMany = originalFindMany;
  }
});

test("POST /api/students rejects non-admin role", async () => {
  const { POST } = await import("@/app/api/students/route");
  const { auth } = await import("@/lib/auth");

  const originalGetSession = auth.api.getSession;
  auth.api.getSession = (async () => ({ user: { role: "USER" } })) as typeof auth.api.getSession;

  try {
    const response = await POST(
      new Request("http://localhost/api/students", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstname: "Anna", lastname: "Meyer", course: "10A" }),
      }) as never,
    );
    assert.equal(response.status, 403);
  } finally {
    auth.api.getSession = originalGetSession;
  }
});

test("POST /api/students creates with default SPECIAL status", async () => {
  const { POST } = await import("@/app/api/students/route");
  const { auth } = await import("@/lib/auth");
  const { prisma } = await import("@/lib/prisma");

  const originalGetSession = auth.api.getSession;
  const originalCreate = prisma.student.create;

  auth.api.getSession = (async () => ({ user: { role: "ADMIN" } })) as typeof auth.api.getSession;
  prisma.student.create =
    ((async (args: unknown) => {
      const createArgs = args as {
        data: {
          idOld: string | null;
          firstname: string;
          lastname: string;
          course: string;
          status: "ACTIVE" | "INACTIVE" | "SPECIAL";
        };
      };

      assert.equal(createArgs.data.status, "SPECIAL");
      return {
        id: 42,
        idOld: createArgs.data.idOld,
        firstname: createArgs.data.firstname,
        lastname: createArgs.data.lastname,
        course: createArgs.data.course,
        status: createArgs.data.status,
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
      };
    }) as unknown) as typeof prisma.student.create;

  try {
    const response = await POST(
      new Request("http://localhost/api/students", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstname: "Anna", lastname: "Meyer", course: "10A" }),
      }) as never,
    );

    assert.equal(response.status, 201);
    const body = (await readJson(response)) as { status: string; activeLeasesCount: number };
    assert.equal(body.status, "SPECIAL");
    assert.equal(body.activeLeasesCount, 0);
  } finally {
    auth.api.getSession = originalGetSession;
    prisma.student.create = originalCreate;
  }
});
