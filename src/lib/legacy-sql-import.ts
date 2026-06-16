import { ItemStatus, StudentStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { guessFixedText } from "@/lib/student-name-fixes";

// ---------------------------------------------------------------------------
// PostgreSQL COPY block parser
// ---------------------------------------------------------------------------

function parseCopyBlock(sql: string, tableName: string): { columns: string[]; rows: string[][] } {
  const escapedName = tableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `COPY public\\.${escapedName}\\s*\\(([^)]+)\\)\\s+FROM stdin;\\n([\\s\\S]*?)\\n\\\\.`,
    "m",
  );
  const match = sql.match(regex);
  if (!match) return { columns: [], rows: [] };

  const columns = match[1].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  const rows = match[2]
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => line.split("\t"));

  return { columns, rows };
}

function buildRowObject(columns: string[], row: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (let i = 0; i < columns.length; i++) {
    obj[columns[i]!] = row[i] ?? "";
  }
  return obj;
}

// ---------------------------------------------------------------------------
// ISBN normalisation
// ---------------------------------------------------------------------------

function normalizeIsbn(isbn: string): string {
  return isbn.replace(/[-\s]/g, "");
}

function isValidIsbn(isbn: string): boolean {
  return /^\d{10}(\d{3})?$/.test(isbn);
}

// ---------------------------------------------------------------------------
// Item status mapping  (old status_id integer → ItemStatus enum)
// ---------------------------------------------------------------------------

const ITEM_STATUS_MAP: Record<number, ItemStatus> = {
  0: ItemStatus.NEW,
  1: ItemStatus.USED,
  2: ItemStatus.DAMAGED,
  3: ItemStatus.REMOVED,
};

// ---------------------------------------------------------------------------
// Comment filter
// ---------------------------------------------------------------------------

const SKIP_COMMENT_PATTERNS = [
  /^created item$/i,
  /^created$/,
  /^lease item to\s/i,
  /^leased to\s/i,
  /^leased to$/i,
  /^return item from\s/i,
  /^returned from\s/i,
  /^status changed$/i,
];

function shouldSkipComment(comment: string): boolean {
  return SKIP_COMMENT_PATTERNS.some((p) => p.test(comment.trim()));
}

// ---------------------------------------------------------------------------
// Internal raw data types & parsers
// ---------------------------------------------------------------------------

type RawBook = { isbn: string; title: string };
type RawItem = { itemId: string; statusId: number; bookIsbn: string };
type RawStudent = { legacyId: number; firstname: string; lastname: string; grade: string; oldId: string };
type RawLease = { start: string; end: string; active: boolean; itemId: string; legacyStudentId: number };
type RawComment = { date: string; body: string; itemId: string };

function parseRawBooks(sql: string): RawBook[] {
  const { columns, rows } = parseCopyBlock(sql, "books_bookmodel");
  return rows.map((row) => {
    const o = buildRowObject(columns, row);
    return { isbn: o["isbn"] ?? "", title: o["title"] ?? "" };
  });
}

function parseRawItems(sql: string): RawItem[] {
  const { columns, rows } = parseCopyBlock(sql, "books_itemmodel");
  return rows.map((row) => {
    const o = buildRowObject(columns, row);
    return { itemId: o["itemId"] ?? "", statusId: parseInt(o["status_id"] ?? "1", 10), bookIsbn: o["book_id"] ?? "" };
  });
}

function parseRawStudents(sql: string): RawStudent[] {
  const { columns, rows } = parseCopyBlock(sql, "students_studentmodel");
  return rows.map((row) => {
    const o = buildRowObject(columns, row);
    return {
      legacyId: parseInt(o["id"] ?? "0", 10),
      firstname: o["first_name"] ?? "",
      lastname: o["last_name"] ?? "",
      grade: o["grade"] ?? "",
      oldId: o["old_id"] ?? "",
    };
  });
}

function parseRawLeases(sql: string): RawLease[] {
  const { columns, rows } = parseCopyBlock(sql, "leases_itemleasemodel");
  return rows.map((row) => {
    const o = buildRowObject(columns, row);
    return {
      start: o["start"] ?? "",
      end: o["end"] ?? "",
      active: o["active"] === "t",
      itemId: o["item_id"] ?? "",
      legacyStudentId: parseInt(o["student_id"] ?? "0", 10),
    };
  });
}

function parseRawComments(sql: string): RawComment[] {
  const { columns, rows } = parseCopyBlock(sql, "books_commentmodel");
  return rows.map((row) => {
    const o = buildRowObject(columns, row);
    return { date: o["date"] ?? "", body: o["comment"] ?? "", itemId: o["item_id"] ?? "" };
  });
}

// ---------------------------------------------------------------------------
// Preview types
// ---------------------------------------------------------------------------

export type LegacySqlPreviewBook = {
  originalIsbn: string;
  /** null when the ISBN cannot be reduced to a valid 10- or 13-digit number. */
  normalizedIsbn: string | null;
  name: string;
  itemCount: number;
};

export type LegacySqlPreviewStudent = {
  legacyId: number;
  originalFirstname: string;
  fixedFirstname: string;
  originalLastname: string;
  fixedLastname: string;
  grade: string;
  oldId: string;
  oldIdIsDuplicate: boolean;
};

export type LegacySqlPreview = {
  books: LegacySqlPreviewBook[];
  students: LegacySqlPreviewStudent[];
  totalItemCount: number;
  leaseCount: number;
  keepCommentCount: number;
  skipCommentCount: number;
};

// ---------------------------------------------------------------------------
// Preview function (no DB access)
// ---------------------------------------------------------------------------

export function previewLegacySql(sql: string): LegacySqlPreview {
  const rawBooks = parseRawBooks(sql);
  const rawItems = parseRawItems(sql);
  const rawStudents = parseRawStudents(sql);
  const rawLeases = parseRawLeases(sql);
  const rawComments = parseRawComments(sql);

  const itemCountByIsbn = new Map<string, number>();
  for (const item of rawItems) {
    itemCountByIsbn.set(item.bookIsbn, (itemCountByIsbn.get(item.bookIsbn) ?? 0) + 1);
  }

  const books: LegacySqlPreviewBook[] = rawBooks.map((b) => {
    const norm = normalizeIsbn(b.isbn);
    return {
      originalIsbn: b.isbn,
      normalizedIsbn: isValidIsbn(norm) ? norm : null,
      name: b.title,
      itemCount: itemCountByIsbn.get(b.isbn) ?? 0,
    };
  });

  const oldIdFreq = new Map<string, number>();
  for (const s of rawStudents) {
    const oid = s.oldId.trim();
    if (oid) oldIdFreq.set(oid, (oldIdFreq.get(oid) ?? 0) + 1);
  }

  const students: LegacySqlPreviewStudent[] = rawStudents.map((s) => ({
    legacyId: s.legacyId,
    originalFirstname: s.firstname,
    fixedFirstname: guessFixedText(s.firstname),
    originalLastname: s.lastname,
    fixedLastname: guessFixedText(s.lastname),
    grade: s.grade,
    oldId: s.oldId.trim(),
    oldIdIsDuplicate: (oldIdFreq.get(s.oldId.trim()) ?? 0) > 1,
  }));

  const skipCount = rawComments.filter((c) => shouldSkipComment(c.body)).length;

  return {
    books,
    students,
    totalItemCount: rawItems.length,
    leaseCount: rawLeases.length,
    keepCommentCount: rawComments.length - skipCount,
    skipCommentCount: skipCount,
  };
}

// ---------------------------------------------------------------------------
// Import overrides
// ---------------------------------------------------------------------------

export type LegacySqlImportOverrides = {
  /** For each broken-ISBN book: fixed ISBN to use, or null to explicitly exclude. */
  isbnFixes: Array<{ originalIsbn: string; fixedIsbn: string | null }>;
  /** Per-student name overrides (applied instead of the auto-fix). */
  studentNames: Array<{ legacyId: number; firstname: string; lastname: string }>;
};

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type LegacySqlImportResult = {
  message: string;
  books: number;
  items: number;
  students: number;
  leases: number;
  comments: number;
  skippedComments: number;
  brokenIsbns: string[];
};

// ---------------------------------------------------------------------------
// Main import function
// ---------------------------------------------------------------------------

export async function importLegacySql(
  sql: string,
  overrides: LegacySqlImportOverrides = { isbnFixes: [], studentNames: [] },
): Promise<LegacySqlImportResult> {
  const now = new Date();

  const rawBooks = parseRawBooks(sql);
  const rawItems = parseRawItems(sql);
  const rawStudents = parseRawStudents(sql);
  const rawLeases = parseRawLeases(sql);
  const rawComments = parseRawComments(sql);

  const commentsToKeep = rawComments.filter((c) => !shouldSkipComment(c.body));

  const isbnFixMap = new Map<string, string | null>(overrides.isbnFixes.map((f) => [f.originalIsbn, f.fixedIsbn]));
  const studentNameMap = new Map(overrides.studentNames.map((n) => [n.legacyId, { firstname: n.firstname, lastname: n.lastname }]));

  // ----- Resolve books -----
  const brokenIsbns: string[] = [];
  const booksToCreate: { isbn: string; name: string }[] = [];
  const isbnNormMap = new Map<string, string>();

  for (const book of rawBooks) {
    const norm = normalizeIsbn(book.isbn);
    if (isValidIsbn(norm)) {
      isbnNormMap.set(book.isbn, norm);
      booksToCreate.push({ isbn: norm, name: book.title });
    } else {
      const fix = isbnFixMap.get(book.isbn);
      if (fix === undefined) {
        brokenIsbns.push(book.isbn);
      } else if (fix !== null) {
        const fixNorm = normalizeIsbn(fix);
        if (isValidIsbn(fixNorm)) {
          isbnNormMap.set(book.isbn, fixNorm);
          booksToCreate.push({ isbn: fixNorm, name: book.title });
        } else {
          brokenIsbns.push(book.isbn);
        }
      }
      // fix === null → explicitly excluded
    }
  }

  // ----- Clear existing app data -----
  await prisma.$transaction([
    prisma.lease.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.item.deleteMany(),
    prisma.studentGradeHistory.deleteMany(),
    prisma.student.deleteMany(),
    prisma.book.deleteMany(),
  ]);

  // ----- Import books -----
  await prisma.book.createMany({ data: booksToCreate, skipDuplicates: true });

  const bookRecords = await prisma.book.findMany({ select: { id: true, isbn: true } });
  const bookByIsbn = new Map(bookRecords.map((b) => [b.isbn, b.id]));

  // ----- Import items -----
  const itemsToCreate = rawItems
    .filter((item) => {
      const finalIsbn = isbnNormMap.get(item.bookIsbn);
      return finalIsbn !== undefined && bookByIsbn.has(finalIsbn);
    })
    .map((item) => ({
      id: item.itemId,
      status: ITEM_STATUS_MAP[item.statusId] ?? ItemStatus.USED,
      bookId: bookByIsbn.get(isbnNormMap.get(item.bookIsbn)!)!,
    }));

  await prisma.item.createMany({ data: itemsToCreate, skipDuplicates: true });

  // ----- Import students -----
  const oldIdFrequency = new Map<string, number>();
  for (const s of rawStudents) {
    const oid = s.oldId.trim();
    if (oid) oldIdFrequency.set(oid, (oldIdFrequency.get(oid) ?? 0) + 1);
  }

  const studentsToCreate = rawStudents.map((s) => {
    const nameOverride = studentNameMap.get(s.legacyId);
    return {
      idOld: `legacy_${s.legacyId}`,
      firstname: nameOverride?.firstname ?? guessFixedText(s.firstname),
      lastname: nameOverride?.lastname ?? guessFixedText(s.lastname),
      course: s.grade,
      status: StudentStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    };
  });

  await prisma.student.createMany({ data: studentsToCreate, skipDuplicates: true });

  const importedStudents = await prisma.student.findMany({
    where: { idOld: { startsWith: "legacy_" } },
    select: { id: true, idOld: true },
  });
  const legacyToNewId = new Map<number, number>(
    importedStudents
      .filter((s) => s.idOld !== null)
      .map((s) => [parseInt(s.idOld!.slice(7), 10), s.id]),
  );

  // Sequential updates to avoid unique-index collisions
  for (const s of rawStudents) {
    const newId = legacyToNewId.get(s.legacyId);
    if (!newId) continue;
    const oid = s.oldId.trim();
    const idOld = oid && oldIdFrequency.get(oid) === 1 ? oid : null;
    await prisma.student.update({ where: { id: newId }, data: { idOld } });
  }

  // ----- Import grade history -----
  const currentSchoolYear = (() => {
    const year = now.getFullYear();
    return now.getMonth() >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  })();

  const gradeHistoryToCreate = rawStudents
    .filter((s) => s.grade.trim() && legacyToNewId.has(s.legacyId))
    .map((s) => ({
      studentId: legacyToNewId.get(s.legacyId)!,
      schoolYear: currentSchoolYear,
      grade: s.grade.trim(),
      source: "LEGACY_IMPORT",
      createdAt: now,
      updatedAt: now,
    }));

  if (gradeHistoryToCreate.length > 0) {
    await prisma.studentGradeHistory.createMany({ data: gradeHistoryToCreate, skipDuplicates: true });
  }

  // ----- Import leases -----
  const itemIdSet = new Set(itemsToCreate.map((i) => i.id));

  const leasesToCreate = rawLeases
    .filter((l) => legacyToNewId.has(l.legacyStudentId) && itemIdSet.has(l.itemId))
    .map((l) => ({
      studentId: legacyToNewId.get(l.legacyStudentId)!,
      itemId: l.itemId,
      leasedAt: new Date(l.start),
      returnedAt: l.active ? null : new Date(l.end),
      active: l.active,
    }));

  for (let i = 0; i < leasesToCreate.length; i += 500) {
    await prisma.lease.createMany({ data: leasesToCreate.slice(i, i + 500), skipDuplicates: true });
  }

  // ----- Import non-redundant comments -----
  const commentsToCreate = commentsToKeep
    .filter((c) => itemIdSet.has(c.itemId))
    .map((c) => ({
      itemId: c.itemId,
      body: c.body.trim(),
      createdAt: new Date(c.date),
      updatedAt: new Date(c.date),
    }));

  for (let i = 0; i < commentsToCreate.length; i += 500) {
    await prisma.comment.createMany({ data: commentsToCreate.slice(i, i + 500), skipDuplicates: true });
  }

  return {
    message: `Import abgeschlossen: ${booksToCreate.length} Bücher, ${itemsToCreate.length} Items, ${studentsToCreate.length} Schüler, ${leasesToCreate.length} Ausleihen, ${commentsToCreate.length} Kommentare importiert.${brokenIsbns.length > 0 ? ` ${brokenIsbns.length} ISBN(s) konnten nicht normalisiert werden.` : ""}`,
    books: booksToCreate.length,
    items: itemsToCreate.length,
    students: studentsToCreate.length,
    leases: leasesToCreate.length,
    comments: commentsToCreate.length,
    skippedComments: rawComments.length - commentsToKeep.length,
    brokenIsbns,
  };
}
