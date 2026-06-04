"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";

type StudentStatus = "ACTIVE" | "INACTIVE" | "SPECIAL";

export type StudentRow = {
  id: number;
  idOld: string | null;
  firstname: string;
  lastname: string;
  course: string;
  status: StudentStatus;
  activeLeasesCount: number;
  createdAt: string;
};

type Props = {
  initialStudents: StudentRow[];
  canManage: boolean;
  canCreate: boolean;
};

type StudentGradeHistoryRow = {
  id: number;
  schoolYear: string;
  grade: string;
  source: string;
  updatedAt: string;
};

type StudentLeaseHistoryRow = {
  id: number;
  leasedAt: string;
  returnedAt: string | null;
  active: boolean;
  item: {
    id: string;
    book: {
      id: number;
      name: string;
    };
  };
};

const STUDENT_STATUSES: StudentStatus[] = ["ACTIVE", "INACTIVE", "SPECIAL"];

const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  ACTIVE: "Aktiv",
  INACTIVE: "Inaktiv",
  SPECIAL: "Spezial",
};

export function StudentsManager({ initialStudents, canManage, canCreate }: Props) {
  const router = useRouter();
  const [students, setStudents] = useState<StudentRow[]>(initialStudents);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyStudent, setHistoryStudent] = useState<StudentRow | null>(null);
  const [historyGradeRows, setHistoryGradeRows] = useState<StudentGradeHistoryRow[]>([]);
  const [historyLeaseRows, setHistoryLeaseRows] = useState<StudentLeaseHistoryRow[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
  const [editIdOld, setEditIdOld] = useState("");
  const [editFirstname, setEditFirstname] = useState("");
  const [editLastname, setEditLastname] = useState("");
  const [editCourse, setEditCourse] = useState("");
  const [editStatus, setEditStatus] = useState<StudentStatus>("ACTIVE");
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createIdOld, setCreateIdOld] = useState("");
  const [createFirstname, setCreateFirstname] = useState("");
  const [createLastname, setCreateLastname] = useState("");
  const [createCourse, setCreateCourse] = useState("");
  const [createStatus, setCreateStatus] = useState<StudentStatus>("SPECIAL");

  const columns: ColumnDef<StudentRow>[] = [
    {
      accessorKey: "idOld",
      header: "Alte ID",
      enableSorting: false,
      cell: ({ row }) => <span>{row.original.idOld ?? "-"}</span>,
    },
    {
      accessorKey: "lastname",
      header: "Nachname",
      enableSorting: true,
      sortingFn: (rowA, rowB) => rowA.original.lastname.localeCompare(rowB.original.lastname, "de"),
    },
    {
      accessorKey: "firstname",
      header: "Vorname",
      enableSorting: true,
      sortingFn: (rowA, rowB) => rowA.original.firstname.localeCompare(rowB.original.firstname, "de"),
    },
    {
      accessorKey: "course",
      header: "Kurs",
      enableSorting: true,
      sortingFn: (rowA, rowB) => rowA.original.course.localeCompare(rowB.original.course, "de"),
    },
    {
      accessorKey: "status",
      header: "Status",
      enableSorting: false,
      cell: ({ row }) => {
        const student = row.original;
        if (!canManage) {
          return STUDENT_STATUS_LABELS[student.status];
        }

        return (
          <select
            value={student.status}
            className="rounded border border-black/20 bg-white px-2 py-1 text-xs"
            onChange={(event) => {
              void handleUpdateStatus(student.id, event.target.value as StudentStatus);
            }}
            aria-label={`Status für ${student.firstname} ${student.lastname}`}
          >
            {STUDENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STUDENT_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      id: "history",
      header: "Verlauf",
      enableSorting: false,
      cell: ({ row }) => (
        <Button size="xs" variant="outline" onClick={() => void handleOpenHistory(row.original)}>
          Verlauf
        </Button>
      ),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: "Aktionen",
            enableSorting: false,
            cell: ({ row }: { row: { original: StudentRow } }) => (
              <Button size="xs" variant="outline" onClick={() => openEditStudent(row.original)}>
                Bearbeiten
              </Button>
            ),
          } satisfies ColumnDef<StudentRow>,
        ]
      : []),
    {
      id: "activeLeasesCount",
      accessorFn: (row) => row.activeLeasesCount,
      header: "Ausgeliehen",
      enableSorting: true,
      sortingFn: (rowA, rowB) => rowA.original.activeLeasesCount - rowB.original.activeLeasesCount,
      cell: ({ row }) => (
        <span className={row.original.activeLeasesCount > 0 ? "font-medium text-amber-700" : "text-[#364152]"}>
          {row.original.activeLeasesCount}
        </span>
      ),
    },
    {
      id: "createdAt",
      accessorFn: (row) => row.createdAt,
      header: "Importiert",
      enableSorting: false,
      cell: ({ row }) => <span>{new Date(row.original.createdAt).toLocaleDateString("de-DE")}</span>,
    },
  ];

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return students;
    }

    return students.filter((student) => {
      const haystack = [
        student.idOld ?? "",
        student.firstname,
        student.lastname,
        `${student.firstname} ${student.lastname}`,
        student.course,
        STUDENT_STATUS_LABELS[student.status],
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [students, searchQuery]);

  async function handleUpdateStatus(id: number, status: StudentStatus) {
    setError(null);
    setInfo(null);

    const res = await fetch(`/api/students/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const payload = (await res.json()) as { error?: string; status?: StudentStatus };
    if (!res.ok) {
      setError(payload.error ?? "Status konnte nicht gespeichert werden");
      return;
    }

    setStudents((prev) => prev.map((student) => (student.id === id ? { ...student, status } : student)));
  }

  async function handleOpenHistory(student: StudentRow) {
    setHistoryOpen(true);
    setHistoryStudent(student);
    setHistoryGradeRows([]);
    setHistoryLeaseRows([]);
    setHistoryError(null);
    setHistoryLoading(true);

    try {
      const [gradeRes, leaseRes] = await Promise.all([
        fetch(`/api/students/${student.id}/grade-history`),
        fetch(`/api/students/${student.id}/lease-history`),
      ]);

      const [gradePayload, leasePayload] = (await Promise.all([
        gradeRes.json(),
        leaseRes.json(),
      ])) as [{ error?: string } | StudentGradeHistoryRow[], { error?: string } | StudentLeaseHistoryRow[]];

      if (!gradeRes.ok) {
        const err = gradePayload as { error?: string };
        setHistoryError(err.error ?? "Klassenverlauf konnte nicht geladen werden");
        return;
      }

      if (!leaseRes.ok) {
        const err = leasePayload as { error?: string };
        setHistoryError(err.error ?? "Ausleihverlauf konnte nicht geladen werden");
        return;
      }

      setHistoryGradeRows(gradePayload as StudentGradeHistoryRow[]);
      setHistoryLeaseRows(leasePayload as StudentLeaseHistoryRow[]);
    } finally {
      setHistoryLoading(false);
    }
  }

  function handleCloseHistory() {
    setHistoryOpen(false);
    setHistoryStudent(null);
    setHistoryGradeRows([]);
    setHistoryLeaseRows([]);
    setHistoryError(null);
    setHistoryLoading(false);
  }

  function openEditStudent(student: StudentRow) {
    setInfo(null);
    setEditingStudentId(student.id);
    setEditIdOld(student.idOld ?? "");
    setEditFirstname(student.firstname);
    setEditLastname(student.lastname);
    setEditCourse(student.course);
    setEditStatus(student.status);
    setEditOpen(true);
  }

  function closeEditStudent() {
    setEditOpen(false);
    setEditingStudentId(null);
    setEditSaving(false);
  }

  async function saveEditStudent() {
    if (!editingStudentId) {
      return;
    }

    setEditSaving(true);
    setError(null);
    setInfo(null);

    const res = await fetch(`/api/students/${editingStudentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idOld: editIdOld.trim() || null,
        firstname: editFirstname,
        lastname: editLastname,
        course: editCourse,
        status: editStatus,
      }),
    });
    const payload = (await res.json()) as { error?: string } & StudentRow;
    if (!res.ok) {
      setError(payload.error ?? "Schüler konnte nicht gespeichert werden");
      setEditSaving(false);
      return;
    }

    setStudents((prev) =>
      prev.map((student) => (student.id === editingStudentId ? { ...student, ...payload, createdAt: payload.createdAt } : student)),
    );
    setEditSaving(false);
    closeEditStudent();
  }

  function openCreateStudent() {
    setInfo(null);
    setError(null);
    setCreateIdOld("");
    setCreateFirstname("");
    setCreateLastname("");
    setCreateCourse("");
    setCreateStatus("SPECIAL");
    setCreateOpen(true);
  }

  function closeCreateStudent() {
    setCreateOpen(false);
    setCreateSaving(false);
  }

  async function saveCreateStudent() {
    setCreateSaving(true);
    setError(null);
    setInfo(null);

    const res = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idOld: createIdOld.trim() || null,
        firstname: createFirstname,
        lastname: createLastname,
        course: createCourse,
        status: createStatus,
      }),
    });

    const payload = (await res.json()) as ({ error?: string } & Partial<StudentRow>);
    if (!res.ok) {
      setError(payload.error ?? "Schüler konnte nicht erstellt werden");
      setCreateSaving(false);
      return;
    }

    const created = payload as StudentRow;
    setStudents((prev) =>
      [...prev, created].sort((left, right) => {
        const byLast = left.lastname.localeCompare(right.lastname, "de");
        if (byLast !== 0) {
          return byLast;
        }

        const byFirst = left.firstname.localeCompare(right.firstname, "de");
        if (byFirst !== 0) {
          return byFirst;
        }

        return (left.idOld ?? "").localeCompare(right.idOld ?? "", "de");
      }),
    );

    setInfo(`Schüler ${created.lastname}, ${created.firstname} wurde erstellt`);
    setCreateSaving(false);
    closeCreateStudent();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-black/10 bg-[#f2f4f8] p-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="students-search" className="text-xs font-medium text-[#364152]">
            Schüler suchen
          </label>
          <input
            id="students-search"
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Name, alte ID, Kurs oder Status"
            className="w-72 rounded border border-black/20 bg-white px-2 py-1 text-sm outline-none focus:border-[#006b2d]"
            aria-label="Schüler suchen"
          />
        </div>
      </div>

      {canCreate ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={openCreateStudent}>
            + Schüler hinzufügen
          </Button>
        </div>
      ) : null}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {info && <p className="text-sm text-green-700">{info}</p>}

      <DataTable
        columns={columns}
        data={filteredStudents}
        emptyMessage="Keine Schüler gefunden."
        enableSorting
        onRowClick={(student) => router.push(`/lease?studentId=${student.id}`)}
      />

      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-lg bg-white p-4 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-[#131820]">Schülerverlauf</h3>
                <p className="mt-1 text-sm text-[#364152]">
                  {historyStudent ? `${historyStudent.firstname} ${historyStudent.lastname}` : "Schüler"}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={handleCloseHistory}>
                Schließen
              </Button>
            </div>

            <h4 className="mt-3 text-sm font-semibold text-[#131820]">Klassenverlauf</h4>
            <div className="mt-2 max-h-64 overflow-auto rounded border border-black/10">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-[#f2f4f8] text-left">
                  <tr>
                    <th className="px-3 py-2">Schuljahr</th>
                    <th className="px-3 py-2">Klasse</th>
                    <th className="px-3 py-2">Quelle</th>
                    <th className="px-3 py-2">Aktualisiert</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-[#364152]">
                        Verlauf wird geladen...
                      </td>
                    </tr>
                  ) : historyError ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-red-600">
                        {historyError}
                      </td>
                    </tr>
                  ) : historyGradeRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-[#364152]">
                        Kein Verlauf vorhanden.
                      </td>
                    </tr>
                  ) : (
                    historyGradeRows.map((row) => (
                      <tr key={row.id} className="border-t border-black/10">
                        <td className="px-3 py-2">{row.schoolYear}</td>
                        <td className="px-3 py-2">{row.grade}</td>
                        <td className="px-3 py-2">{row.source}</td>
                        <td className="px-3 py-2">{new Date(row.updatedAt).toLocaleDateString("de-DE")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <h4 className="mt-4 text-sm font-semibold text-[#131820]">Ausleihverlauf</h4>
            <div className="mt-2 max-h-72 overflow-auto rounded border border-black/10">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-[#f2f4f8] text-left">
                  <tr>
                    <th className="px-3 py-2">Buch</th>
                    <th className="px-3 py-2">Item-ID</th>
                    <th className="px-3 py-2">Ausgeliehen</th>
                    <th className="px-3 py-2">Zurückgegeben</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-[#364152]">
                        Verlauf wird geladen...
                      </td>
                    </tr>
                  ) : historyError ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-red-600">
                        {historyError}
                      </td>
                    </tr>
                  ) : historyLeaseRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-[#364152]">
                        Keine Ausleihen vorhanden.
                      </td>
                    </tr>
                  ) : (
                    historyLeaseRows.map((row) => (
                      <tr key={row.id} className="border-t border-black/10">
                        <td className="px-3 py-2">{row.item.book.name}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.item.id}</td>
                        <td className="px-3 py-2">{new Date(row.leasedAt).toLocaleDateString("de-DE")}</td>
                        <td className="px-3 py-2">
                          {row.returnedAt ? new Date(row.returnedAt).toLocaleDateString("de-DE") : "-"}
                        </td>
                        <td className="px-3 py-2">
                          {row.active ? (
                            <span className="font-medium text-amber-700">Aktiv</span>
                          ) : (
                            <span className="font-medium text-green-700">Zurückgegeben</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow-lg">
            <h3 className="text-lg font-semibold text-[#131820]">Schüler bearbeiten</h3>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="edit-student-id-old" className="mb-1 block text-xs font-medium text-[#364152]">
                  Alte ID
                </label>
                <input
                  id="edit-student-id-old"
                  value={editIdOld}
                  onChange={(event) => setEditIdOld(event.target.value)}
                  className="w-full rounded border border-black/20 bg-white px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label htmlFor="edit-student-course" className="mb-1 block text-xs font-medium text-[#364152]">
                  Kurs
                </label>
                <input
                  id="edit-student-course"
                  value={editCourse}
                  onChange={(event) => setEditCourse(event.target.value)}
                  className="w-full rounded border border-black/20 bg-white px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label htmlFor="edit-student-firstname" className="mb-1 block text-xs font-medium text-[#364152]">
                  Vorname
                </label>
                <input
                  id="edit-student-firstname"
                  value={editFirstname}
                  onChange={(event) => setEditFirstname(event.target.value)}
                  className="w-full rounded border border-black/20 bg-white px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label htmlFor="edit-student-lastname" className="mb-1 block text-xs font-medium text-[#364152]">
                  Nachname
                </label>
                <input
                  id="edit-student-lastname"
                  value={editLastname}
                  onChange={(event) => setEditLastname(event.target.value)}
                  className="w-full rounded border border-black/20 bg-white px-2 py-1 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="edit-student-status" className="mb-1 block text-xs font-medium text-[#364152]">
                  Status
                </label>
                <select
                  id="edit-student-status"
                  value={editStatus}
                  onChange={(event) => setEditStatus(event.target.value as StudentStatus)}
                  className="w-full rounded border border-black/20 bg-white px-2 py-1 text-sm"
                >
                  {STUDENT_STATUSES.map((statusValue) => (
                    <option key={statusValue} value={statusValue}>
                      {STUDENT_STATUS_LABELS[statusValue]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={closeEditStudent} disabled={editSaving}>
                Abbrechen
              </Button>
              <Button size="sm" onClick={() => void saveEditStudent()} disabled={editSaving}>
                Speichern
              </Button>
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow-lg">
            <h3 className="text-lg font-semibold text-[#131820]">Schüler manuell anlegen</h3>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="create-student-id-old" className="mb-1 block text-xs font-medium text-[#364152]">
                  Alte ID
                </label>
                <input
                  id="create-student-id-old"
                  value={createIdOld}
                  onChange={(event) => setCreateIdOld(event.target.value)}
                  className="w-full rounded border border-black/20 bg-white px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label htmlFor="create-student-course" className="mb-1 block text-xs font-medium text-[#364152]">
                  Kurs
                </label>
                <input
                  id="create-student-course"
                  value={createCourse}
                  onChange={(event) => setCreateCourse(event.target.value)}
                  className="w-full rounded border border-black/20 bg-white px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label htmlFor="create-student-firstname" className="mb-1 block text-xs font-medium text-[#364152]">
                  Vorname
                </label>
                <input
                  id="create-student-firstname"
                  value={createFirstname}
                  onChange={(event) => setCreateFirstname(event.target.value)}
                  className="w-full rounded border border-black/20 bg-white px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label htmlFor="create-student-lastname" className="mb-1 block text-xs font-medium text-[#364152]">
                  Nachname
                </label>
                <input
                  id="create-student-lastname"
                  value={createLastname}
                  onChange={(event) => setCreateLastname(event.target.value)}
                  className="w-full rounded border border-black/20 bg-white px-2 py-1 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="create-student-status" className="mb-1 block text-xs font-medium text-[#364152]">
                  Status
                </label>
                <select
                  id="create-student-status"
                  value={createStatus}
                  onChange={(event) => setCreateStatus(event.target.value as StudentStatus)}
                  className="w-full rounded border border-black/20 bg-white px-2 py-1 text-sm"
                >
                  {STUDENT_STATUSES.map((statusValue) => (
                    <option key={statusValue} value={statusValue}>
                      {STUDENT_STATUS_LABELS[statusValue]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={closeCreateStudent} disabled={createSaving}>
                Abbrechen
              </Button>
              <Button
                size="sm"
                onClick={() => void saveCreateStudent()}
                disabled={createSaving || !createFirstname.trim() || !createLastname.trim()}
              >
                Erstellen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}