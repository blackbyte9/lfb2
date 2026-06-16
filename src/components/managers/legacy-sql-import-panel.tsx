"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type {
  LegacySqlImportOverrides,
  LegacySqlImportResult,
  LegacySqlPreview,
  LegacySqlPreviewStudent,
} from "@/lib/legacy-sql-import";

type Stage = "select" | "parsing" | "review" | "importing" | "done" | "error";

type NameDraft = { firstname: string; lastname: string };

export function LegacySqlImportPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("select");
  const [preview, setPreview] = useState<LegacySqlPreview | null>(null);
  const [result, setResult] = useState<LegacySqlImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- ISBN fix state ---
  // Map from original ISBN → user's corrected value (empty string = no fix, will be skipped)
  const [isbnDrafts, setIsbnDrafts] = useState<Record<string, string>>({});
  // Set of original ISBNs explicitly excluded
  const [isbnExcluded, setIsbnExcluded] = useState<Set<string>>(new Set());

  // --- Name fix state ---
  // Which legacyIds should have a name fix applied
  const [applyNameFix, setApplyNameFix] = useState<Set<number>>(new Set());
  // Custom overrides per legacyId
  const [nameOverrides, setNameOverrides] = useState<Map<number, NameDraft>>(new Map());
  // Inline editing
  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [nameDraft, setNameDraft] = useState<NameDraft | null>(null);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    void runPreview(f);
  }

  async function runPreview(f: File) {
    setStage("parsing");
    setErrorMsg(null);

    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/import/legacy-sql/preview", { method: "POST", body: fd });
      const data = (await res.json()) as { error?: string } & LegacySqlPreview;
      if (!res.ok) throw new Error(data.error ?? "Vorschau fehlgeschlagen");

      // Initialize ISBN drafts (normalize-minus-dashes pre-fill)
      const drafts: Record<string, string> = {};
      for (const b of data.books) {
        if (b.normalizedIsbn === null) {
          drafts[b.originalIsbn] = b.originalIsbn.replace(/[-\s]/g, "");
        }
      }
      setIsbnDrafts(drafts);
      setIsbnExcluded(new Set());

      // Initialize name fixes (all auto-fixable selected by default)
      const toApply = new Set<number>();
      const overrides = new Map<number, NameDraft>();
      for (const s of data.students) {
        const hasChange = s.fixedFirstname !== s.originalFirstname || s.fixedLastname !== s.originalLastname;
        if (hasChange) {
          toApply.add(s.legacyId);
          overrides.set(s.legacyId, { firstname: s.fixedFirstname, lastname: s.fixedLastname });
        }
      }
      setApplyNameFix(toApply);
      setNameOverrides(overrides);
      setEditingNameId(null);
      setNameDraft(null);

      setPreview(data);
      setStage("review");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unbekannter Fehler");
      setStage("error");
    }
  }

  async function handleConfirm() {
    if (!file || !preview) return;
    setStage("importing");
    setErrorMsg(null);

    try {
      const isbnFixes: LegacySqlImportOverrides["isbnFixes"] = [];
      for (const b of preview.books) {
        if (b.normalizedIsbn !== null) continue; // auto-valid, no override needed
        if (isbnExcluded.has(b.originalIsbn)) {
          isbnFixes.push({ originalIsbn: b.originalIsbn, fixedIsbn: null });
        } else {
          const draft = isbnDrafts[b.originalIsbn]?.trim() ?? "";
          if (draft) isbnFixes.push({ originalIsbn: b.originalIsbn, fixedIsbn: draft });
          // empty draft → import will skip (already broken)
        }
      }

      const studentNames: LegacySqlImportOverrides["studentNames"] = [];
      for (const [legacyId, names] of nameOverrides) {
        if (applyNameFix.has(legacyId)) {
          studentNames.push({ legacyId, ...names });
        }
      }

      const fd = new FormData();
      fd.append("file", file);
      fd.append("overrides", JSON.stringify({ isbnFixes, studentNames } satisfies LegacySqlImportOverrides));

      const res = await fetch("/api/import/legacy-sql", { method: "POST", body: fd });
      const data = (await res.json()) as { error?: string } & LegacySqlImportResult;
      if (!res.ok) throw new Error(data.error ?? "Import fehlgeschlagen");

      setResult(data);
      setStage("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unbekannter Fehler");
      setStage("error");
    }
  }

  function reset() {
    setFile(null);
    setStage("select");
    setPreview(null);
    setResult(null);
    setErrorMsg(null);
    setIsbnDrafts({});
    setIsbnExcluded(new Set());
    setApplyNameFix(new Set());
    setNameOverrides(new Map());
    setEditingNameId(null);
    setNameDraft(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // --- name edit helpers ---
  function startEditName(s: LegacySqlPreviewStudent) {
    const current = nameOverrides.get(s.legacyId) ?? { firstname: s.fixedFirstname, lastname: s.fixedLastname };
    setNameDraft({ ...current });
    setEditingNameId(s.legacyId);
  }

  function saveEditName(legacyId: number) {
    if (!nameDraft) return;
    const trimmed = { firstname: nameDraft.firstname.trim(), lastname: nameDraft.lastname.trim() };
    setNameOverrides((prev) => new Map(prev).set(legacyId, trimmed));
    setApplyNameFix((prev) => new Set(prev).add(legacyId));
    setEditingNameId(null);
    setNameDraft(null);
  }

  function cancelEditName() {
    setEditingNameId(null);
    setNameDraft(null);
  }

  function toggleNameFix(legacyId: number) {
    setApplyNameFix((prev) => {
      const next = new Set(prev);
      if (next.has(legacyId)) next.delete(legacyId);
      else next.add(legacyId);
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Derived values for review
  // ---------------------------------------------------------------------------

  const brokenBooks = preview?.books.filter((b) => b.normalizedIsbn === null) ?? [];
  const nameFixStudents =
    preview?.students.filter(
      (s) => s.fixedFirstname !== s.originalFirstname || s.fixedLastname !== s.originalLastname,
    ) ?? [];
  const duplicateStudents = preview?.students.filter((s) => s.oldIdIsDuplicate) ?? [];

  // Count books that will actually be imported (valid + user-fixed ones)
  const includedBookCount =
    preview?.books.filter((b) => {
      if (b.normalizedIsbn !== null) return true;
      if (isbnExcluded.has(b.originalIsbn)) return false;
      const draft = isbnDrafts[b.originalIsbn]?.trim() ?? "";
      return draft.length >= 10; // rough validity check for UI only
    }).length ?? 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="w-full space-y-4 rounded-xl border border-black/10 bg-white p-6 shadow-sm">
      <div>
        <h1 className="text-2xl font-semibold text-[#131820]">Legacy SQL Import</h1>
        <p className="text-sm text-[#364152]">
          Importiert Daten aus einem PostgreSQL-Dump (sbm2-Format). Alle bestehenden Daten werden überschrieben.
        </p>
      </div>

      {/* ── SELECT ─────────────────────────────────────────────────────────── */}
      {stage === "select" && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-black/20 bg-[#f2f4f8] py-12 text-center">
          <p className="mb-4 text-sm text-[#4b5563]">
            Wähle eine SQL-Dump-Datei (<code>.sql</code>) aus, um eine Vorschau zu erhalten.
          </p>
          <input ref={fileInputRef} type="file" accept=".sql" className="hidden" onChange={handleFileInput} title="SQL-Dump-Datei auswählen" />
          <Button onClick={() => fileInputRef.current?.click()}>SQL-Datei wählen</Button>
        </div>
      )}

      {/* ── SPINNER (parse / import) ────────────────────────────────────────── */}
      {(stage === "parsing" || stage === "importing") && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-black/10 bg-[#f2f4f8] py-16">
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#006b2d] border-t-transparent" />
          <p className="text-sm font-medium text-[#364152]">
            {stage === "parsing" ? "Datei wird analysiert…" : "Daten werden importiert… (kann mehrere Minuten dauern)"}
          </p>
        </div>
      )}

      {/* ── ERROR ──────────────────────────────────────────────────────────── */}
      {stage === "error" && (
        <div className="space-y-3">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-800">Fehler</p>
            <p className="mt-1 text-sm text-red-700">{errorMsg}</p>
          </div>
          <Button variant="outline" size="sm" onClick={reset}>
            Neu starten
          </Button>
        </div>
      )}

      {/* ── DONE ───────────────────────────────────────────────────────────── */}
      {stage === "done" && result && (
        <div className="space-y-4">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-800">Import abgeschlossen</p>
            <p className="mt-1 text-sm text-green-700">{result.message}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {(
              [
                ["Bücher", result.books],
                ["Items", result.items],
                ["Schüler", result.students],
                ["Ausleihen", result.leases],
                ["Kommentare", result.comments],
                ["Übersprungene Kommentare", result.skippedComments],
              ] as [string, number][]
            ).map(([label, value]) => (
              <div key={label} className="rounded-lg border border-black/10 p-3 text-center">
                <p className="text-xl font-bold text-[#131820]">{value.toLocaleString("de")}</p>
                <p className="mt-0.5 text-xs text-[#4b5563]">{label}</p>
              </div>
            ))}
          </div>
          {result.brokenIsbns.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">Nicht importierte ISBNs ({result.brokenIsbns.length})</p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {result.brokenIsbns.map((isbn) => (
                  <li key={isbn} className="font-mono">
                    {isbn}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={reset}>
            Weiteren Import starten
          </Button>
        </div>
      )}

      {/* ── REVIEW ─────────────────────────────────────────────────────────── */}
      {stage === "review" && preview && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {(
              [
                ["Bücher", `${includedBookCount} / ${preview.books.length}`],
                ["Items", preview.totalItemCount.toLocaleString("de")],
                ["Schüler", preview.students.length.toLocaleString("de")],
                ["Ausleihen", preview.leaseCount.toLocaleString("de")],
                ["Kommentare", `${preview.keepCommentCount.toLocaleString("de")} (${preview.skipCommentCount.toLocaleString("de")} übersprungene)`],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} className="rounded-lg border border-black/10 bg-[#f2f4f8] p-3 text-center">
                <p className="text-base font-bold text-[#131820]">{value}</p>
                <p className="text-xs text-[#4b5563]">{label}</p>
              </div>
            ))}
          </div>

          {/* Broken ISBNs */}
          {brokenBooks.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">⚠ Fehlerhafte ISBNs ({brokenBooks.length})</p>
              <p className="mt-1 text-xs text-amber-800">
                Trage eine gültige ISBN ein oder lasse das Feld leer, um das Buch (und seine Items) zu überspringen.
                Mit &quot;Ausschließen&quot; kannst du es explizit aus dem Import entfernen.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-amber-200 text-left text-amber-900">
                      <th className="pb-1 pr-3 font-medium">ISBN (original)</th>
                      <th className="pb-1 pr-3 font-medium">Titel</th>
                      <th className="pb-1 pr-3 text-center font-medium">Items</th>
                      <th className="pb-1 pr-3 font-medium">Korrigierte ISBN</th>
                      <th className="pb-1 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {brokenBooks.map((b) => {
                      const excluded = isbnExcluded.has(b.originalIsbn);
                      const draft = isbnDrafts[b.originalIsbn] ?? "";
                      const draftValid = /^\d{10}(\d{3})?$/.test(draft.replace(/[-\s]/g, ""));
                      return (
                        <tr
                          key={b.originalIsbn}
                          className={`border-b border-amber-100 last:border-0 ${excluded ? "opacity-40" : ""}`}
                        >
                          <td className="py-1.5 pr-3 font-mono">{b.originalIsbn}</td>
                          <td className="py-1.5 pr-3">{b.name}</td>
                          <td className="py-1.5 pr-3 text-center">{b.itemCount}</td>
                          <td className="py-1.5 pr-3">
                            <input
                              type="text"
                              value={excluded ? "" : draft}
                              disabled={excluded}
                              onChange={(e) => setIsbnDrafts((prev) => ({ ...prev, [b.originalIsbn]: e.target.value }))}
                              className={`w-40 rounded border px-2 py-0.5 font-mono text-xs disabled:opacity-40 ${
                                draft && !excluded
                                  ? draftValid
                                    ? "border-green-400 bg-green-50"
                                    : "border-red-400 bg-red-50"
                                  : "border-black/20 bg-white"
                              }`}
                              placeholder="z.B. 9783001234567"
                            />
                          </td>
                          <td className="py-1.5">
                            {excluded ? (
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() =>
                                  setIsbnExcluded((prev) => {
                                    const next = new Set(prev);
                                    next.delete(b.originalIsbn);
                                    return next;
                                  })
                                }
                              >
                                Wiederherstellen
                              </Button>
                            ) : (
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => setIsbnExcluded((prev) => new Set(prev).add(b.originalIsbn))}
                              >
                                Ausschließen
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Duplicate old IDs */}
          {duplicateStudents.length > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-900">ℹ Doppelte Schüler-IDs ({duplicateStudents.length})</p>
              <p className="mt-1 text-xs text-blue-800">
                Diese Schüler teilen sich eine alte ID und werden ohne ID-Verknüpfung importiert (kein
                Handlungsbedarf).
              </p>
              <ul className="mt-2 max-h-28 overflow-y-auto text-xs text-blue-900">
                {duplicateStudents.map((s) => (
                  <li key={s.legacyId} className="py-0.5">
                    {s.originalFirstname} {s.originalLastname} ({s.grade})
                    {s.oldId ? ` – ID: ${s.oldId}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Name corrections */}
          {nameFixStudents.length > 0 && (
            <div className="rounded-lg border border-black/10 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[#131820]">
                    Namenskorrekturen (
                    {nameFixStudents.filter((s) => applyNameFix.has(s.legacyId)).length}/{nameFixStudents.length}{" "}
                    ausgewählt)
                  </p>
                  <p className="mt-0.5 text-xs text-[#4b5563]">
                    Automatisch erkannte Zeichenkodierungsfehler. Abwählen = Originalname behalten.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => setApplyNameFix(new Set(nameFixStudents.map((s) => s.legacyId)))}
                  >
                    Alle
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => setApplyNameFix(new Set())}>
                    Keine
                  </Button>
                </div>
              </div>

              <div className="mt-3 max-h-72 overflow-y-auto rounded border border-black/10">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-black/10 text-left text-[#364152]">
                      <th className="w-6 px-2 py-1.5 font-medium" />
                      <th className="py-1.5 pr-3 font-medium">Vorher</th>
                      <th className="py-1.5 pr-3 font-medium">Nachher</th>
                      <th className="py-1.5 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {nameFixStudents.map((s) => {
                      const applied = applyNameFix.has(s.legacyId);
                      const override = nameOverrides.get(s.legacyId);
                      const displayFirst = override?.firstname ?? s.fixedFirstname;
                      const displayLast = override?.lastname ?? s.fixedLastname;
                      const isEditing = editingNameId === s.legacyId;

                      return (
                        <tr
                          key={s.legacyId}
                          className={`border-b border-black/5 last:border-0 ${!applied ? "opacity-40" : ""}`}
                        >
                          <td className="px-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={applied}
                              onChange={() => toggleNameFix(s.legacyId)}
                              className="cursor-pointer"
                              title={`Namenskorrektur für ${s.originalFirstname} ${s.originalLastname}`}
                            />
                          </td>
                          <td className="py-1.5 pr-3 text-[#6b7280]">
                            {s.originalFirstname} {s.originalLastname}
                          </td>
                          <td className="py-1.5 pr-3">
                            {isEditing ? (
                              <span className="flex gap-1">
                                <input
                                  type="text"
                                  value={nameDraft?.firstname ?? ""}
                                  onChange={(e) => setNameDraft((d) => (d ? { ...d, firstname: e.target.value } : null))}
                                  className="w-24 rounded border border-black/20 px-1.5 py-0.5"
                                  placeholder="Vorname"
                                />
                                <input
                                  type="text"
                                  value={nameDraft?.lastname ?? ""}
                                  onChange={(e) => setNameDraft((d) => (d ? { ...d, lastname: e.target.value } : null))}
                                  className="w-28 rounded border border-black/20 px-1.5 py-0.5"
                                  placeholder="Nachname"
                                />
                              </span>
                            ) : (
                              <span className="font-medium">
                                {displayFirst} {displayLast}
                              </span>
                            )}
                          </td>
                          <td className="py-1.5">
                            {isEditing ? (
                              <span className="flex gap-1">
                                <Button size="xs" onClick={() => saveEditName(s.legacyId)}>
                                  OK
                                </Button>
                                <Button size="xs" variant="outline" onClick={cancelEditName}>
                                  Abbruch
                                </Button>
                              </span>
                            ) : (
                              <Button size="xs" variant="outline" onClick={() => startEditName(s)}>
                                Bearbeiten
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Confirm bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/10 bg-[#f2f4f8] p-4">
            <div>
              <p className="text-sm font-semibold text-[#131820]">Bereit zum Import</p>
              <p className="text-xs text-[#4b5563]">
                Alle bestehenden App-Daten werden unwiderruflich überschrieben.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={reset}>
                Abbrechen
              </Button>
              <Button size="sm" onClick={() => void handleConfirm()}>
                Import durchführen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
