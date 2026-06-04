import assert from "node:assert/strict";
import test from "node:test";

import { ensureTestEnv, readJson } from "../../../../../../helpers";

ensureTestEnv();

test("GET /api/students/[id]/history rejects guest role", async () => {
  const { GET } = await import("@/app/api/students/[id]/history/route");
  const { auth } = await import("@/lib/auth");

  const originalGetSession = auth.api.getSession;
  auth.api.getSession = (async () => ({ user: { role: "GUEST" } })) as typeof auth.api.getSession;

  try {
    const response = await GET(new Request("http://localhost/api/students/1/history") as never, {
      params: Promise.resolve({ id: "1" }),
    });
    assert.equal(response.status, 403);
  } finally {
    auth.api.getSession = originalGetSession;
  }
});

test("GET /api/students/[id]/history returns merged events in chronological order", async () => {
  const { GET } = await import("@/app/api/students/[id]/history/route");
  const { auth } = await import("@/lib/auth");
  const { prisma } = await import("@/lib/prisma");

  const originalGetSession = auth.api.getSession;
  const originalStudentFindUnique = prisma.student.findUnique;
  const originalLeaseFindMany = prisma.lease.findMany;
  const originalCommentFindMany = prisma.comment.findMany;
  const originalGradeFindMany = prisma.studentGradeHistory.findMany;

  auth.api.getSession = (async () => ({ user: { role: "USER" } })) as typeof auth.api.getSession;
  prisma.student.findUnique = (async () => ({ id: 7 })) as unknown as typeof prisma.student.findUnique;
  prisma.studentGradeHistory.findMany = (async () => [
    {
      id: 5,
      schoolYear: "2025/2026",
      grade: "10A",
      source: "WIB",
      updatedAt: new Date("2026-01-01T08:00:00.000Z"),
    },
  ]) as unknown as typeof prisma.studentGradeHistory.findMany;
  prisma.lease.findMany = (async () => [
    {
      id: 1,
      leasedAt: new Date("2026-01-02T08:00:00.000Z"),
      returnedAt: new Date("2026-01-03T08:00:00.000Z"),
      active: false,
      item: {
        id: "RSV1",
        book: {
          id: 11,
          name: "Deutsch 10",
        },
      },
    },
  ]) as unknown as typeof prisma.lease.findMany;
  prisma.comment.findMany = (async () => [
    {
      id: 9,
      body: "Kommentar zum Item",
      createdAt: new Date("2026-01-02T12:00:00.000Z"),
      item: {
        id: "RSV1",
        book: {
          id: 11,
          name: "Deutsch 10",
        },
      },
    },
  ]) as unknown as typeof prisma.comment.findMany;

  try {
    const response = await GET(new Request("http://localhost/api/students/7/history") as never, {
      params: Promise.resolve({ id: "7" }),
    });

    assert.equal(response.status, 200);
    const body = (await readJson(response)) as {
      student: { id: number };
      events: Array<{ type: string; id: string; body?: string; item?: { id: string }; schoolYear?: string }>;
    };

    assert.equal(body.student.id, 7);
    assert.deepEqual(body.events.map((event) => event.type), ["GRADE_IMPORT", "LEASED", "COMMENT", "RETURNED"]);
    assert.equal(body.events[2]?.body, "Kommentar zum Item");
    assert.equal(body.events[1]?.item?.id, "RSV1");
  } finally {
    auth.api.getSession = originalGetSession;
    prisma.student.findUnique = originalStudentFindUnique;
    prisma.lease.findMany = originalLeaseFindMany;
    prisma.comment.findMany = originalCommentFindMany;
    prisma.studentGradeHistory.findMany = originalGradeFindMany;
  }
});
