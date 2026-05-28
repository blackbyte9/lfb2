import assert from "node:assert/strict";
import test from "node:test";

import { ensureTestEnv } from "@/test/helpers";

ensureTestEnv();

test("PATCH /api/students/[id] rejects guest role", async () => {
  const { PATCH } = await import("./route");
  const { auth } = await import("@/lib/auth");

  const originalGetSession = auth.api.getSession;
  auth.api.getSession = (async () => ({ user: { role: "GUEST" } })) as typeof auth.api.getSession;

  try {
    const request = new Request("http://localhost/api/students/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstname: "Anna" }),
    });
    const response = await PATCH(request as never, { params: Promise.resolve({ id: "1" }) });
    assert.equal(response.status, 403);
  } finally {
    auth.api.getSession = originalGetSession;
  }
});

test("PATCH /api/students/[id] validates id and payload", async () => {
  const { PATCH } = await import("./route");
  const { auth } = await import("@/lib/auth");

  const originalGetSession = auth.api.getSession;
  auth.api.getSession = (async () => ({ user: { role: "USER" } })) as typeof auth.api.getSession;

  try {
    const invalidIdReq = new Request("http://localhost/api/students/x", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstname: "Anna" }),
    });
    const invalidIdRes = await PATCH(invalidIdReq as never, { params: Promise.resolve({ id: "x" }) });
    assert.equal(invalidIdRes.status, 400);

    const invalidStatusReq = new Request("http://localhost/api/students/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "UNKNOWN" }),
    });
    const invalidStatusRes = await PATCH(invalidStatusReq as never, { params: Promise.resolve({ id: "1" }) });
    assert.equal(invalidStatusRes.status, 400);

    const emptyReq = new Request("http://localhost/api/students/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const emptyRes = await PATCH(emptyReq as never, { params: Promise.resolve({ id: "1" }) });
    assert.equal(emptyRes.status, 400);
  } finally {
    auth.api.getSession = originalGetSession;
  }
});

test("PATCH /api/students/[id] maps unique-constraint error to 409", async () => {
  const { PATCH } = await import("./route");
  const { auth } = await import("@/lib/auth");
  const { prisma } = await import("@/lib/prisma");

  const originalGetSession = auth.api.getSession;
  const originalUpdate = prisma.student.update;

  auth.api.getSession = (async () => ({ user: { role: "ADMIN" } })) as typeof auth.api.getSession;
  prisma.student.update = (async () => {
    throw new Error("Unique constraint failed");
  }) as typeof prisma.student.update;

  try {
    const request = new Request("http://localhost/api/students/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idOld: "1001" }),
    });

    const response = await PATCH(request as never, { params: Promise.resolve({ id: "1" }) });
    assert.equal(response.status, 409);
  } finally {
    auth.api.getSession = originalGetSession;
    prisma.student.update = originalUpdate;
  }
});
