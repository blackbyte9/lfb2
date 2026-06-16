import { z } from "zod";

import { ItemStatus, StudentStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Export shape
// ---------------------------------------------------------------------------

export type AppDataExport = {
  version: 1;
  exportedAt: string;
  books: ExportedBook[];
  items: ExportedItem[];
  students: ExportedStudent[];
  leases: ExportedLease[];
  comments: ExportedComment[];
};

export type ExportedBook = {
  isbn: string;
  name: string;
  createdAt: string;
};

export type ExportedItem = {
  id: string;
  status: string;
  bookIsbn: string;
  createdAt: string;
};

export type ExportedStudent = {
  /** Original database id – used only for cross-references within this file. */
  _exportId: number;
  idOld: string | null;
  firstname: string;
  lastname: string;
  course: string;
  status: string;
  createdAt: string;
  gradeHistory: ExportedGradeHistory[];
};

export type ExportedGradeHistory = {
  schoolYear: string;
  grade: string;
  source: string;
  createdAt: string;
};

export type ExportedLease = {
  leasedAt: string;
  returnedAt: string | null;
  active: boolean;
  itemId: string;
  studentExportId: number;
};

export type ExportedComment = {
  itemId: string;
  studentExportId: number | null;
  body: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function exportAllAppData(): Promise<AppDataExport> {
  const [books, items, students, leases, comments] = await Promise.all([
    prisma.book.findMany({ orderBy: { id: "asc" } }),
    prisma.item.findMany({ orderBy: { id: "asc" } }),
    prisma.student.findMany({
      orderBy: { id: "asc" },
      include: { gradeHistory: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.lease.findMany({ orderBy: { id: "asc" } }),
    prisma.comment.findMany({ orderBy: { id: "asc" } }),
  ]);

  const bookIsbnById = new Map(books.map((b) => [b.id, b.isbn]));

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    books: books.map((b) => ({
      isbn: b.isbn,
      name: b.name,
      createdAt: b.createdAt.toISOString(),
    })),
    items: items.map((i) => ({
      id: i.id,
      status: i.status,
      bookIsbn: bookIsbnById.get(i.bookId) ?? "",
      createdAt: i.createdAt.toISOString(),
    })),
    students: students.map((s) => ({
      _exportId: s.id,
      idOld: s.idOld,
      firstname: s.firstname,
      lastname: s.lastname,
      course: s.course,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      gradeHistory: s.gradeHistory.map((g) => ({
        schoolYear: g.schoolYear,
        grade: g.grade,
        source: g.source,
        createdAt: g.createdAt.toISOString(),
      })),
    })),
    leases: leases.map((l) => ({
      leasedAt: l.leasedAt.toISOString(),
      returnedAt: l.returnedAt?.toISOString() ?? null,
      active: l.active,
      itemId: l.itemId,
      studentExportId: l.studentId,
    })),
    comments: comments.map((c) => ({
      itemId: c.itemId,
      studentExportId: c.studentId,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}

// ---------------------------------------------------------------------------
// Import schema (Zod)
// ---------------------------------------------------------------------------

const gradeHistorySchema = z.object({
  schoolYear: z.string().min(1),
  grade: z.string().min(1),
  source: z.string().min(1),
  createdAt: z.string().datetime(),
});

const studentSchema = z.object({
  _exportId: z.number().int(),
  idOld: z.string().nullable(),
  firstname: z.string(),
  lastname: z.string(),
  course: z.string(),
  status: z.nativeEnum(StudentStatus),
  createdAt: z.string().datetime(),
  gradeHistory: z.array(gradeHistorySchema),
});

const appDataSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  books: z.array(
    z.object({
      isbn: z.string().min(1),
      name: z.string().min(1),
      createdAt: z.string().datetime(),
    }),
  ),
  items: z.array(
    z.object({
      id: z.string().min(1),
      status: z.nativeEnum(ItemStatus),
      bookIsbn: z.string().min(1),
      createdAt: z.string().datetime(),
    }),
  ),
  students: z.array(studentSchema),
  leases: z.array(
    z.object({
      leasedAt: z.string().datetime(),
      returnedAt: z.string().datetime().nullable(),
      active: z.boolean(),
      itemId: z.string().min(1),
      studentExportId: z.number().int(),
    }),
  ),
  comments: z.array(
    z.object({
      itemId: z.string().min(1),
      studentExportId: z.number().int().nullable(),
      body: z.string(),
      createdAt: z.string().datetime(),
    }),
  ),
});

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export type AppDataImportResult = {
  message: string;
  books: number;
  items: number;
  students: number;
  leases: number;
  comments: number;
};

export async function importAllAppData(json: unknown): Promise<AppDataImportResult> {
  const parsed = appDataSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(`Ungültiges Export-Format: ${first ? `${first.path.join(".")} – ${first.message}` : "unbekannter Fehler"}`);
  }

  const data = parsed.data;

  // Clear existing app data (same order as deleteAllAppDataAction)
  await prisma.$transaction([
    prisma.lease.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.item.deleteMany(),
    prisma.studentGradeHistory.deleteMany(),
    prisma.student.deleteMany(),
    prisma.book.deleteMany(),
  ]);

  // --- Books ---
  await prisma.book.createMany({
    data: data.books.map((b) => ({
      isbn: b.isbn,
      name: b.name,
      createdAt: new Date(b.createdAt),
      updatedAt: new Date(b.createdAt),
    })),
    skipDuplicates: true,
  });

  const bookRecords = await prisma.book.findMany({ select: { id: true, isbn: true } });
  const bookIdByIsbn = new Map(bookRecords.map((b) => [b.isbn, b.id]));

  // --- Items ---
  const itemsToCreate = data.items.filter((i) => bookIdByIsbn.has(i.bookIsbn));
  await prisma.item.createMany({
    data: itemsToCreate.map((i) => ({
      id: i.id,
      status: i.status,
      bookId: bookIdByIsbn.get(i.bookIsbn)!,
      createdAt: new Date(i.createdAt),
      updatedAt: new Date(i.createdAt),
    })),
    skipDuplicates: true,
  });

  const importedItemIds = new Set(itemsToCreate.map((i) => i.id));

  // --- Students ---
  await prisma.student.createMany({
    data: data.students.map((s) => ({
      idOld: s.idOld,
      firstname: s.firstname,
      lastname: s.lastname,
      course: s.course,
      status: s.status,
      createdAt: new Date(s.createdAt),
      updatedAt: new Date(s.createdAt),
    })),
    skipDuplicates: true,
  });

  // Build export-id → new db-id map.
  // Students are matched by idOld when set, otherwise by (firstname+lastname+course+createdAt).
  const importedStudents = await prisma.student.findMany({
    select: { id: true, idOld: true, firstname: true, lastname: true, course: true, createdAt: true },
  });

  const studentByIdOld = new Map(importedStudents.filter((s) => s.idOld !== null).map((s) => [s.idOld!, s.id]));

  // For students without idOld, key by fingerprint
  const fingerprint = (s: { firstname: string; lastname: string; course: string; createdAt: Date }) =>
    `${s.firstname}|${s.lastname}|${s.course}|${s.createdAt.toISOString()}`;
  const studentByFingerprint = new Map(
    importedStudents.filter((s) => s.idOld === null).map((s) => [fingerprint(s), s.id]),
  );

  const exportIdToNewId = new Map<number, number>();
  for (const s of data.students) {
    const newId =
      s.idOld !== null
        ? studentByIdOld.get(s.idOld)
        : studentByFingerprint.get(`${s.firstname}|${s.lastname}|${s.course}|${new Date(s.createdAt).toISOString()}`);
    if (newId !== undefined) {
      exportIdToNewId.set(s._exportId, newId);
    }
  }

  // --- Grade history ---
  const gradeHistoryRows = data.students.flatMap((s) => {
    const newId = exportIdToNewId.get(s._exportId);
    if (newId === undefined) return [];
    return s.gradeHistory.map((g) => ({
      studentId: newId,
      schoolYear: g.schoolYear,
      grade: g.grade,
      source: g.source,
      createdAt: new Date(g.createdAt),
      updatedAt: new Date(g.createdAt),
    }));
  });

  for (let i = 0; i < gradeHistoryRows.length; i += 500) {
    await prisma.studentGradeHistory.createMany({ data: gradeHistoryRows.slice(i, i + 500), skipDuplicates: true });
  }

  // --- Leases ---
  const leasesToCreate = data.leases
    .filter((l) => importedItemIds.has(l.itemId) && exportIdToNewId.has(l.studentExportId))
    .map((l) => ({
      leasedAt: new Date(l.leasedAt),
      returnedAt: l.returnedAt ? new Date(l.returnedAt) : null,
      active: l.active,
      itemId: l.itemId,
      studentId: exportIdToNewId.get(l.studentExportId)!,
    }));

  for (let i = 0; i < leasesToCreate.length; i += 500) {
    await prisma.lease.createMany({ data: leasesToCreate.slice(i, i + 500), skipDuplicates: true });
  }

  // --- Comments ---
  const commentsToCreate = data.comments
    .filter((c) => importedItemIds.has(c.itemId))
    .map((c) => ({
      itemId: c.itemId,
      studentId: c.studentExportId !== null ? (exportIdToNewId.get(c.studentExportId) ?? null) : null,
      body: c.body,
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.createdAt),
    }));

  for (let i = 0; i < commentsToCreate.length; i += 500) {
    await prisma.comment.createMany({ data: commentsToCreate.slice(i, i + 500) });
  }

  return {
    message: `Import abgeschlossen: ${data.books.length} Bücher, ${itemsToCreate.length} Items, ${data.students.length} Schüler, ${leasesToCreate.length} Ausleihen, ${commentsToCreate.length} Kommentare wiederhergestellt.`,
    books: data.books.length,
    items: itemsToCreate.length,
    students: data.students.length,
    leases: leasesToCreate.length,
    comments: commentsToCreate.length,
  };
}
