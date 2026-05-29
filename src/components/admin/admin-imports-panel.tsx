"use client";

import { useState } from "react";

import { deleteAllAppDataAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { useFileUpload } from "@/lib/useFileUpload";

type ImportIssue = {
  line: number;
  reason: string;
};

type NameFixProposal = {
  id: number;
  idOld: string;
  firstnameBefore: string;
  firstnameAfter: string;
  lastnameBefore: string;
  lastnameAfter: string;
  changedFields: Array<"firstname" | "lastname">;
};

type NameFixDraft = {
  firstname: string;
  lastname: string;
};

function currentSchoolYear() {
  const now = new Date();
  const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}/${startYear + 1}`;
}

export function AdminImportsPanel() {
  const [schoolYear, setSchoolYear] = useState(currentSchoolYear());
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [nameFixes, setNameFixes] = useState<NameFixProposal[]>([]);
  const [selectedNameFixIds, setSelectedNameFixIds] = useState<number[]>([]);
  const [editingNameFixIds, setEditingNameFixIds] = useState<number[]>([]);
  const [nameFixDrafts, setNameFixDrafts] = useState<Record<number, NameFixDraft>>({});
  const [nameFixInfo, setNameFixInfo] = useState<string | null>(null);
  const [nameFixError, setNameFixError] = useState<string | null>(null);
  const [nameFixLoading, setNameFixLoading] = useState(false);

  const {
    fileInputRef: booksInputRef,
    handleFileChange: handleBooksFile,
    triggerFileInput: triggerBooksFile,
    status: booksStatus,
    error: booksError,
    clearStatus: clearBooksStatus,
    acceptedTypes: booksAcceptedTypes,
  } = useFileUpload({
    endpoint: "/api/books/import",
    acceptedTypes: ".json",
    onSuccess: (data) => {
      const payload = data as { issues?: ImportIssue[] };
      setIssues(payload.issues ?? []);
    },
    onError: () => {
      setIssues([]);
    },
  });

  const {
    fileInputRef: itemsInputRef,
    handleFileChange: handleItemsFile,
    triggerFileInput: triggerItemsFile,
    status: itemsStatus,
    error: itemsError,
    clearStatus: clearItemsStatus,
    acceptedTypes: itemsAcceptedTypes,
  } = useFileUpload({
    endpoint: "/api/items/import",
    acceptedTypes: ".json",
    onSuccess: (data) => {
      const payload = data as { issues?: ImportIssue[] };
      setIssues(payload.issues ?? []);
    },
    onError: () => {
      setIssues([]);
    },
  });

  const {
    fileInputRef: studentsInputRef,
    handleFileChange: handleStudentsFile,
    triggerFileInput: triggerStudentsFile,
    status: studentsStatus,
    error: studentsError,
    clearStatus: clearStudentsStatus,
    acceptedTypes: studentsAcceptedTypes,
  } = useFileUpload({
    endpoint: "/api/students/import",
    acceptedTypes: ".json",
    appendFormData: (formData) => {
      formData.append("schoolYear", schoolYear.trim() || currentSchoolYear());
    },
    onSuccess: (data) => {
      const payload = data as { issues?: ImportIssue[] };
      setIssues(payload.issues ?? []);
    },
    onError: () => {
      setIssues([]);
    },
  });

  const {
    fileInputRef: studentsWibInputRef,
    handleFileChange: handleStudentsWibFile,
    triggerFileInput: triggerStudentsWibFile,
    status: studentsWibStatus,
    error: studentsWibError,
    clearStatus: clearStudentsWibStatus,
    acceptedTypes: studentsWibAcceptedTypes,
  } = useFileUpload({
    endpoint: "/api/students/import-wib",
    acceptedTypes: ".csv,text/csv",
    appendFormData: (formData) => {
      formData.append("schoolYear", schoolYear.trim() || currentSchoolYear());
    },
    onSuccess: (data) => {
      const payload = data as { issues?: ImportIssue[] };
      setIssues(payload.issues ?? []);
    },
    onError: () => {
      setIssues([]);
    },
  });

  const {
    fileInputRef: leasesInputRef,
    handleFileChange: handleLeasesFile,
    triggerFileInput: triggerLeasesFile,
    status: leasesStatus,
    error: leasesError,
    clearStatus: clearLeasesStatus,
    acceptedTypes: leasesAcceptedTypes,
  } = useFileUpload({
    endpoint: "/api/leases/import",
    acceptedTypes: ".json",
    onSuccess: (data) => {
      const payload = data as { issues?: ImportIssue[] };
      setIssues(payload.issues ?? []);
    },
    onError: () => {
      setIssues([]);
    },
  });

  const statusMessage = booksStatus ?? itemsStatus ?? studentsStatus ?? studentsWibStatus ?? leasesStatus ?? null;
  const errorMessage = booksError ?? itemsError ?? studentsError ?? studentsWibError ?? leasesError ?? null;

  async function handlePreviewNameFixes() {
    setNameFixLoading(true);
    setNameFixInfo(null);
    setNameFixError(null);

    const res = await fetch("/api/students/name-fixes/preview");
    const data = (await res.json()) as { error?: string; scanned?: number; fixes?: NameFixProposal[] };
    if (!res.ok) {
      setNameFixError(data.error ?? "Namensprüfung fehlgeschlagen");
      setNameFixLoading(false);
      return;
    }

    const fixes = data.fixes ?? [];
    setNameFixes(fixes);
    setSelectedNameFixIds(fixes.map((fix) => fix.id));
    setEditingNameFixIds([]);
    setNameFixDrafts(
      Object.fromEntries(
        fixes.map((fix) => [
          fix.id,
          {
            firstname: fix.firstnameAfter,
            lastname: fix.lastnameAfter,
          },
        ]),
      ),
    );
    setNameFixInfo(
      fixes.length > 0
        ? `${fixes.length} mögliche Korrekturen gefunden (von ${data.scanned ?? 0} Schülern).`
        : `Keine erkennbaren Kodierungsfehler gefunden (geprüft: ${data.scanned ?? 0}).`,
    );
    setNameFixLoading(false);
  }

  async function handleAcceptNameFixes() {
    if (nameFixes.length === 0 || selectedNameFixIds.length === 0) {
      setNameFixInfo("Keine Korrekturen ausgewählt");
      return;
    }

    setNameFixLoading(true);
    setNameFixError(null);

    const res = await fetch("/api/students/name-fixes/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: selectedNameFixIds,
        overrides: selectedNameFixIds.map((id) => ({
          id,
          firstname: nameFixDrafts[id]?.firstname,
          lastname: nameFixDrafts[id]?.lastname,
        })),
      }),
    });
    const data = (await res.json()) as { error?: string; message?: string };
    if (!res.ok) {
      setNameFixError(data.error ?? "Namenskorrekturen konnten nicht angewendet werden");
      setNameFixLoading(false);
      return;
    }

    setNameFixInfo(data.message ?? "Namenskorrekturen wurden angewendet");
    setNameFixes([]);
    setSelectedNameFixIds([]);
    setEditingNameFixIds([]);
    setNameFixDrafts({});
    setNameFixLoading(false);
  }

  function handleRejectNameFixes() {
    setNameFixes([]);
    setSelectedNameFixIds([]);
    setEditingNameFixIds([]);
    setNameFixDrafts({});
    setNameFixInfo("Korrekturvorschläge verworfen");
  }

  function toggleNameFixSelection(id: number) {
    setSelectedNameFixIds((prev) => (prev.includes(id) ? prev.filter((entryId) => entryId !== id) : [...prev, id]));
  }

  function rejectSingleNameFix(id: number) {
    setNameFixes((prev) => prev.filter((fix) => fix.id !== id));
    setSelectedNameFixIds((prev) => prev.filter((entryId) => entryId !== id));
    setEditingNameFixIds((prev) => prev.filter((entryId) => entryId !== id));
    setNameFixDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function startEditNameFix(id: number) {
    setEditingNameFixIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function cancelEditNameFix(id: number) {
    const proposal = nameFixes.find((fix) => fix.id === id);
    if (proposal) {
      setNameFixDrafts((prev) => ({
        ...prev,
        [id]: {
          firstname: proposal.firstnameAfter,
          lastname: proposal.lastnameAfter,
        },
      }));
    }

    setEditingNameFixIds((prev) => prev.filter((entryId) => entryId !== id));
  }

  function saveEditNameFix(id: number) {
    const draft = nameFixDrafts[id];
    if (!draft) {
      return;
    }

    setNameFixDrafts((prev) => ({
      ...prev,
      [id]: {
        firstname: draft.firstname.trim(),
        lastname: draft.lastname.trim(),
      },
    }));
    setEditingNameFixIds((prev) => prev.filter((entryId) => entryId !== id));
  }

  function updateNameFixDraft(id: number, field: "firstname" | "lastname", value: string) {
    setNameFixDrafts((prev) => ({
      ...prev,
      [id]: {
        firstname: field === "firstname" ? value : (prev[id]?.firstname ?? ""),
        lastname: field === "lastname" ? value : (prev[id]?.lastname ?? ""),
      },
    }));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-black/10 bg-[#f2f4f8] p-4">
        <label htmlFor="admin-import-school-year" className="mb-1 block text-xs font-medium text-[#364152]">
          Schuljahr (für Schülerimporte)
        </label>
        <input
          id="admin-import-school-year"
          value={schoolYear}
          onChange={(event) => setSchoolYear(event.target.value)}
          className="w-full max-w-xs rounded border border-black/20 bg-white px-2 py-1 text-sm"
          placeholder="2024/2025"
          aria-label="Schuljahr für Importe"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-black/10 p-3">
          <p className="text-sm font-semibold text-[#131820]">Bücher JSON</p>
          <p className="mt-1 text-xs text-[#4b5563]">Importiert Bücher über ISBN.</p>
          <input
            ref={booksInputRef}
            type="file"
            accept={booksAcceptedTypes}
            className="hidden"
            onChange={handleBooksFile}
            title="Bücher-Importdatei auswählen"
          />
          <Button
            size="sm"
            className="mt-3"
            onClick={() => {
              clearBooksStatus();
              setIssues([]);
              triggerBooksFile();
            }}
          >
            Datei wählen
          </Button>
        </div>

        <div className="rounded-lg border border-black/10 p-3">
          <p className="text-sm font-semibold text-[#131820]">Items JSON</p>
          <p className="mt-1 text-xs text-[#4b5563]">Ordnet Items per ISBN einem Buch zu.</p>
          <input
            ref={itemsInputRef}
            type="file"
            accept={itemsAcceptedTypes}
            className="hidden"
            onChange={handleItemsFile}
            title="Items-Importdatei auswählen"
          />
          <Button
            size="sm"
            className="mt-3"
            onClick={() => {
              clearItemsStatus();
              setIssues([]);
              triggerItemsFile();
            }}
          >
            Datei wählen
          </Button>
        </div>

        <div className="rounded-lg border border-black/10 p-3">
          <p className="text-sm font-semibold text-[#131820]">Schüler JSON</p>
          <p className="mt-1 text-xs text-[#4b5563]">Format: idOld, firstname, lastname, course.</p>
          <input
            ref={studentsInputRef}
            type="file"
            accept={studentsAcceptedTypes}
            className="hidden"
            onChange={handleStudentsFile}
            title="Schüler-Importdatei auswählen"
          />
          <Button
            size="sm"
            className="mt-3"
            onClick={() => {
              clearStudentsStatus();
              setIssues([]);
              triggerStudentsFile();
            }}
          >
            Datei wählen
          </Button>
        </div>

        <div className="rounded-lg border border-black/10 p-3">
          <p className="text-sm font-semibold text-[#131820]">Schüler WiB CSV</p>
          <p className="mt-1 text-xs text-[#4b5563]">Format: Klasse;Familienname;Rufname;Name.</p>
          <input
            ref={studentsWibInputRef}
            type="file"
            accept={studentsWibAcceptedTypes}
            className="hidden"
            onChange={handleStudentsWibFile}
            title="Schüler-WiB-CSV-Datei auswählen"
          />
          <Button
            size="sm"
            className="mt-3"
            onClick={() => {
              clearStudentsWibStatus();
              setIssues([]);
              triggerStudentsWibFile();
            }}
          >
            Datei wählen
          </Button>
        </div>

        <div className="rounded-lg border border-black/10 p-3">
          <p className="text-sm font-semibold text-[#131820]">Ausleihen JSON</p>
          <p className="mt-1 text-xs text-[#4b5563]">Felder: leased, returned, active, itemId, studentId.</p>
          <input
            ref={leasesInputRef}
            type="file"
            accept={leasesAcceptedTypes}
            className="hidden"
            onChange={handleLeasesFile}
            title="Ausleihen-Importdatei auswählen"
          />
          <Button
            size="sm"
            className="mt-3"
            onClick={() => {
              clearLeasesStatus();
              setIssues([]);
              triggerLeasesFile();
            }}
          >
            Datei wählen
          </Button>
        </div>
      </div>

      {statusMessage ? <p className="text-sm text-green-700">{statusMessage}</p> : null}
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
      {issues.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Übersprungene Zeilen</p>
          <ul className="mt-2 list-disc pl-5">
            {issues.map((issue) => (
              <li key={`${issue.line}-${issue.reason}`}>
                Zeile {issue.line}: {issue.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-lg border border-black/10 bg-[#f2f4f8] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[#131820]">Namenskonvertierung</p>
            <p className="mt-1 text-xs text-[#4b5563]">Prüft und korrigiert fehlerhafte Zeichenkodierung in Schülernamen.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void handlePreviewNameFixes()} disabled={nameFixLoading}>
            Namenkodierung prüfen
          </Button>
        </div>

        {nameFixInfo ? <p className="mt-3 text-sm text-[#1f4b2a]">{nameFixInfo}</p> : null}
        {nameFixError ? <p className="mt-3 text-sm text-red-600">{nameFixError}</p> : null}

        {nameFixes.length > 0 ? (
          <div className="mt-3 rounded-lg border border-[#b9d7be] bg-[#eef8f0] p-3 text-sm text-[#1f4b2a]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">Vorgeschlagene Namenskorrekturen ({selectedNameFixIds.length}/{nameFixes.length} ausgewählt)</p>
              <div className="flex items-center gap-2">
                <Button size="xs" onClick={() => void handleAcceptNameFixes()} disabled={nameFixLoading}>
                  Annehmen
                </Button>
                <Button size="xs" variant="outline" onClick={handleRejectNameFixes} disabled={nameFixLoading}>
                  Verwerfen
                </Button>
              </div>
            </div>
            <ul className="mt-2 list-disc pl-5">
              {nameFixes.map((fix) => (
                <li key={fix.id} className="list-none py-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedNameFixIds.includes(fix.id)}
                        onChange={() => toggleNameFixSelection(fix.id)}
                        aria-label={`Korrektur für ID ${fix.idOld} auswählen`}
                      />
                      <span>
                        ID {fix.idOld}: {fix.firstnameBefore} {fix.lastnameBefore} → {nameFixDrafts[fix.id]?.firstname ?? fix.firstnameAfter}{" "}
                        {nameFixDrafts[fix.id]?.lastname ?? fix.lastnameAfter}
                      </span>
                    </label>
                    {editingNameFixIds.includes(fix.id) ? (
                      <>
                        <input
                          type="text"
                          value={nameFixDrafts[fix.id]?.firstname ?? fix.firstnameAfter}
                          onChange={(event) => updateNameFixDraft(fix.id, "firstname", event.target.value)}
                          className="w-36 rounded border border-black/20 bg-white px-2 py-1 text-xs"
                          placeholder="Vorname"
                          aria-label={`Vorname für ID ${fix.idOld}`}
                        />
                        <input
                          type="text"
                          value={nameFixDrafts[fix.id]?.lastname ?? fix.lastnameAfter}
                          onChange={(event) => updateNameFixDraft(fix.id, "lastname", event.target.value)}
                          className="w-40 rounded border border-black/20 bg-white px-2 py-1 text-xs"
                          placeholder="Nachname"
                          aria-label={`Nachname für ID ${fix.idOld}`}
                        />
                        <Button size="xs" onClick={() => saveEditNameFix(fix.id)} disabled={nameFixLoading}>
                          Speichern
                        </Button>
                        <Button size="xs" variant="outline" onClick={() => cancelEditNameFix(fix.id)} disabled={nameFixLoading}>
                          Abbrechen
                        </Button>
                      </>
                    ) : (
                      <Button size="xs" variant="outline" onClick={() => startEditNameFix(fix.id)} disabled={nameFixLoading}>
                        Bearbeiten
                      </Button>
                    )}
                    <Button size="xs" variant="outline" onClick={() => rejectSingleNameFix(fix.id)} disabled={nameFixLoading}>
                      Einzeln verwerfen
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-red-800">Gefahrenbereich</p>
            <p className="mt-1 text-xs text-red-700">
              Löscht alle Anwendungsdaten wie Bücher, Items, Schüler, Ausleihen und Verlaufsdaten. Benutzerkonten bleiben erhalten.
            </p>
          </div>

          <form
            action={deleteAllAppDataAction}
            onSubmit={(event) => {
              const confirmed = window.confirm(
                "Alle Anwendungsdaten wirklich löschen? Benutzerkonten bleiben erhalten, aber Bücher, Items, Schüler und Ausleihen werden entfernt.",
              );
              if (!confirmed) {
                event.preventDefault();
              }
            }}
          >
            <Button size="sm" type="submit" className="bg-red-700 text-white hover:bg-red-800">
              Alle Daten löschen
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
