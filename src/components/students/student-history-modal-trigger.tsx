"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type StudentHistoryModalTriggerProps = {
  student: {
    id: number;
    firstname: string;
    lastname: string;
  };
};

type StudentGradeHistoryRow = {
  id: number;
  schoolYear: string;
  grade: string;
  source: string;
  updatedAt: string;
};

type StudentLeaseHistoryRow = {
  id: number;
  leasedAt: string;
  returnedAt: string | null;
  active: boolean;
  item: {
    id: string;
    book: {
      id: number;
      name: string;
    };
  };
};

export function StudentHistoryModalTrigger({ student }: StudentHistoryModalTriggerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gradeRows, setGradeRows] = useState<StudentGradeHistoryRow[]>([]);
  const [leaseRows, setLeaseRows] = useState<StudentLeaseHistoryRow[]>([]);

  async function openHistory() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setGradeRows([]);
    setLeaseRows([]);

    try {
      const [gradeResponse, leaseResponse] = await Promise.all([
        fetch(`/api/students/${student.id}/grade-history`),
        fetch(`/api/students/${student.id}/lease-history`),
      ]);

      const [gradePayload, leasePayload] = (await Promise.all([
        gradeResponse.json(),
        leaseResponse.json(),
      ])) as [{ error?: string } | StudentGradeHistoryRow[], { error?: string } | StudentLeaseHistoryRow[]];

      if (!gradeResponse.ok) {
        setError((gradePayload as { error?: string }).error ?? "Klassenverlauf konnte nicht geladen werden");
        return;
      }

      if (!leaseResponse.ok) {
        setError((leasePayload as { error?: string }).error ?? "Ausleihverlauf konnte nicht geladen werden");
        return;
      }

      setGradeRows(gradePayload as StudentGradeHistoryRow[]);
      setLeaseRows(leasePayload as StudentLeaseHistoryRow[]);
    } finally {
      setLoading(false);
    }
  }

  function closeHistory() {
    setOpen(false);
    setLoading(false);
    setError(null);
    setGradeRows([]);
    setLeaseRows([]);
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => void openHistory()}>
        Verlauf
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-lg bg-white p-4 shadow-lg">
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

            <h4 className="mt-3 text-sm font-semibold text-[#131820]">Klassenverlauf</h4>
            <div className="mt-2 max-h-64 overflow-auto rounded border border-black/10">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-[#f2f4f8] text-left">
                  <tr>
                    <th className="px-3 py-2">Schuljahr</th>
                    <th className="px-3 py-2">Klasse</th>
                    <th className="px-3 py-2">Quelle</th>
                    <th className="px-3 py-2">Aktualisiert</th>
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
                  ) : gradeRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-[#364152]">
                        Kein Verlauf vorhanden.
                      </td>
                    </tr>
                  ) : (
                    gradeRows.map((row) => (
                      <tr key={row.id} className="border-t border-black/10">
                        <td className="px-3 py-2">{row.schoolYear}</td>
                        <td className="px-3 py-2">{row.grade}</td>
                        <td className="px-3 py-2">{row.source}</td>
                        <td className="px-3 py-2">{new Date(row.updatedAt).toLocaleDateString("de-DE")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <h4 className="mt-4 text-sm font-semibold text-[#131820]">Ausleihverlauf</h4>
            <div className="mt-2 max-h-72 overflow-auto rounded border border-black/10">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-[#f2f4f8] text-left">
                  <tr>
                    <th className="px-3 py-2">Buch</th>
                    <th className="px-3 py-2">Item-ID</th>
                    <th className="px-3 py-2">Ausgeliehen</th>
                    <th className="px-3 py-2">Zurückgegeben</th>
                    <th className="px-3 py-2">Status</th>
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
                  ) : leaseRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-[#364152]">
                        Keine Ausleihen vorhanden.
                      </td>
                    </tr>
                  ) : (
                    leaseRows.map((row) => (
                      <tr key={row.id} className="border-t border-black/10">
                        <td className="px-3 py-2">{row.item.book.name}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.item.id}</td>
                        <td className="px-3 py-2">{new Date(row.leasedAt).toLocaleDateString("de-DE")}</td>
                        <td className="px-3 py-2">
                          {row.returnedAt ? new Date(row.returnedAt).toLocaleDateString("de-DE") : "-"}
                        </td>
                        <td className="px-3 py-2">
                          {row.active ? (
                            <span className="font-medium text-amber-700">Aktiv</span>
                          ) : (
                            <span className="font-medium text-green-700">Zurückgegeben</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
