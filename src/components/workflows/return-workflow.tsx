"use client";

import { useEffect, useRef, useState } from "react";
import { ActiveLeaseTableRow, type ActiveLeaseTableRowData } from "@/components/rows/active-lease-table-row";
import { StudentWorkflowSection } from "@/components/workflows/student-workflow-section";
import { itemIdSchema } from "@/lib/book-schemas";
import { useStudentSelection } from "@/components/generic/student-selection-provider";
import { ItemIdInput } from "@/components/ui/item-id-input";

type LeaseRow = ActiveLeaseTableRowData;

type StudentSummary = {
  id: number;
  idOld: string | null;
  firstname: string;
  lastname: string;
  course: string;
};

type StudentLeasesResponse = {
  student: StudentSummary;
  leases: LeaseRow[];
  error?: string;
};

type SelectedStudentSnapshot = {
  studentId: number;
  student: StudentSummary;
  leases: LeaseRow[];
};

type ReturnResponse = {
  ok: boolean;
  returnedItem?: {
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
  };
  remainingLeases?: LeaseRow[];
  error?: string;
};

type Props = {
  initialStudentId?: number | null;
  resetSelectionOnMount?: boolean;
};

export function ReturnWorkflow({ initialStudentId = null, resetSelectionOnMount = false }: Props) {
  const { selectedStudentId, setSelectedStudentId, isSelectionHydrated } = useStudentSelection();
  const selectedStudentRequestRef = useRef(0);
  const pendingRouteStudentIdRef = useRef<number | null>(initialStudentId);
  const [itemId, setItemId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSelectedStudent, setIsLoadingSelectedStudent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnResponse | null>(null);
  const [selectedStudentSnapshot, setSelectedStudentSnapshot] = useState<SelectedStudentSnapshot | null>(null);

  useEffect(() => {
    if (!isSelectionHydrated || !resetSelectionOnMount) {
      return;
    }

    pendingRouteStudentIdRef.current = null;
    if (selectedStudentId !== null) {
      setSelectedStudentId(null);
    }
  }, [isSelectionHydrated, resetSelectionOnMount, selectedStudentId, setSelectedStudentId]);

  useEffect(() => {
    if (!isSelectionHydrated) {
      return;
    }

    const resolvedStudentId = pendingRouteStudentIdRef.current ?? selectedStudentId;
    if (!resolvedStudentId) {
      return;
    }

    const targetStudentId = resolvedStudentId;

    const requestId = ++selectedStudentRequestRef.current;

    async function loadSelectedStudent() {
      setIsLoadingSelectedStudent(true);
      try {
        const response = await fetch(`/api/students/${targetStudentId}/leases`);
        const payload = (await response.json()) as StudentLeasesResponse;

        if (requestId !== selectedStudentRequestRef.current) {
          return;
        }

        if (!response.ok) {
          // If routed or globally selected student id is no longer valid, reset to empty workflow state.
          pendingRouteStudentIdRef.current = null;
          setSelectedStudentId(null);
          setSelectedStudentSnapshot((current) => {
            if (current?.studentId !== targetStudentId) {
              return current;
            }
            return null;
          });
          setResult(null);
          setError(null);
          setSuccess(null);
          return;
        }

        setSelectedStudentSnapshot({
          studentId: targetStudentId,
          student: payload.student,
          leases: payload.leases,
        });

        if (pendingRouteStudentIdRef.current === targetStudentId) {
          pendingRouteStudentIdRef.current = null;
          if (selectedStudentId !== targetStudentId) {
            setSelectedStudentId(targetStudentId);
          }
        }
      } finally {
        if (requestId === selectedStudentRequestRef.current) {
          setIsLoadingSelectedStudent(false);
        }
      }
    }

    void loadSelectedStudent();
  }, [isSelectionHydrated, selectedStudentId, setSelectedStudentId]);

  async function submitReturnByItemId(normalized: string, immediateClear = false) {
    if (immediateClear) {
      setItemId("");
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/items/${encodeURIComponent(normalized)}/return`, {
        method: "POST",
      });

      const payload = (await response.json()) as ReturnResponse;

      if (!response.ok) {
        setError(payload.error ?? "Rückgabe fehlgeschlagen");
        setResult(null);
        return;
      }

      setResult(payload);
      if (payload.student?.id) {
        setSelectedStudentId(payload.student.id);
        setSelectedStudentSnapshot({
          studentId: payload.student.id,
          student: payload.student,
          leases: payload.remainingLeases ?? [],
        });
      }
      setSuccess(`Item ${normalized} wurde zurückgegeben`);
      if (!immediateClear) {
        setItemId("");
      }
    } catch {
      setError("Rückgabe fehlgeschlagen");
      setResult(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitByItemId(normalized: string) {
    if (!itemIdSchema.safeParse(normalized).success) {
      setError("Ungültige Item-ID");
      return;
    }

    await submitReturnByItemId(normalized, true);
  }

  const selectedSnapshotForCurrentId =
    selectedStudentId && selectedStudentSnapshot?.studentId === selectedStudentId ? selectedStudentSnapshot : null;
  const displayStudent = result?.student ?? selectedSnapshotForCurrentId?.student ?? null;
  const displayLeases = result?.student ? (result.remainingLeases ?? []) : (selectedSnapshotForCurrentId?.leases ?? []);

  return (
    <div className="space-y-4">
      <StudentWorkflowSection
        student={displayStudent}
        onStudentSelected={() => {
          setResult(null);
          setSelectedStudentSnapshot(null);
          setError(null);
          setSuccess(null);
        }}
      >
        <ItemIdInput
          id="return-item-id"
          label="Item-ID (Scanner)"
          value={itemId}
          onValueChange={(value) => {
            setItemId(value);
            if (!value.trim()) {
              setError(null);
            }
          }}
          onSubmit={(normalized) => handleSubmitByItemId(normalized)}
          flavor="return"
          className="w-full"
          keepFocus
          disableWhileSubmitting={false}
          autoSubmitOnValid
          autoSubmitMinLength={10}
          clearOnInvalidPrefix
          ariaLabel="Item-ID für Rückgabe"
        />
        <p className="mt-2 text-xs text-[#4b5563]">Die Rückgabe startet automatisch, sobald das Format `RSV0000000` vollständig ist.</p>
      </StudentWorkflowSection>

      {success ? <p className="text-sm font-medium text-green-700">{success}</p> : null}
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      {isLoadingSelectedStudent && !displayStudent ? <p className="text-sm text-[#364152]">Schülerdaten werden geladen...</p> : null}

      {displayStudent ? (
        <div className="space-y-4 rounded-lg border border-black/10 bg-white p-4">
          <h3 className="text-sm font-semibold text-[#131820]">Aktive Ausleihen</h3>

          {displayLeases.length === 0 ? (
            <p className="text-sm text-[#4b5563]">Keine weiteren aktiven Ausleihen.</p>
          ) : (
            <div className="overflow-hidden rounded-md border border-black/10">
              <table className="w-full text-sm">
                <thead className="bg-[#f2f4f8]">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-[#364152]">Buchtitel</th>
                    <th className="px-3 py-2 text-left font-medium text-[#364152]">Item-ID</th>
                    <th className="px-3 py-2 text-left font-medium text-[#364152]">Ausgeliehen am</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {displayLeases.map((lease) => (
                    <ActiveLeaseTableRow key={lease.id} lease={lease} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {isSubmitting ? <p className="text-sm text-[#364152]">Rückgabe wird verarbeitet...</p> : null}
    </div>
  );
}
