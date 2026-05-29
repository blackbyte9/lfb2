import assert from "node:assert/strict";
import test from "node:test";

import { buildStudentNameFixProposals } from "@/lib/student-name-fixes";

test("buildStudentNameFixProposals fixes cp1252/utf8 mojibake names", () => {
  const fixes = buildStudentNameFixProposals([
    {
      id: 1,
      idOld: "1001",
      firstname: "JÃ¶rg",
      lastname: "SchÃ¤fer",
    },
  ]);

  assert.equal(fixes.length, 1);
  assert.equal(fixes[0]?.firstnameAfter, "Jörg");
  assert.equal(fixes[0]?.lastnameAfter, "Schäfer");
});

test("buildStudentNameFixProposals repairs replacement-character corruption", () => {
  const fixes = buildStudentNameFixProposals([
    {
      id: 2,
      idOld: "1002",
      firstname: "Lena",
      lastname: "Sch�fer",
    },
  ]);

  assert.equal(fixes.length, 1);
  assert.equal(fixes[0]?.lastnameAfter, "Schäfer");
});

test("buildStudentNameFixProposals skips already valid names", () => {
  const fixes = buildStudentNameFixProposals([
    {
      id: 3,
      idOld: "1003",
      firstname: "Anna",
      lastname: "Meyer",
    },
  ]);

  assert.equal(fixes.length, 0);
});
