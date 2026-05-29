import assert from "node:assert/strict";
import test from "node:test";

import { canAccessStudents } from "@/lib/students-access";

test("students access is restricted to USER and ADMIN", () => {
  assert.equal(canAccessStudents(undefined), false);
  assert.equal(canAccessStudents(null), false);
  assert.equal(canAccessStudents(""), false);
  assert.equal(canAccessStudents("GUEST"), false);
  assert.equal(canAccessStudents("USER"), true);
  assert.equal(canAccessStudents("ADMIN"), true);
});
