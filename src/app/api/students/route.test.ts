import assert from "node:assert/strict";
import test from "node:test";

import { ensureTestEnv, readJson } from "@/test/helpers";

ensureTestEnv();

test("GET /api/students rejects guest role", async () => {
  const { GET } = await import("./route");
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
  const { GET } = await import("./route");
  const { auth } = await import("@/lib/auth");
  const { prisma } = await import("@/lib/prisma");

  const originalGetSession = auth.api.getSession;
  const originalFindMany = prisma.student.findMany;

  auth.api.getSession = (async () => ({ user: { role: "USER" } })) as typeof auth.api.getSession;
  prisma.student.findMany = (async () => [
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
  ]) as typeof prisma.student.findMany;

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
