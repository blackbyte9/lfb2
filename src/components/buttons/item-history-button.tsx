"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

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

type Props = {
  itemId: string;
  mode?: "inline" | "button";
  label?: string;
  size?: "sm" | "xs";
  variant?: "default" | "outline" | "ghost";
  className?: string;
};

export function ItemHistoryButton({
  itemId,
  mode = "inline",
  label,
  size = "xs",
  variant = "outline",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<ItemHistoryEvent[]>([]);

  async function openHistory() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setEvents([]);

    const response = await fetch(`/api/items/${encodeURIComponent(itemId)}/history`);
    const payload = (await response.json()) as ItemHistoryResponse | { error?: string };

    if (!response.ok) {
      setError((payload as { error?: string }).error ?? "Verlauf konnte nicht geladen werden");
      setLoading(false);
      return;
    }

    const historyPayload = payload as ItemHistoryResponse;
    const historyEvents = historyPayload.leases.flatMap((lease) => {
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

    historyEvents.sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
    setEvents(historyEvents);
    setLoading(false);
  }

  function closeHistory() {
    setOpen(false);
    setLoading(false);
    setError(null);
    setEvents([]);
  }

  return (
    <>
      {mode === "button" ? (
        <Button size={size} variant={variant} onClick={() => void openHistory()}>
          {label ?? "Verlauf"}
        </Button>
      ) : (
        <button
          type="button"
          className={className ?? "font-mono text-xs text-[#006b2d] hover:underline"}
          onClick={() => void openHistory()}
        >
          {label ?? itemId}
        </button>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-4 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-[#131820]">Item-Verlauf</h3>
                <p className="mt-1 text-sm text-[#364152]">Item: {itemId}</p>
              </div>
              <Button size="sm" variant="outline" onClick={closeHistory}>
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
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-[#364152]">
                        Verlauf wird geladen...
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-red-600">
                        {error}
                      </td>
                    </tr>
                  ) : events.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-[#364152]">
                        Keine Ausleih- oder Rückgabehistorie vorhanden.
                      </td>
                    </tr>
                  ) : (
                    events.map((event) => (
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
      ) : null}
    </>
  );
}
