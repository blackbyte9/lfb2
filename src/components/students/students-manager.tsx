"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { useFileUpload } from "@/lib/useFileUpload";

type StudentStatus = "ACTIVE" | "INACTIVE" | "SPECIAL";

export type StudentRow = {
  id: number;
  idOld: string | null;
  firstname: string;
  lastname: string;
  course: string;
  status: StudentStatus;
  activeLeasesCount: number;
  createdAt: string;
};

type Props = {
  initialStudents: StudentRow[];
  canManage: boolean;
};

type ImportIssue = {
  line: number;
  reason: string;
};

type StudentGradeHistoryRow = {
  id: number;
  schoolYear: string;
  grade: string;
  source: string;
  updatedAt: string;
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

const STUDENT_STATUSES: StudentStatus[] = ["ACTIVE", "INACTIVE", "SPECIAL"];

const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  ACTIVE: "Aktiv",
  INACTIVE: "Inaktiv",
  SPECIAL: "Spezial",
};

export function StudentsManager({ initialStudents, canManage }: Props) {
  const router = useRouter();
  const [students, setStudents] = useState<StudentRow[]>(initialStudents);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importIssues, setImportIssues] = useState<ImportIssue[]>([]);
  const [importSchoolYear, setImportSchoolYear] = useState(() => {
    const now = new Date();
    const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    return `${startYear}/${startYear + 1}`;
  });
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<"JSON" | "WIB" | null>(null);
  const [importYearDraft, setImportYearDraft] = useState(importSchoolYear);
  const [nameFixes, setNameFixes] = useState<NameFixProposal[]>([]);
  const [selectedNameFixIds, setSelectedNameFixIds] = useState<number[]>([]);
  const [editingNameFixIds, setEditingNameFixIds] = useState<number[]>([]);
  const [nameFixDrafts, setNameFixDrafts] = useState<Record<number, NameFixDraft>>({});
  const [nameFixInfo, setNameFixInfo] = useState<string | null>(null);
  const [nameFixLoading, setNameFixLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyStudent, setHistoryStudent] = useState<StudentRow | null>(null);
  const [historyRows, setHistoryRows] = useState<StudentGradeHistoryRow[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
  const [editIdOld, setEditIdOld] = useState("");
  const [editFirstname, setEditFirstname] = useState("");
  const [editLastname, setEditLastname] = useState("");
  const [editCourse, setEditCourse] = useState("");
  const [editStatus, setEditStatus] = useState<StudentStatus>("ACTIVE");

  const { fileInputRef, handleFileChange, triggerFileInput, status, error: uploadError, clearStatus, acceptedTypes } =
    useFileUpload({
      endpoint: "/api/students/import",
      onSuccess: async (data) => {
        const payload = data as { issues?: ImportIssue[] };
        setImportIssues(payload.issues ?? []);
        await refreshStudents();
      },
      onError: (err) => {
        setImportIssues([]);
        setError(err);
      },
      acceptedTypes: ".json",
      appendFormData: (formData) => {
        formData.append("schoolYear", importSchoolYear);
      },
    });

  const {
    fileInputRef: wibFileInputRef,
    handleFileChange: handleWibFileChange,
    triggerFileInput: triggerWibFileInput,
    status: wibStatus,
    error: wibUploadError,
    clearStatus: clearWibStatus,
    acceptedTypes: wibAcceptedTypes,
  } = useFileUpload({
    endpoint: "/api/students/import-wib",
    onSuccess: async (data) => {
      const payload = data as { issues?: ImportIssue[] };
      setImportIssues(payload.issues ?? []);
      await refreshStudents();
    },
    onError: (err) => {
      setImportIssues([]);
      setError(err);
    },
    acceptedTypes: ".csv,text/csv",
    appendFormData: (formData) => {
      formData.append("schoolYear", importSchoolYear);
    },
  });

  const {
    fileInputRef: leaseFileInputRef,
    handleFileChange: handleLeaseFileChange,
    triggerFileInput: triggerLeaseFileInput,
    status: leaseStatus,
    error: leaseUploadError,
    clearStatus: clearLeaseStatus,
    acceptedTypes: leaseAcceptedTypes,
  } = useFileUpload({
    endpoint: "/api/leases/import",
    onSuccess: async (data) => {
      const payload = data as { issues?: ImportIssue[] };
      setImportIssues(payload.issues ?? []);
      await refreshStudents();
    },
    onError: (err) => {
      setImportIssues([]);
      setError(err);
    },
    acceptedTypes: ".json",
  });

  const columns: ColumnDef<StudentRow>[] = [
    {
      accessorKey: "idOld",
      header: "Alte ID",
      enableSorting: false,
      cell: ({ row }) => <span>{row.original.idOld ?? "-"}</span>,
    },
    {
      accessorKey: "lastname",
      header: "Nachname",
      enableSorting: true,
      sortingFn: (rowA, rowB) => rowA.original.lastname.localeCompare(rowB.original.lastname, "de"),
    },
    {
      accessorKey: "firstname",
      header: "Vorname",
      enableSorting: true,
      sortingFn: (rowA, rowB) => rowA.original.firstname.localeCompare(rowB.original.firstname, "de"),
    },
    {
      accessorKey: "course",
      header: "Kurs",
      enableSorting: true,
      sortingFn: (rowA, rowB) => rowA.original.course.localeCompare(rowB.original.course, "de"),
    },
    {
      accessorKey: "status",
      header: "Status",
      enableSorting: false,
      cell: ({ row }) => {
        const student = row.original;
        if (!canManage) {
          return STUDENT_STATUS_LABELS[student.status];
        }

        return (
          <select
            value={student.status}
            className="rounded border border-black/20 bg-white px-2 py-1 text-xs"
            onChange={(event) => {
              void handleUpdateStatus(student.id, event.target.value as StudentStatus);
            }}
            aria-label={`Status für ${student.firstname} ${student.lastname}`}
          >
            {STUDENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STUDENT_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      id: "history",
      header: "Verlauf",
      enableSorting: false,
      cell: ({ row }) => (
        <Button size="xs" variant="outline" onClick={() => void handleOpenHistory(row.original)}>
          Verlauf
        </Button>
      ),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: "Aktionen",
            enableSorting: false,
            cell: ({ row }: { row: { original: StudentRow } }) => (
              <Button size="xs" variant="outline" onClick={() => openEditStudent(row.original)}>
                Bearbeiten
              </Button>
            ),
          } satisfies ColumnDef<StudentRow>,
        ]
      : []),
    {
      id: "activeLeasesCount",
      accessorFn: (row) => row.activeLeasesCount,
      header: "Ausgeliehen",
      enableSorting: true,
      sortingFn: (rowA, rowB) => rowA.original.activeLeasesCount - rowB.original.activeLeasesCount,
      cell: ({ row }) => (
        <span className={row.original.activeLeasesCount > 0 ? "font-medium text-amber-700" : "text-[#364152]"}>
          {row.original.activeLeasesCount}
        </span>
      ),
    },
    {
      id: "createdAt",
      accessorFn: (row) => row.createdAt,
      header: "Importiert",
      enableSorting: false,
      cell: ({ row }) => <span>{new Date(row.original.createdAt).toLocaleDateString("de-DE")}</span>,
    },
  ];

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return students;
    }

    return students.filter((student) => {
      const haystack = [
        student.idOld ?? "",
        student.firstname,
        student.lastname,
        `${student.firstname} ${student.lastname}`,
        student.course,
        STUDENT_STATUS_LABELS[student.status],
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [students, searchQuery]);

  async function refreshStudents() {
    const res = await fetch("/api/students");
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Schüler konnten nicht geladen werden");
      return;
    }

    const loaded = (await res.json()) as StudentRow[];
    setStudents(loaded);
    router.refresh();
  }

  function openImportModal(mode: "JSON" | "WIB") {
    setImportMode(mode);
    setImportYearDraft(importSchoolYear);
    setImportModalOpen(true);
  }

  function handleCancelImportModal() {
    setImportModalOpen(false);
    setImportMode(null);
  }

  function handleConfirmImportModal() {
    if (!importMode) {
      return;
    }

    setImportSchoolYear(importYearDraft.trim() || importSchoolYear);
    setError(null);
    setImportIssues([]);
    setImportModalOpen(false);

    if (importMode === "JSON") {
      clearStatus();
      triggerFileInput();
      return;
    }

    clearWibStatus();
    triggerWibFileInput();
  }

  function handleStartLeaseImport() {
    clearLeaseStatus();
    setError(null);
    setImportIssues([]);
    triggerLeaseFileInput();
  }

  async function handleUpdateStatus(id: number, status: StudentStatus) {
    setError(null);

    const res = await fetch(`/api/students/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const payload = (await res.json()) as { error?: string; status?: StudentStatus };
    if (!res.ok) {
      setError(payload.error ?? "Status konnte nicht gespeichert werden");
      return;
    }

    setStudents((prev) => prev.map((student) => (student.id === id ? { ...student, status } : student)));
  }

  async function handleOpenHistory(student: StudentRow) {
    setHistoryOpen(true);
    setHistoryStudent(student);
    setHistoryRows([]);
    setHistoryError(null);
    setHistoryLoading(true);

    const res = await fetch(`/api/students/${student.id}/grade-history`);
    const payload = (await res.json()) as { error?: string } | StudentGradeHistoryRow[];
    if (!res.ok) {
      const err = payload as { error?: string };
      setHistoryError(err.error ?? "Verlauf konnte nicht geladen werden");
      setHistoryLoading(false);
      return;
    }

    const rows = payload as StudentGradeHistoryRow[];
    setHistoryRows(rows);
    setHistoryLoading(false);
  }

  function handleCloseHistory() {
    setHistoryOpen(false);
    setHistoryStudent(null);
    setHistoryRows([]);
    setHistoryError(null);
    setHistoryLoading(false);
  }

  function openEditStudent(student: StudentRow) {
    setEditingStudentId(student.id);
    setEditIdOld(student.idOld ?? "");
    setEditFirstname(student.firstname);
    setEditLastname(student.lastname);
    setEditCourse(student.course);
    setEditStatus(student.status);
    setEditOpen(true);
  }

  function closeEditStudent() {
    setEditOpen(false);
    setEditingStudentId(null);
    setEditSaving(false);
  }

  async function saveEditStudent() {
    if (!editingStudentId) {
      return;
    }

    setEditSaving(true);
    setError(null);

    const res = await fetch(`/api/students/${editingStudentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idOld: editIdOld.trim() || null,
        firstname: editFirstname,
        lastname: editLastname,
        course: editCourse,
        status: editStatus,
      }),
    });
    const payload = (await res.json()) as { error?: string } & StudentRow;
    if (!res.ok) {
      setError(payload.error ?? "Schüler konnte nicht gespeichert werden");
      setEditSaving(false);
      return;
    }

    setStudents((prev) =>
      prev.map((student) => (student.id === editingStudentId ? { ...student, ...payload, createdAt: payload.createdAt } : student)),
    );
    setEditSaving(false);
    closeEditStudent();
  }

  async function handlePreviewNameFixes() {
    setNameFixLoading(true);
    setNameFixInfo(null);
    setError(null);

    const res = await fetch("/api/students/name-fixes/preview");
    const data = (await res.json()) as { error?: string; scanned?: number; suggested?: number; fixes?: NameFixProposal[] };
    if (!res.ok) {
      setError(data.error ?? "Namensprüfung fehlgeschlagen");
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
        ? `${fixes.length} mögliche Korrekturen gefunden (von ${data.scanned ?? students.length} Schülern).`
        : `Keine erkennbaren Kodierungsfehler gefunden (geprüft: ${data.scanned ?? students.length}).`,
    );
    setNameFixLoading(false);
  }

  async function handleAcceptNameFixes() {
    if (nameFixes.length === 0 || selectedNameFixIds.length === 0) {
      setNameFixInfo("Keine Korrekturen ausgewählt");
      return;
    }

    setNameFixLoading(true);
    setError(null);

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
      setError(data.error ?? "Namenskorrekturen konnten nicht angewendet werden");
      setNameFixLoading(false);
      return;
    }

    setNameFixInfo(data.message ?? "Namenskorrekturen wurden angewendet");
    setNameFixes([]);
    setSelectedNameFixIds([]);
    setEditingNameFixIds([]);
    setNameFixDrafts({});
    await refreshStudents();
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
      {canManage && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-black/10 bg-[#f2f4f8] p-3">
          <Button size="sm" variant="outline" onClick={() => openImportModal("JSON")}>
            JSON importieren
          </Button>
          <Button size="sm" variant="outline" onClick={() => openImportModal("WIB")}>
            WiB CSV importieren
          </Button>
          <input
            ref={wibFileInputRef}
            type="file"
            accept={wibAcceptedTypes}
            className="hidden"
            onChange={handleWibFileChange}
            aria-label="CSV-Datei zum Importieren aus WiB"
            title="CSV-Datei mit Klassenexport aus WiB hochladen"
          />
          <span className="text-xs text-[#364152]">WiB-CSV: Klasse;Familienname;Rufname;Name</span>
          <span className="text-xs text-[#364152]">Schuljahr wird vor dem Datei-Dialog abgefragt.</span>
          <Button size="sm" variant="outline" onClick={() => void handlePreviewNameFixes()} disabled={nameFixLoading}>
            Namenkodierung prüfen
          </Button>
          <Button size="sm" variant="outline" onClick={handleStartLeaseImport}>
            Ausleihen importieren
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedTypes}
            className="hidden"
            onChange={handleFileChange}
            aria-label="JSON-Datei zum Importieren von Schülern"
            title="JSON-Datei mit Schülereinträgen hochladen"
          />
          <span className="text-xs text-[#364152]">JSON: idOld, firstname, lastname, course</span>
          <input
            ref={leaseFileInputRef}
            type="file"
            accept={leaseAcceptedTypes}
            className="hidden"
            onChange={handleLeaseFileChange}
            aria-label="JSON-Datei zum Importieren von Ausleihen"
            title="JSON-Datei mit Ausleihen (studentId/itemId) hochladen"
          />
          <span className="text-xs text-[#364152]">Leases JSON: leased, returned, active, itemId, studentId</span>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-black/10 bg-[#f2f4f8] p-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="students-search" className="text-xs font-medium text-[#364152]">
            Schüler suchen
          </label>
          <input
            id="students-search"
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Name, alte ID, Kurs oder Status"
            className="w-72 rounded border border-black/20 bg-white px-2 py-1 text-sm outline-none focus:border-[#006b2d]"
            aria-label="Schüler suchen"
          />
        </div>
      </div>

      {status && <p className="text-sm text-green-700">{status}</p>}
      {wibStatus && <p className="text-sm text-green-700">{wibStatus}</p>}
      {leaseStatus && <p className="text-sm text-green-700">{leaseStatus}</p>}
      {nameFixInfo && <p className="text-sm text-[#1f4b2a]">{nameFixInfo}</p>}
      {(error || uploadError || wibUploadError || leaseUploadError) && (
        <p className="text-sm text-red-600">{error || uploadError || wibUploadError || leaseUploadError}</p>
      )}
      {importIssues.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Übersprungene Zeilen</p>
          <ul className="mt-2 list-disc pl-5">
            {importIssues.map((issue) => (
              <li key={`${issue.line}-${issue.reason}`}>
                Zeile {issue.line}: {issue.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {nameFixes.length > 0 && (
        <div className="rounded-lg border border-[#b9d7be] bg-[#eef8f0] p-3 text-sm text-[#1f4b2a]">
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
      )}

      <DataTable
        columns={columns}
        data={filteredStudents}
        emptyMessage="Keine Schüler gefunden."
        enableSorting
        onRowClick={(student) => router.push(`/students/${student.id}/leases`)}
      />

      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-4 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-[#131820]">Klassenverlauf</h3>
                <p className="mt-1 text-sm text-[#364152]">
                  {historyStudent ? `${historyStudent.firstname} ${historyStudent.lastname}` : "Schüler"}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={handleCloseHistory}>
                Schließen
              </Button>
            </div>

            <div className="mt-3 max-h-80 overflow-auto rounded border border-black/10">
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
                  ) : historyRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-[#364152]">
                        Kein Verlauf vorhanden.
                      </td>
                    </tr>
                  ) : (
                    historyRows.map((row) => (
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
          </div>
        </div>
      )}

      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
            <h3 className="text-lg font-semibold text-[#131820]">Import vorbereiten</h3>
            <p className="mt-1 text-sm text-[#364152]">
              {importMode === "WIB" ? "WiB CSV Import" : "JSON Import"} - bitte zuerst das Schuljahr festlegen.
            </p>

            <div className="mt-3">
              <label htmlFor="import-year-modal" className="mb-1 block text-xs font-medium text-[#364152]">
                Schuljahr
              </label>
              <input
                id="import-year-modal"
                value={importYearDraft}
                onChange={(event) => setImportYearDraft(event.target.value)}
                className="w-full rounded border border-black/20 bg-white px-2 py-1 text-sm"
                placeholder="2024/2025"
                aria-label="Schuljahr für den Import"
              />
              <p className="mt-1 text-xs text-[#4b5563]">
                Dieses Feld wirkt nur auf den nächsten Import und filtert nicht die Tabelle.
              </p>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={handleCancelImportModal}>
                Abbrechen
              </Button>
              <Button size="sm" onClick={handleConfirmImportModal}>
                Datei wählen
              </Button>
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow-lg">
            <h3 className="text-lg font-semibold text-[#131820]">Schüler bearbeiten</h3>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="edit-student-id-old" className="mb-1 block text-xs font-medium text-[#364152]">
                  Alte ID
                </label>
                <input
                  id="edit-student-id-old"
                  value={editIdOld}
                  onChange={(event) => setEditIdOld(event.target.value)}
                  className="w-full rounded border border-black/20 bg-white px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label htmlFor="edit-student-course" className="mb-1 block text-xs font-medium text-[#364152]">
                  Kurs
                </label>
                <input
                  id="edit-student-course"
                  value={editCourse}
                  onChange={(event) => setEditCourse(event.target.value)}
                  className="w-full rounded border border-black/20 bg-white px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label htmlFor="edit-student-firstname" className="mb-1 block text-xs font-medium text-[#364152]">
                  Vorname
                </label>
                <input
                  id="edit-student-firstname"
                  value={editFirstname}
                  onChange={(event) => setEditFirstname(event.target.value)}
                  className="w-full rounded border border-black/20 bg-white px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label htmlFor="edit-student-lastname" className="mb-1 block text-xs font-medium text-[#364152]">
                  Nachname
                </label>
                <input
                  id="edit-student-lastname"
                  value={editLastname}
                  onChange={(event) => setEditLastname(event.target.value)}
                  className="w-full rounded border border-black/20 bg-white px-2 py-1 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="edit-student-status" className="mb-1 block text-xs font-medium text-[#364152]">
                  Status
                </label>
                <select
                  id="edit-student-status"
                  value={editStatus}
                  onChange={(event) => setEditStatus(event.target.value as StudentStatus)}
                  className="w-full rounded border border-black/20 bg-white px-2 py-1 text-sm"
                >
                  {STUDENT_STATUSES.map((statusValue) => (
                    <option key={statusValue} value={statusValue}>
                      {STUDENT_STATUS_LABELS[statusValue]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={closeEditStudent} disabled={editSaving}>
                Abbrechen
              </Button>
              <Button size="sm" onClick={() => void saveEditStudent()} disabled={editSaving}>
                Speichern
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}