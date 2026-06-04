"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { useStudentSelection } from "@/components/generic/student-selection-provider";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";

type StudentStatus = "ACTIVE" | "INACTIVE" | "SPECIAL";

type StudentRow = {
  id: number;
  idOld: string | null;
  firstname: string;
  lastname: string;
  course: string;
  status: StudentStatus;
  activeLeasesCount: number;
};

const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  ACTIVE: "Aktiv",
  INACTIVE: "Inaktiv",
  SPECIAL: "Spezial",
};

type Props = {
  hasSelectedStudent: boolean;
  onStudentSelected?: (studentId: number) => void;
};

export function StudentSelectorButton({ hasSelectedStudent, onStudentSelected }: Props) {
  const { setSelectedStudentId } = useStudentSelection();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [query, setQuery] = useState("");
  const [draftId, setDraftId] = useState<number | null>(null);

  const filteredStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
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

      return haystack.includes(normalizedQuery);
    });
  }, [query, students]);

  const columns = useMemo<ColumnDef<StudentRow>[]>(
    () => [
      {
        id: "selected",
        header: "Auswahl",
        enableSorting: false,
        cell: ({ row }) => (
          <input
            type="radio"
            name="workflow-student"
            checked={draftId === row.original.id}
            onChange={() => setDraftId(row.original.id)}
            aria-label={`Schüler ${row.original.lastname}, ${row.original.firstname} auswählen`}
          />
        ),
      },
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
    ],
    [draftId],
  );

  async function loadStudents() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/students");
      const payload = (await response.json()) as StudentRow[] | { error?: string };

      if (!response.ok) {
        setError((payload as { error?: string }).error ?? "Schüler konnten nicht geladen werden");
        return;
      }

      const loaded = payload as StudentRow[];
      setStudents(loaded);
      if (loaded.length > 0) {
        setDraftId((current) => current ?? loaded[0].id);
      }
    } catch {
      setError("Schüler konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }

  async function openModal() {
    setOpen(true);
    setError(null);

    if (students.length === 0) {
      await loadStudents();
    }
  }

  function closeModal() {
    setOpen(false);
  }

  function confirmSelection() {
    if (!draftId) {
      setError("Bitte einen Schüler auswählen");
      return;
    }

    setSelectedStudentId(draftId);
    onStudentSelected?.(draftId);
    setOpen(false);
    setError(null);
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => void openModal()}>
        {hasSelectedStudent ? "Schüler wechseln" : "Schüler auswählen"}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-4 shadow-lg">
            <h3 className="text-lg font-semibold text-[#131820]">Schüler auswählen</h3>
            <p className="mt-1 text-sm text-[#364152]">Wähle den Schüler für den Workflow.</p>

            <div className="mt-3 space-y-2">
              <label htmlFor="workflow-student-search" className="block text-xs font-medium text-[#364152]">
                Schüler suchen
              </label>
              <input
                id="workflow-student-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded border border-black/20 bg-white px-2 py-1 text-sm"
                placeholder="Name, alte ID, Kurs oder Status"
                aria-label="Schüler suchen"
              />
            </div>

            {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}

            <div className="mt-3 rounded border border-black/10 p-2">
              {loading ? (
                <p className="py-6 text-center text-sm text-[#4b5563]">Schüler werden geladen...</p>
              ) : (
                <DataTable
                  columns={columns}
                  data={filteredStudents}
                  emptyMessage="Keine Treffer"
                  initialPageSize={10}
                  pageSizeOptions={[10, 20, 50]}
                  enableSorting
                  onRowClick={(student) => setDraftId(student.id)}
                />
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={closeModal}>
                Abbrechen
              </Button>
              <Button size="sm" onClick={confirmSelection} disabled={loading || !draftId}>
                Übernehmen
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
