"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StudentHistoryModalTrigger } from "@/components/students/student-history-modal-trigger";
import { itemIdSchema } from "@/lib/book-schemas";
import { useStudentSelection } from "@/components/providers/student-selection-provider";
import { ItemIdInput } from "@/components/ui/item-id-input";

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

type ItemHistoryLease = {
  id: number;
  leasedAt: string;
  returnedAt: string | null;
  student: {
    id: number;
    idOld: string | null;
    firstname: string;
    lastname: string;
    course: string;
  };
};

type ItemHistoryResponse = {
  item: {
    id: string;
    status: string;
  };
  leases: ItemHistoryLease[];
};

type ItemHistoryEvent = {
  leaseId: number;
  type: "LEASED" | "RETURNED";
  date: string;
  student: ItemHistoryLease["student"];
};

export function ReturnWorkflow() {
  const { selectedStudentId, setSelectedStudentId, isSelectionHydrated } = useStudentSelection();
  const selectedStudentRequestRef = useRef(0);
  const [itemId, setItemId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSelectedStudent, setIsLoadingSelectedStudent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnResponse | null>(null);
  const [selectedStudentSnapshot, setSelectedStudentSnapshot] = useState<SelectedStudentSnapshot | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);
  const [historyEvents, setHistoryEvents] = useState<ItemHistoryEvent[]>([]);

  useEffect(() => {
    if (!isSelectionHydrated) {
      return;
    }

    if (!selectedStudentId) {
      return;
    }

    const targetStudentId = selectedStudentId;

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
          setSelectedStudentSnapshot((current) => {
            if (current?.studentId !== targetStudentId) {
              return current;
            }
            return null;
          });
          return;
        }

        setSelectedStudentSnapshot({
          studentId: targetStudentId,
          student: payload.student,
          leases: payload.leases,
        });
      } finally {
        if (requestId === selectedStudentRequestRef.current) {
          setIsLoadingSelectedStudent(false);
        }
      }
    }

    void loadSelectedStudent();
  }, [isSelectionHydrated, selectedStudentId]);

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

  async function handleOpenItemHistory(itemIdToInspect: string) {
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError(null);
    setHistoryItemId(itemIdToInspect);
    setHistoryEvents([]);

    const response = await fetch(`/api/items/${encodeURIComponent(itemIdToInspect)}/history`);
    const payload = (await response.json()) as ItemHistoryResponse | { error?: string };

    if (!response.ok) {
      setHistoryError((payload as { error?: string }).error ?? "Verlauf konnte nicht geladen werden");
      setHistoryLoading(false);
      return;
    }

    const historyPayload = payload as ItemHistoryResponse;
    const events = historyPayload.leases.flatMap((lease) => {
      const leasedEvent: ItemHistoryEvent = {
        leaseId: lease.id,
        type: "LEASED",
        date: lease.leasedAt,
        student: lease.student,
      };

      if (!lease.returnedAt) {
        return [leasedEvent];
      }

      const returnedEvent: ItemHistoryEvent = {
        leaseId: lease.id,
        type: "RETURNED",
        date: lease.returnedAt,
        student: lease.student,
      };

      return [leasedEvent, returnedEvent];
    });

    events.sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
    setHistoryEvents(events);
    setHistoryLoading(false);
  }

  function handleCloseItemHistory() {
    setHistoryOpen(false);
    setHistoryLoading(false);
    setHistoryError(null);
    setHistoryItemId(null);
    setHistoryEvents([]);
  }

  const selectedSnapshotForCurrentId =
    selectedStudentId && selectedStudentSnapshot?.studentId === selectedStudentId ? selectedStudentSnapshot : null;
  const displayStudent = result?.student ?? selectedSnapshotForCurrentId?.student ?? null;
  const displayLeases = result?.student ? (result.remainingLeases ?? []) : (selectedSnapshotForCurrentId?.leases ?? []);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-black/10 bg-[#f2f4f8] p-4">
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
      </div>

      {success ? <p className="text-sm font-medium text-green-700">{success}</p> : null}
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      {isLoadingSelectedStudent && !displayStudent ? <p className="text-sm text-[#364152]">Schülerdaten werden geladen...</p> : null}

      {displayStudent ? (
        <div className="space-y-4 rounded-lg border border-black/10 bg-white p-4">
          <div className="space-y-2">
            <div>
              <h2 className="text-lg font-semibold text-[#131820]">
                {displayStudent.lastname}, {displayStudent.firstname}
              </h2>
              <p className="text-sm text-[#364152]">
                {displayStudent.idOld ? `ID: ${displayStudent.idOld} · ` : ""}
                Klasse: {displayStudent.course}
              </p>
            </div>

            <StudentHistoryModalTrigger
              student={{
                id: displayStudent.id,
                firstname: displayStudent.firstname,
                lastname: displayStudent.lastname,
              }}
            />
          </div>

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
                    <tr key={lease.id}>
                      <td className="px-3 py-2">
                        <Link href={`/books/${lease.item.book.id}?itemId=${lease.item.id}`} className="text-[#006b2d] hover:underline">
                          {lease.item.book.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="font-mono text-xs text-[#006b2d] hover:underline"
                          onClick={() => void handleOpenItemHistory(lease.item.id)}
                        >
                          {lease.item.id}
                        </button>
                      </td>
                      <td className="px-3 py-2">{new Date(lease.leasedAt).toLocaleDateString("de-DE")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-4 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-[#131820]">Item-Verlauf</h3>
                <p className="mt-1 text-sm text-[#364152]">{historyItemId ? `Item: ${historyItemId}` : "Item"}</p>
              </div>
              <Button size="sm" variant="outline" onClick={handleCloseItemHistory}>
                Schließen
              </Button>
            </div>

            <div className="mt-3 max-h-96 overflow-auto rounded border border-black/10">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-[#f2f4f8] text-left">
                  <tr>
                    <th className="px-3 py-2">Datum</th>
                    <th className="px-3 py-2">Aktion</th>
                    <th className="px-3 py-2">Schüler</th>
                    <th className="px-3 py-2">Klasse</th>
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
                  ) : historyEvents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-[#364152]">
                        Keine Ausleih- oder Rückgabehistorie vorhanden.
                      </td>
                    </tr>
                  ) : (
                    historyEvents.map((event) => (
                      <tr key={`${event.leaseId}-${event.type}-${event.date}`} className="border-t border-black/10">
                        <td className="px-3 py-2">{new Date(event.date).toLocaleString("de-DE")}</td>
                        <td className="px-3 py-2">
                          {event.type === "LEASED" ? (
                            <span className="font-medium text-amber-700">Ausleihe</span>
                          ) : (
                            <span className="font-medium text-green-700">Rückgabe</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {event.student.lastname}, {event.student.firstname}
                          {event.student.idOld ? ` (ID: ${event.student.idOld})` : ""}
                        </td>
                        <td className="px-3 py-2">{event.student.course}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {isSubmitting ? <p className="text-sm text-[#364152]">Rückgabe wird verarbeitet...</p> : null}
    </div>
  );
}
