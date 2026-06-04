import assert from "node:assert/strict";
import test from "node:test";

import { ensureTestEnv, readJson } from "../../../../../../helpers";

ensureTestEnv();

test("GET /api/students/[id]/grade-history rejects guest role", async () => {
  const { GET } = await import("@/app/api/students/[id]/grade-history/route");
  const { auth } = await import("@/lib/auth");

  const originalGetSession = auth.api.getSession;
  auth.api.getSession = (async () => ({ user: { role: "GUEST" } })) as typeof auth.api.getSession;

  try {
    const response = await GET(new Request("http://localhost/api/students/1/grade-history") as never, {
      params: Promise.resolve({ id: "1" }),
    });
    assert.equal(response.status, 403);
  } finally {
    auth.api.getSession = originalGetSession;
  }
});

test("GET /api/students/[id]/grade-history accepts admin role", async () => {
  const { GET } = await import("@/app/api/students/[id]/grade-history/route");
  const { auth } = await import("@/lib/auth");
  const { prisma } = await import("@/lib/prisma");

  const originalGetSession = auth.api.getSession;
  const originalFindMany = prisma.studentGradeHistory.findMany;
  auth.api.getSession = (async () => ({ user: { role: "ADMIN" } })) as typeof auth.api.getSession;
  prisma.studentGradeHistory.findMany = (async () => []) as unknown as typeof prisma.studentGradeHistory.findMany;

  try {
    const response = await GET(new Request("http://localhost/api/students/1/grade-history") as never, {
      params: Promise.resolve({ id: "1" }),
    });
    assert.equal(response.status, 200);
  } finally {
    auth.api.getSession = originalGetSession;
    prisma.studentGradeHistory.findMany = originalFindMany;
  }
});

test("GET /api/students/[id]/grade-history validates id and returns history", async () => {
  const { GET } = await import("@/app/api/students/[id]/grade-history/route");
  const { auth } = await import("@/lib/auth");
  const { prisma } = await import("@/lib/prisma");

  const originalGetSession = auth.api.getSession;
  const originalFindMany = prisma.studentGradeHistory.findMany;

  auth.api.getSession = (async () => ({ user: { role: "USER" } })) as typeof auth.api.getSession;
  prisma.studentGradeHistory.findMany = (async () => [
    {
      id: 5,
      schoolYear: "2025/2026",
      grade: "2",
      source: "manual",
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  ]) as unknown as typeof prisma.studentGradeHistory.findMany;

  try {
    const invalid = await GET(new Request("http://localhost/api/students/x/grade-history") as never, {
      params: Promise.resolve({ id: "x" }),
    });
    assert.equal(invalid.status, 400);

    const response = await GET(new Request("http://localhost/api/students/1/grade-history") as never, {
      params: Promise.resolve({ id: "1" }),
    });
    assert.equal(response.status, 200);
    const body = (await readJson(response)) as Array<{ id: number }>;
    assert.equal(body[0]?.id, 5);
  } finally {
    auth.api.getSession = originalGetSession;
    prisma.studentGradeHistory.findMany = originalFindMany;
  }
});
