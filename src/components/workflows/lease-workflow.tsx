"use client";

import { useEffect, useRef, useState } from "react";

import { ActiveLeaseTableRow, type ActiveLeaseTableRowData } from "@/components/rows/active-lease-table-row";
import { ItemIdInput } from "@/components/ui/item-id-input";
import { Button } from "@/components/ui/button";
import { useStudentSelection } from "@/components/generic/student-selection-provider";
import { StudentWorkflowSection } from "@/components/workflows/student-workflow-section";
import { itemIdSchema } from "@/lib/book-schemas";

type StudentSummary = {
  id: number;
  idOld: string | null;
  firstname: string;
  lastname: string;
  course: string;
};

type SelectedStudent = StudentSummary & {
  status: "ACTIVE" | "INACTIVE" | "SPECIAL";
  activeLeasesCount: number;
};

type LeaseRow = ActiveLeaseTableRowData;

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

type Props = {
  initialStudentId?: number | null;
  resetSelectionOnMount?: boolean;
};

export function LeaseWorkflow({ initialStudentId = null, resetSelectionOnMount = false }: Props) {
  const { selectedStudentId, setSelectedStudentId, isSelectionHydrated } = useStudentSelection();
  const loadStudentLeasesRequestRef = useRef(0);
  const pendingRouteStudentIdRef = useRef<number | null>(initialStudentId);
  const [selectedStudent, setSelectedStudent] = useState<SelectedStudent | null>(null);

  const [itemId, setItemId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [returningItemId, setReturningItemId] = useState<string | null>(null);

  const [activeLeases, setActiveLeases] = useState<LeaseRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isSelectionHydrated || !resetSelectionOnMount) {
      return;
    }

    pendingRouteStudentIdRef.current = null;
    if (selectedStudentId !== null) {
      setSelectedStudentId(null);
    }
  }, [isSelectionHydrated, resetSelectionOnMount, selectedStudentId, setSelectedStudentId]);


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
        // If routed or globally selected student id is no longer valid, reset to empty workflow state.
        pendingRouteStudentIdRef.current = null;
        setSelectedStudentId(null);
        setSelectedStudent(null);
        setActiveLeases([]);
        setError(null);
        setSuccess(null);
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
      <StudentWorkflowSection
        student={selectedStudent}
        onStudentSelected={() => {
          setError(null);
          setSuccess(null);
          setItemId("");
          setSelectedStudent(null);
          setActiveLeases([]);
        }}
      >

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

      </StudentWorkflowSection>

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
                    <ActiveLeaseTableRow
                      key={lease.id}
                      lease={lease}
                      actionCell={
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => void handleReturnLeaseItem(lease.item.id)}
                          disabled={Boolean(returningItemId) || isSubmitting}
                        >
                          {returningItemId === lease.item.id ? "Rückgabe..." : "Zurückgeben"}
                        </Button>
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

    </div>
  );
}
