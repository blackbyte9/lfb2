"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type StudentHistoryButtonProps = {
  student: {
    id: number;
    firstname: string;
    lastname: string;
  };
  size?: "sm" | "xs";
  variant?: "default" | "outline" | "ghost";
  label?: string;
};

type StudentHistoryEvent =
  | {
      id: string;
      type: "GRADE_IMPORT";
      date: string;
      schoolYear: string;
      grade: string;
      source: string;
    }
  | {
      id: string;
      type: "LEASED" | "RETURNED";
      date: string;
      active: boolean;
      leaseId: number;
      item: {
        id: string;
        book: {
          id: number;
          name: string;
        };
      };
    }
  | {
      id: string;
      type: "COMMENT";
      date: string;
      commentId: number;
      body: string;
      item: {
        id: string;
        book: {
          id: number;
          name: string;
        };
      };
    };

type StudentHistoryResponse = {
  student: {
    id: number;
  };
  events: StudentHistoryEvent[];
};

function eventLabel(event: StudentHistoryEvent) {
  if (event.type === "GRADE_IMPORT") {
    return <span className="font-medium text-sky-700">Klassenimport</span>;
  }

  if (event.type === "LEASED") {
    return <span className="font-medium text-amber-700">Ausleihe</span>;
  }

  if (event.type === "RETURNED") {
    return <span className="font-medium text-green-700">Rückgabe</span>;
  }

  return <span className="font-medium text-slate-700">Kommentar</span>;
}

export function StudentHistoryButton({
  student,
  size = "sm",
  variant = "outline",
  label = "Verlauf",
}: StudentHistoryButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<StudentHistoryEvent[]>([]);

  async function openHistory() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setEvents([]);

    const response = await fetch(`/api/students/${student.id}/history`);
    const payload = (await response.json()) as StudentHistoryResponse | { error?: string };

    if (!response.ok) {
      setError((payload as { error?: string }).error ?? "Verlauf konnte nicht geladen werden");
      setLoading(false);
      return;
    }

    const historyPayload = payload as StudentHistoryResponse;
    setEvents(historyPayload.events);
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
      <Button size={size} variant={variant} onClick={() => void openHistory()}>
        {label}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl rounded-lg bg-white p-4 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-[#131820]">Schülerverlauf</h3>
                <p className="mt-1 text-sm text-[#364152]">
                  {student.firstname} {student.lastname}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={closeHistory}>
                Schließen
              </Button>
            </div>

            <div className="mt-3 max-h-128 overflow-auto rounded border border-black/10">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-[#f2f4f8] text-left">
                  <tr>
                    <th className="px-3 py-2">Datum</th>
                    <th className="px-3 py-2">Art</th>
                    <th className="px-3 py-2">Details</th>
                    <th className="px-3 py-2">Buch / Item</th>
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
                        Kein Verlauf vorhanden.
                      </td>
                    </tr>
                  ) : (
                    events.map((event) => (
                      <tr key={event.id} className="border-t border-black/10">
                        <td className="px-3 py-2">{new Date(event.date).toLocaleString("de-DE")}</td>
                        <td className="px-3 py-2">{eventLabel(event)}</td>
                        <td className="px-3 py-2">
                          {event.type === "GRADE_IMPORT"
                            ? `${event.source}: ${event.schoolYear} · ${event.grade}`
                            : event.type === "COMMENT"
                              ? event.body
                              : event.active
                                ? "Aktive Ausleihe"
                                : "Abgeschlossene Ausleihe"}
                        </td>
                        <td className="px-3 py-2">
                          {event.type === "GRADE_IMPORT" ? "-" : `${event.item.book.name} · ${event.item.id}`}
                        </td>
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
