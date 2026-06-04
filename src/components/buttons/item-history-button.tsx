"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type ItemHistoryStudent = {
  id: number;
  idOld: string | null;
  firstname: string;
  lastname: string;
  course: string;
};

type ItemHistoryEvent =
  | {
      id: string;
      type: "LEASED" | "RETURNED";
      date: string;
      leaseId: number;
      student: ItemHistoryStudent;
    }
  | {
      id: string;
      type: "COMMENT";
      date: string;
      commentId: number;
      body: string;
      student: ItemHistoryStudent | null;
    };

type ItemHistoryResponse = {
  item: {
    id: string;
    status: string;
  };
  events: ItemHistoryEvent[];
};

type Props = {
  itemId: string;
  mode?: "inline" | "button";
  label?: string;
  size?: "sm" | "xs";
  variant?: "default" | "outline" | "ghost";
  className?: string;
};

function formatStudent(student: ItemHistoryStudent | null) {
  if (!student) {
    return "-";
  }

  return `${student.lastname}, ${student.firstname}${student.idOld ? ` (ID: ${student.idOld})` : ""}`;
}

function eventLabel(event: ItemHistoryEvent) {
  if (event.type === "LEASED") {
    return <span className="font-medium text-amber-700">Ausleihe</span>;
  }

  if (event.type === "RETURNED") {
    return <span className="font-medium text-green-700">Rückgabe</span>;
  }

  return <span className="font-medium text-slate-700">Kommentar</span>;
}

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
  const [submittingComment, setSubmittingComment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [events, setEvents] = useState<ItemHistoryEvent[]>([]);
  const [commentBody, setCommentBody] = useState("");

  async function loadHistory() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setCommentError(null);
    setEvents([]);

    const response = await fetch(`/api/items/${encodeURIComponent(itemId)}/history`);
    const payload = (await response.json()) as ItemHistoryResponse | { error?: string };

    if (!response.ok) {
      setError((payload as { error?: string }).error ?? "Verlauf konnte nicht geladen werden");
      setLoading(false);
      return;
    }

    const historyPayload = payload as ItemHistoryResponse;
    setEvents(historyPayload.events);
    setLoading(false);
  }

  async function submitComment() {
    const trimmedComment = commentBody.trim();
    if (!trimmedComment) {
      setCommentError("Kommentar ist erforderlich");
      return;
    }

    setSubmittingComment(true);
    setCommentError(null);

    const response = await fetch(`/api/items/${encodeURIComponent(itemId)}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: trimmedComment }),
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setCommentError(payload.error ?? "Kommentar konnte nicht gespeichert werden");
      setSubmittingComment(false);
      return;
    }

    setCommentBody("");
    await loadHistory();
    setSubmittingComment(false);
  }

  function closeHistory() {
    setOpen(false);
    setLoading(false);
    setSubmittingComment(false);
    setError(null);
    setCommentError(null);
    setEvents([]);
    setCommentBody("");
  }

  return (
    <>
      {mode === "button" ? (
        <Button size={size} variant={variant} onClick={() => void loadHistory()}>
          {label ?? "Verlauf"}
        </Button>
      ) : (
        <button
          type="button"
          className={className ?? "font-mono text-xs text-[#006b2d] hover:underline"}
          onClick={() => void loadHistory()}
        >
          {label ?? itemId}
        </button>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-lg bg-white p-4 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-[#131820]">Item-Verlauf</h3>
                <p className="mt-1 text-sm text-[#364152]">Item: {itemId}</p>
              </div>
              <Button size="sm" variant="outline" onClick={closeHistory}>
                Schließen
              </Button>
            </div>

            <div className="mt-3 space-y-3 rounded border border-black/10 p-3">
              <label htmlFor={`item-comment-${itemId}`} className="block text-sm font-medium text-[#131820]">
                Kommentar hinzufügen
              </label>
              <textarea
                id={`item-comment-${itemId}`}
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
                placeholder="Kommentar eingeben"
                rows={3}
                autoFocus
                className="w-full rounded border border-black/20 px-3 py-2 text-sm outline-none focus:border-[#006b2d]"
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-[#4b5563]">
                  Wenn das Item aktuell ausgeliehen ist, wird der Kommentar automatisch dem Schüler zugeordnet.
                </p>
                <Button size="sm" onClick={() => void submitComment()} disabled={submittingComment || loading}>
                  Kommentar speichern
                </Button>
              </div>
              {commentError ? <p className="text-sm text-red-600">{commentError}</p> : null}
            </div>

            <div className="mt-3 max-h-96 overflow-auto rounded border border-black/10">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-[#f2f4f8] text-left">
                  <tr>
                    <th className="px-3 py-2">Datum</th>
                    <th className="px-3 py-2">Aktion</th>
                    <th className="px-3 py-2">Beschreibung</th>
                    <th className="px-3 py-2">Schüler</th>
                    <th className="px-3 py-2">Klasse</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-[#364152]">
                        Verlauf wird geladen...
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-red-600">
                        {error}
                      </td>
                    </tr>
                  ) : events.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-[#364152]">
                        Keine Ausleih-, Rückgabe- oder Kommentarhistorie vorhanden.
                      </td>
                    </tr>
                  ) : (
                    events.map((event) => (
                      <tr key={event.id} className="border-t border-black/10">
                        <td className="px-3 py-2">{new Date(event.date).toLocaleString("de-DE")}</td>
                        <td className="px-3 py-2">{eventLabel(event)}</td>
                        <td className="px-3 py-2">
                          {event.type === "COMMENT" ? event.body : event.type === "LEASED" ? "Ausleihe" : "Rückgabe"}
                        </td>
                        <td className="px-3 py-2">{formatStudent(event.student ?? null)}</td>
                        <td className="px-3 py-2">{event.student?.course ?? "-"}</td>
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
