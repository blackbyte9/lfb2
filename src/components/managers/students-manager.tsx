"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { StudentHistoryButton } from "@/components/buttons/student-history-button";

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

type MergeField = "target" | "source";
type MergeFields = {
  idOld: MergeField;
  firstname: MergeField;
  lastname: MergeField;
  course: MergeField;
  status: MergeField;
};

const DEFAULT_MERGE_FIELDS: MergeFields = {
  idOld: "target",
  firstname: "target",
  lastname: "target",
  course: "target",
  status: "target",
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

  // --- merge state ---
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSaving, setMergeSaving] = useState(false);
  const [mergeTargetStudent, setMergeTargetStudent] = useState<StudentRow | null>(null);
  const [mergeSourceId, setMergeSourceId] = useState<number | null>(null);
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeFields, setMergeFields] = useState<MergeFields>(DEFAULT_MERGE_FIELDS);

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
        <StudentHistoryButton
          size="xs"
          variant="outline"
          student={{
            id: row.original.id,
            firstname: row.original.firstname,
            lastname: row.original.lastname,
          }}
        />
      ),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: "Aktionen",
            enableSorting: false,
            cell: ({ row }: { row: { original: StudentRow } }) => (
              <div className="flex gap-1">
                <Button size="xs" variant="outline" onClick={() => openEditStudent(row.original)}>
                  Bearbeiten
                </Button>
                <Button size="xs" variant="outline" onClick={() => openMerge(row.original)}>
                  Zusammenführen
                </Button>
              </div>
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

  // --- merge derived values ---
  const mergeSourceStudent = mergeSourceId !== null ? (students.find((s) => s.id === mergeSourceId) ?? null) : null;
  const mergeStudentOptions = useMemo(() => {
    if (!mergeTargetStudent) return [];
    const query = mergeSearch.trim().toLowerCase();
    return students
      .filter((s) => s.id !== mergeTargetStudent.id)
      .filter((s) => {
        if (!query) return true;
        const hay = [s.lastname, s.firstname, s.course, s.idOld ?? ""].join(" ").toLowerCase();
        return hay.includes(query);
      });
  }, [students, mergeTargetStudent, mergeSearch]);

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

  function openMerge(student: StudentRow) {
    setInfo(null);
    setError(null);
    setMergeTargetStudent(student);
    setMergeSourceId(null);
    setMergeSearch("");
    setMergeFields(DEFAULT_MERGE_FIELDS);
    setMergeOpen(true);
  }

  function closeMerge() {
    setMergeOpen(false);
    setMergeTargetStudent(null);
    setMergeSourceId(null);
    setMergeSaving(false);
  }

  async function saveMerge() {
    if (!mergeTargetStudent || !mergeSourceId) return;
    setMergeSaving(true);
    setError(null);
    setInfo(null);

    const res = await fetch(`/api/students/${mergeTargetStudent.id}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId: mergeSourceId, fields: mergeFields }),
    });
    const payload = (await res.json()) as { error?: string } & Partial<StudentRow>;
    if (!res.ok) {
      setError(payload.error ?? "Zusammenführen fehlgeschlagen");
      setMergeSaving(false);
      return;
    }

    const merged = payload as StudentRow;
    setStudents((prev) =>
      prev
        .filter((s) => s.id !== mergeSourceId)
        .map((s) => (s.id === mergeTargetStudent.id ? { ...s, ...merged } : s)),
    );
    setInfo(`${merged.lastname}, ${merged.firstname} wurde erfolgreich zusammengeführt.`);
    setMergeSaving(false);
    closeMerge();
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
        onRowClick={(student) => router.push(`/lease/${student.id}`)}
      />

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

      {mergeOpen && mergeTargetStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-[#131820]">Schüler zusammenführen</h3>
            <p className="mt-1 text-sm text-[#364152]">
              Wähle einen zweiten Schüler. Alle Ausleihen, Noten-Verlauf und Kommentare beider Schüler werden
              zusammengeführt.{" "}
              <strong>Der zweite Schüler wird anschließend dauerhaft gelöscht.</strong>
            </p>

            <div className="mt-3 rounded border border-[#006b2d]/30 bg-green-50 px-3 py-2 text-sm">
              <span className="font-medium text-[#006b2d]">Bleibt erhalten: </span>
              {mergeTargetStudent.lastname}, {mergeTargetStudent.firstname} – {mergeTargetStudent.course}
              {mergeTargetStudent.idOld ? ` (ID: ${mergeTargetStudent.idOld})` : ""}
            </div>

            <div className="mt-4 space-y-2">
              <label htmlFor="merge-search" className="text-xs font-medium text-[#364152]">
                Zweiten Schüler wählen (wird gelöscht)
              </label>
              <input
                id="merge-search"
                type="text"
                value={mergeSearch}
                onChange={(e) => setMergeSearch(e.target.value)}
                placeholder="Name oder Kurs…"
                className="w-full rounded border border-black/20 px-2 py-1 text-sm outline-none focus:border-[#006b2d]"
              />
              <div className="max-h-44 overflow-y-auto rounded border border-black/10">
                {mergeStudentOptions.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-[#6b7280]">Keine Schüler gefunden</p>
                ) : (
                  mergeStudentOptions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setMergeSourceId(s.id)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-[#f2f4f8] ${mergeSourceId === s.id ? "bg-[#006b2d]/10 font-medium" : ""}`}
                    >
                      {s.lastname}, {s.firstname} – {s.course}
                      {s.idOld ? ` (ID: ${s.idOld})` : ""}
                      {s.activeLeasesCount > 0 ? ` · ${s.activeLeasesCount} aktive Ausleihe(n)` : ""}
                    </button>
                  ))
                )}
              </div>
            </div>

            {mergeSourceStudent && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium text-[#364152]">Welche Werte sollen erhalten bleiben?</p>
                <div className="overflow-x-auto rounded border border-black/10">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-black/10 bg-[#f2f4f8] text-xs text-[#364152]">
                        <th className="px-3 py-2 text-left font-medium">Feld</th>
                        <th className="px-3 py-2 text-left font-medium">
                          <span className="font-semibold text-[#006b2d]">Behalten</span>
                          <br />
                          <span className="font-normal">
                            {mergeTargetStudent.lastname}, {mergeTargetStudent.firstname}
                          </span>
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          <span className="font-semibold text-red-600">Löschen</span>
                          <br />
                          <span className="font-normal">
                            {mergeSourceStudent.lastname}, {mergeSourceStudent.firstname}
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ["firstname", "Vorname", mergeTargetStudent.firstname, mergeSourceStudent.firstname],
                          ["lastname", "Nachname", mergeTargetStudent.lastname, mergeSourceStudent.lastname],
                          ["course", "Kurs", mergeTargetStudent.course, mergeSourceStudent.course],
                          ["idOld", "Alte ID", mergeTargetStudent.idOld ?? "–", mergeSourceStudent.idOld ?? "–"],
                          [
                            "status",
                            "Status",
                            STUDENT_STATUS_LABELS[mergeTargetStudent.status],
                            STUDENT_STATUS_LABELS[mergeSourceStudent.status],
                          ],
                        ] as [keyof MergeFields, string, string, string][]
                      ).map(([field, label, targetVal, sourceVal]) => (
                        <tr key={field} className="border-b border-black/5 last:border-0">
                          <td className="px-3 py-2 text-xs font-medium text-[#364152]">{label}</td>
                          <td className="px-3 py-2">
                            <label className="flex cursor-pointer items-center gap-2">
                              <input
                                type="radio"
                                name={`merge-field-${field}`}
                                checked={mergeFields[field] === "target"}
                                onChange={() => setMergeFields((prev) => ({ ...prev, [field]: "target" }))}
                              />
                              <span className={targetVal === "–" ? "text-[#9ca3af]" : ""}>{targetVal}</span>
                            </label>
                          </td>
                          <td className="px-3 py-2">
                            <label className="flex cursor-pointer items-center gap-2">
                              <input
                                type="radio"
                                name={`merge-field-${field}`}
                                checked={mergeFields[field] === "source"}
                                onChange={() => setMergeFields((prev) => ({ ...prev, [field]: "source" }))}
                              />
                              <span className={sourceVal === "–" ? "text-[#9ca3af]" : ""}>{sourceVal}</span>
                            </label>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={closeMerge} disabled={mergeSaving}>
                Abbrechen
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => void saveMerge()}
                disabled={!mergeSourceId || mergeSaving}
              >
                Zusammenführen & Löschen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}