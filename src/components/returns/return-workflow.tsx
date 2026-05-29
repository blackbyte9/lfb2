"use client";

import { useState } from "react";
import Link from "next/link";
import { itemIdSchema } from "@/lib/book-schemas";
import { ItemIdInput } from "@/components/ui/item-id-input";

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
  remainingLeases?: Array<{
    id: number;
    leasedAt: string;
    item: {
      id: string;
      book: {
        id: number;
        name: string;
      };
    };
  }>;
  error?: string;
};

export function ReturnWorkflow() {
  const [itemId, setItemId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnResponse | null>(null);

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
      setError("Item-ID muss dem Format RSV0000000 entsprechen");
      return;
    }

    await submitReturnByItemId(normalized, true);
  }

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
          autoSubmitOnValid
          clearOnInvalidPrefix
          disabled={isSubmitting}
          ariaLabel="Item-ID für Rückgabe"
        />
        <p className="mt-2 text-xs text-[#4b5563]">Die Rückgabe startet automatisch, sobald das Format `RSV0000000` vollständig ist.</p>
      </div>

      {success ? <p className="text-sm font-medium text-green-700">{success}</p> : null}
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      {result?.student ? (
        <div className="space-y-4 rounded-lg border border-black/10 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-[#131820]">
                {result.student.lastname}, {result.student.firstname}
              </h2>
              <p className="text-sm text-[#364152]">
                {result.student.idOld ? `ID: ${result.student.idOld} · ` : ""}
                Klasse: {result.student.course}
              </p>
            </div>
            <Link href={`/students/${result.student.id}/leases`} className="text-sm font-medium text-[#006b2d] hover:underline">
              Zur Schüleransicht
            </Link>
          </div>

          <h3 className="text-sm font-semibold text-[#131820]">Weitere aktive Ausleihen</h3>

          {(result.remainingLeases ?? []).length === 0 ? (
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
                  {(result.remainingLeases ?? []).map((lease) => (
                    <tr key={lease.id}>
                      <td className="px-3 py-2">{lease.item.book.name}</td>
                      <td className="px-3 py-2 font-mono text-xs">{lease.item.id}</td>
                      <td className="px-3 py-2">{new Date(lease.leasedAt).toLocaleDateString("de-DE")}</td>
                    </tr>
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
