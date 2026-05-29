import assert from "node:assert/strict";
import test from "node:test";

import { parseLeaseImportPayload } from "@/lib/lease-import";

test("parseLeaseImportPayload parses valid entries", () => {
  const payload = [
    {
      leased: "2026-01-12T10:00:00.000Z",
      returned: null,
      active: true,
      itemId: "RSV001",
      studentId: "12345",
    },
  ];

  const result = parseLeaseImportPayload(payload);
  assert.equal(result.issues.length, 0);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0]?.entry.itemId, "RSV001");
});

test("parseLeaseImportPayload reports schema validation errors", () => {
  const payload = [
    {
      leased: "invalid-date",
      returned: null,
      active: true,
      itemId: "",
      studentId: "12345",
    },
  ];

  const result = parseLeaseImportPayload(payload);
  assert.equal(result.entries.length, 0);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]?.line, 1);
});

test("parseLeaseImportPayload throws if payload is not an array", () => {
  assert.throws(() => parseLeaseImportPayload({} as unknown[]), /JSON-Array/);
});
