"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import { ItemIdInput } from "@/components/ui/item-id-input";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { useStudentSelection } from "@/components/providers/student-selection-provider";
import { itemIdSchema } from "@/lib/book-schemas";

type StudentRow = {
  id: number;
  idOld: string | null;
  firstname: string;
  lastname: string;
  course: string;
  status: "ACTIVE" | "INACTIVE" | "SPECIAL";
  activeLeasesCount: number;
};

type LeaseRow = {
  id: number;
  leasedAt: string;
  item: {
    id: string;
    book: {
      id: number;
      name: string;
    };
  };
};

type StudentLeasesResponse = {
  student: {
    id: number;
    idOld: string | null;
    firstname: string;
    lastname: string;
    course: string;
  };
  leases: LeaseRow[];
};

type LeaseResponse = {
  ok: boolean;
  leasedItem?: {
    id: string;
    book: {
      id: number;
      name: string;
    };
  };
  student?: {
    id: number;
    idOld: string | null;
    firstname: string;
    lastname: string;
    course: string;
    status: "ACTIVE" | "INACTIVE" | "SPECIAL";
  };
  activeLeases?: LeaseRow[];
  error?: string;
};

type ReturnResponse = {
  ok: boolean;
  error?: string;
};

const STUDENT_STATUS_LABELS: Record<StudentRow["status"], string> = {
  ACTIVE: "Aktiv",
  INACTIVE: "Inaktiv",
  SPECIAL: "Spezial",
};

type Props = {
  initialStudentId?: number | null;
};

export function LeaseWorkflow({ initialStudentId = null }: Props) {
  const { selectedStudentId, setSelectedStudentId, isSelectionHydrated } = useStudentSelection();
  const loadStudentLeasesRequestRef = useRef(0);
  const pendingRouteStudentIdRef = useRef<number | null>(initialStudentId);
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentQuery, setStudentQuery] = useState("");
  const [studentDraftId, setStudentDraftId] = useState<number | null>(null);
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);

  const [itemId, setItemId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [returningItemId, setReturningItemId] = useState<string | null>(null);

  const [activeLeases, setActiveLeases] = useState<LeaseRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filteredStudents = useMemo(() => {
    const query = studentQuery.trim().toLowerCase();
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
  }, [studentQuery, students]);

  const studentColumns = useMemo<ColumnDef<StudentRow>[]>(
    () => [
      {
        id: "selected",
        header: "Auswahl",
        enableSorting: false,
        cell: ({ row }) => (
          <input
            type="radio"
            name="lease-student"
            checked={studentDraftId === row.original.id}
            onChange={() => setStudentDraftId(row.original.id)}
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
    [studentDraftId],
  );

  async function loadStudents() {
    setStudentsLoading(true);
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
        setStudentDraftId((current) => current ?? loaded[0].id);
      }
    } catch {
      setError("Schüler konnten nicht geladen werden");
    } finally {
      setStudentsLoading(false);
    }
  }

  async function fetchStudentLeases(studentId: number) {
    const response = await fetch(`/api/students/${studentId}/leases`);
    const payload = (await response.json()) as StudentLeasesResponse | { error?: string };

    return { response, payload };
  }

  function applyStudentLeases(leasesResponse: StudentLeasesResponse) {
    setActiveLeases(leasesResponse.leases);

    setSelectedStudent((current) => {
      if (current && current.id === leasesResponse.student.id) {
        return { ...current, activeLeasesCount: leasesResponse.leases.length };
      }

      return {
        id: leasesResponse.student.id,
        idOld: leasesResponse.student.idOld,
        firstname: leasesResponse.student.firstname,
        lastname: leasesResponse.student.lastname,
        course: leasesResponse.student.course,
        status: "ACTIVE",
        activeLeasesCount: leasesResponse.leases.length,
      };
    });
  }

  useEffect(() => {
    if (!isSelectionHydrated) {
      return;
    }

    const resolvedStudentId = pendingRouteStudentIdRef.current ?? selectedStudentId;
    if (!resolvedStudentId) {
      return;
    }
    const targetStudentId = resolvedStudentId;

    const requestId = ++loadStudentLeasesRequestRef.current;

    async function syncSelectedStudentLeases() {
      const { response, payload } = await fetchStudentLeases(targetStudentId);

      // Ignore stale responses when selection changed while this request was in flight.
      if (requestId !== loadStudentLeasesRequestRef.current) {
        return;
      }

      if (!response.ok) {
        setError((payload as { error?: string }).error ?? "Ausleihen konnten nicht geladen werden");
        setActiveLeases([]);
        return;
      }

      applyStudentLeases(payload as StudentLeasesResponse);
      if (pendingRouteStudentIdRef.current === targetStudentId) {
        pendingRouteStudentIdRef.current = null;
        if (selectedStudentId !== targetStudentId) {
          setSelectedStudentId(targetStudentId);
        }
      }
    }

    void syncSelectedStudentLeases();
  }, [isSelectionHydrated, selectedStudentId, setSelectedStudentId]);

  async function openStudentModal() {
    setStudentModalOpen(true);
    if (students.length === 0) {
      await loadStudents();
    }
  }

  async function confirmStudentSelection() {
    if (!studentDraftId) {
      setError("Bitte einen Schüler auswählen");
      return;
    }

    const chosen = students.find((student) => student.id === studentDraftId) ?? null;
    if (!chosen) {
      setError("Gewählter Schüler ist nicht verfügbar");
      return;
    }

    setSelectedStudentId(chosen.id);
    setStudentModalOpen(false);
    setError(null);
    setSuccess(null);
    setItemId("");
  }

  async function leaseByItemId(normalizedItemId: string) {
    if (!selectedStudent) {
      setError("Bitte zuerst einen Schüler auswählen");
      return false;
    }

    if (!itemIdSchema.safeParse(normalizedItemId).success) {
      setError("Ungültige Item-ID. Erwartetes Format: RSV + 7 Ziffern (z. B. RSV0010000).");
      return false;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/items/${encodeURIComponent(normalizedItemId)}/lease`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: selectedStudent.id }),
      });

      const payload = (await response.json()) as LeaseResponse;
      if (!response.ok) {
        if (response.status === 404) {
          setError(`Item ${normalizedItemId} wurde nicht gefunden.`);
          return false;
        }
        if (response.status === 409) {
          setError(payload.error ?? `Item ${normalizedItemId} ist nicht verfügbar.`);
          return false;
        }
        setError(payload.error ?? "Ausleihe fehlgeschlagen");
        return false;
      }

      setSuccess(`Item ${normalizedItemId} wurde an ${selectedStudent.lastname}, ${selectedStudent.firstname} ausgeliehen`);
      setActiveLeases(payload.activeLeases ?? []);
      return true;
    } catch {
      setError("Ausleihe fehlgeschlagen");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReturnLeaseItem(itemIdToReturn: string) {
    if (!selectedStudent) {
      return;
    }

    setReturningItemId(itemIdToReturn);
    setError(null);
    setSuccess(null);

    try {
      const returnResponse = await fetch(`/api/items/${encodeURIComponent(itemIdToReturn)}/return`, {
        method: "POST",
      });

      const returnPayload = (await returnResponse.json()) as ReturnResponse;
      if (!returnResponse.ok) {
        setError(returnPayload.error ?? "Rückgabe fehlgeschlagen");
        return;
      }

      const { response: leasesResponse, payload: leasesPayload } = await fetchStudentLeases(selectedStudent.id);
      if (leasesResponse.ok) {
        applyStudentLeases(leasesPayload as StudentLeasesResponse);
      }
      setSuccess(`Item ${itemIdToReturn} wurde zurückgegeben`);
    } catch {
      setError("Rückgabe fehlgeschlagen");
    } finally {
      setReturningItemId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-black/10 bg-[#f2f4f8] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#131820]">Schüler</p>
            {selectedStudent ? (
              <p className="mt-1 text-sm text-[#364152]">
                {selectedStudent.lastname}, {selectedStudent.firstname}
                {selectedStudent.idOld ? ` · ID: ${selectedStudent.idOld}` : ""}
                {` · Klasse: ${selectedStudent.course}`}
              </p>
            ) : (
              <p className="mt-1 text-sm text-[#6b7280]">Noch kein Schüler ausgewählt</p>
            )}
          </div>

          <Button size="sm" variant="outline" onClick={() => void openStudentModal()}>
            {selectedStudent ? "Schüler wechseln" : "Schüler auswählen"}
          </Button>
        </div>

        {selectedStudent ? (
          <>
            <ItemIdInput
              id="lease-item-id"
              label="Item-ID (Scanner)"
              value={itemId}
              onValueChange={(value) => {
                setItemId(value);
                if (value.trim()) {
                  setError(null);
                }
              }}
              onInvalidValue={(value) => {
                if (value.trim().length > 0) {
                  setError("Ungültige Item-ID. Erwartetes Format: RSV + 7 Ziffern (z. B. RSV0010000).");
                }
              }}
              onSubmit={(normalized) => leaseByItemId(normalized)}
              clearOnSubmit
              flavor="lease"
              className="w-full"
              keepFocus
              disableWhileSubmitting={false}
              autoSubmitOnValid
              autoSubmitMinLength={10}
              clearOnInvalidPrefix
              ariaLabel="Item-ID für Ausleihe"
            />
            <p className="text-xs text-[#4b5563]">Erwartetes Format: RSV + 7 Ziffern (z. B. RSV0010000).</p>
          </>
        ) : (
          <div className="rounded-md border border-dashed border-black/20 bg-white/70 p-3 text-sm text-[#4b5563]">
            Wähle zuerst einen Schüler aus. Danach ist die Item-Eingabe aktiv.
          </div>
        )}

      </div>

      {success ? <p className="text-sm font-medium text-green-700">{success}</p> : null}
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      {selectedStudent ? (
        <div className="space-y-3 rounded-lg border border-black/10 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-[#131820]">Aktive Ausleihen</h2>
          </div>

          {activeLeases.length === 0 ? (
            <p className="text-sm text-[#4b5563]">Keine aktiven Ausleihen für diesen Schüler.</p>
          ) : (
            <div className="overflow-hidden rounded-md border border-black/10">
              <table className="w-full text-sm">
                <thead className="bg-[#f2f4f8]">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-[#364152]">Buchtitel</th>
                    <th className="px-3 py-2 text-left font-medium text-[#364152]">Item-ID</th>
                    <th className="px-3 py-2 text-left font-medium text-[#364152]">Ausgeliehen am</th>
                    <th className="px-3 py-2 text-right font-medium text-[#364152]">Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {activeLeases.map((lease) => (
                    <tr key={lease.id}>
                      <td className="px-3 py-2">
                        <Link href={`/books/${lease.item.book.id}?itemId=${lease.item.id}`} className="text-[#006b2d] hover:underline">
                          {lease.item.book.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{lease.item.id}</td>
                      <td className="px-3 py-2">{new Date(lease.leasedAt).toLocaleDateString("de-DE")}</td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => void handleReturnLeaseItem(lease.item.id)}
                          disabled={Boolean(returningItemId) || isSubmitting}
                        >
                          {returningItemId === lease.item.id ? "Rückgabe..." : "Zurückgeben"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {studentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-4 shadow-lg">
            <h3 className="text-lg font-semibold text-[#131820]">Schüler auswählen</h3>
            <p className="mt-1 text-sm text-[#364152]">Wähle den Schüler für die nächste Ausleihe.</p>

            <div className="mt-3 space-y-2">
              <label htmlFor="lease-student-search" className="block text-xs font-medium text-[#364152]">
                Schüler suchen
              </label>
              <input
                id="lease-student-search"
                value={studentQuery}
                onChange={(event) => setStudentQuery(event.target.value)}
                className="w-full rounded border border-black/20 bg-white px-2 py-1 text-sm"
                placeholder="Name, alte ID, Kurs oder Status"
                aria-label="Schüler suchen"
              />
            </div>

            <div className="mt-3 rounded border border-black/10 p-2">
              {studentsLoading ? (
                <p className="py-6 text-center text-sm text-[#4b5563]">Schüler werden geladen...</p>
              ) : (
                <DataTable
                  columns={studentColumns}
                  data={filteredStudents}
                  emptyMessage="Keine Treffer"
                  initialPageSize={10}
                  pageSizeOptions={[10, 20, 50]}
                  enableSorting
                  onRowClick={(student) => setStudentDraftId(student.id)}
                />
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setStudentModalOpen(false)}>
                Abbrechen
              </Button>
              <Button size="sm" onClick={() => void confirmStudentSelection()} disabled={studentsLoading || !studentDraftId}>
                Übernehmen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
