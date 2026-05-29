import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSchoolYear, parseWibCsvPayload } from "@/lib/student-import-wib";

test("parseWibCsvPayload parses valid WiB CSV rows", () => {
  const csv = ["Klasse;Familienname;Rufname", "10A;Schmidt;Anna", "9B;Meyer;Tom"].join("\n");

  const result = parseWibCsvPayload(csv);
  assert.equal(result.issues.length, 0);
  assert.deepEqual(result.entries.map((entry) => entry.entry), [
    { course: "10A", lastname: "Schmidt", firstname: "Anna" },
    { course: "9B", lastname: "Meyer", firstname: "Tom" },
  ]);
});

test("parseWibCsvPayload reports missing name fields as issues", () => {
  const csv = ["Klasse;Familienname;Rufname", "10A;Schmidt;", "10A;;Anna"].join("\n");

  const result = parseWibCsvPayload(csv);
  assert.equal(result.entries.length, 0);
  assert.equal(result.issues.length, 2);
  assert.equal(result.issues[0]?.line, 2);
});

test("parseWibCsvPayload throws when required headers are missing", () => {
  const csv = ["klasse;name", "10A;Anna Schmidt"].join("\n");

  assert.throws(() => parseWibCsvPayload(csv), /CSV-Header muss Klasse, Familienname und Rufname enthalten/);
});

test("normalizeSchoolYear normalizes input variants", () => {
  assert.equal(normalizeSchoolYear("2024"), "2024/2025");
  assert.equal(normalizeSchoolYear("2024/2025"), "2024/2025");
  assert.equal(normalizeSchoolYear("2024 / 2025"), "2024/2025");
});
