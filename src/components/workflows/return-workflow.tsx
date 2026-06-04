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

type ItemStatus = "NEW" | "USED" | "DAMAGED" | "REMOVED";

const ITEM_STATUSES: ItemStatus[] = ["NEW", "USED", "DAMAGED", "REMOVED"];

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
  const [returnComment, setReturnComment] = useState("");
  const [returnCommentStatus, setReturnCommentStatus] = useState<ItemStatus | "">("");
  const [returnCommentSubmitting, setReturnCommentSubmitting] = useState(false);
  const [returnCommentError, setReturnCommentError] = useState<string | null>(null);
  const [returnCommentSaved, setReturnCommentSaved] = useState(false);

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
    setReturnComment("");
    setReturnCommentStatus("");
    setReturnCommentSaved(false);
    setReturnCommentError(null);

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

  async function handleSubmitReturnComment() {
    if (!result?.returnedItem?.id) return;
    const trimmed = returnComment.trim();
    if (!trimmed) {
      setReturnCommentError("Kommentar ist erforderlich");
      return;
    }

    setReturnCommentSubmitting(true);
    setReturnCommentError(null);

    const body: Record<string, unknown> = { comment: trimmed };
    if (result.student?.id) {
      body.studentId = result.student.id;
    }
    if (returnCommentStatus) {
      body.status = returnCommentStatus;
    }

    const response = await fetch(
      `/api/items/${encodeURIComponent(result.returnedItem.id)}/comments`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setReturnCommentError(payload.error ?? "Kommentar konnte nicht gespeichert werden");
      setReturnCommentSubmitting(false);
      return;
    }

    setReturnCommentSaved(true);
    setReturnComment("");
    setReturnCommentStatus("");
    setReturnCommentSubmitting(false);
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

      {result?.returnedItem && !returnCommentSaved ? (
        <div className="space-y-3 rounded-lg border border-black/10 bg-white p-4">
          <h3 className="text-sm font-semibold text-[#131820]">
            Kommentar zur Rückgabe: {result.returnedItem.id}
          </h3>
          <textarea
            value={returnComment}
            onChange={(e) => setReturnComment(e.target.value)}
            placeholder="Optionaler Kommentar zur Rückgabe…"
            rows={3}
            className="w-full rounded border border-black/20 px-3 py-2 text-sm outline-none focus:border-[#006b2d]"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <label className="text-xs text-[#4b5563]">Status ändern (optional):</label>
              <select
                value={returnCommentStatus}
                onChange={(e) => setReturnCommentStatus(e.target.value as ItemStatus | "")}
                className="rounded border border-black/20 bg-white px-2 py-1 text-xs"
                aria-label="Status des Items ändern"
              >
                <option value="">— kein Statuswechsel —</option>
                {ITEM_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReturnCommentSaved(true)}
                className="rounded border border-black/20 px-3 py-1 text-xs hover:bg-black/5"
              >
                Überspringen
              </button>
              <button
                type="button"
                onClick={() => void handleSubmitReturnComment()}
                disabled={returnCommentSubmitting}
                className="rounded bg-[#006b2d] px-3 py-1 text-xs text-white hover:bg-[#005a25] disabled:opacity-60"
              >
                Kommentar speichern
              </button>
            </div>
          </div>
          {returnCommentError ? <p className="text-sm text-red-600">{returnCommentError}</p> : null}
        </div>
      ) : null}

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
