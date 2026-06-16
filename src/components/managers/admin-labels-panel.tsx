"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const LABELS_PER_PAGE = 51; // 3 columns × 17 rows — must match API constant
const MAX_PAGES = 50;

type PrintRun = {
  id: number;
  pages: number;
  count: number;
  firstId: string;
  lastId: string;
  createdAt: string;
};

type HistoryResponse = {
  totalPrinted: number;
  runs: PrintRun[];
};

type Stage = "idle" | "allocating" | "rendering" | "done" | "error";

export function AdminLabelsPanel() {
  const [pages, setPages] = useState(1);
  const [stage, setStage] = useState<Stage>("idle");
  const [stageDetail, setStageDetail] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/labels/history")
      .then((res) => (res.ok ? (res.json() as Promise<HistoryResponse>) : null))
      .then((data) => { if (!cancelled && data) setHistory(data); })
      .catch(() => { /* silently ignore – history failing shouldn't block the UI */ })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [historyRefreshKey]);

  const totalLabels = pages * LABELS_PER_PAGE;

  async function handleGenerate() {
    setStage("allocating");
    setStageDetail("IDs werden reserviert…");
    setErrorMsg(null);

    try {
      const res = await fetch("/api/labels/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages }),
      });
      const data = (await res.json()) as { error?: string; labels?: string[]; firstId?: string; lastId?: string };
      if (!res.ok || !data.labels) {
        throw new Error(data.error ?? "Fehler beim Reservieren der IDs");
      }

      setStage("rendering");
      setStageDetail(`${data.labels.length} QR-Codes werden generiert…`);

      await generatePdf(data.labels, setStageDetail);

      setHistoryRefreshKey((k) => k + 1);
      setStage("done");
      setStageDetail(`${data.labels.length} Etiketten (${pages} Seite${pages !== 1 ? "n" : ""}) generiert: ${data.firstId} – ${data.lastId}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unbekannter Fehler");
      setStage("error");
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Generate section ──────────────────────────────────────────────── */}
      <div className="rounded-lg border border-black/10 bg-white p-5">
        <h2 className="text-base font-semibold text-[#131820]">Etiketten generieren</h2>
        <p className="mt-1 text-sm text-[#4b5563]">
          Erzeugt QR-Code-Etiketten als druckbares PDF. Die generierten IDs (Format{" "}
          <code className="rounded bg-[#f2f4f8] px-1 font-mono text-xs">RSV0000000</code>) werden gespeichert und
          nicht erneut vergeben.
        </p>
        <p className="mt-1 text-xs text-[#6b7280]">
          Layout: 3 Spalten × 17 Zeilen = {LABELS_PER_PAGE} Etiketten pro Seite (A4) · Code-39-Barcode + Logo
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="label-pages" className="mb-1 block text-xs font-medium text-[#364152]">
              Anzahl der Seiten (1–{MAX_PAGES})
            </label>
            <input
              id="label-pages"
              type="number"
              min={1}
              max={MAX_PAGES}
              value={pages}
              onChange={(e) => setPages(Math.max(1, Math.min(MAX_PAGES, parseInt(e.target.value) || 1)))}
              disabled={stage === "allocating" || stage === "rendering"}
              className="w-24 rounded border border-black/20 px-2 py-1.5 text-sm outline-none focus:border-[#006b2d] disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-[#6b7280]">
              = {totalLabels.toLocaleString("de")} Etiketten
            </p>
          </div>

          <Button
            onClick={() => void handleGenerate()}
            disabled={stage === "allocating" || stage === "rendering"}
            className="mb-5"
          >
            PDF erstellen & herunterladen
          </Button>
        </div>

        {/* Status feedback */}
        {(stage === "allocating" || stage === "rendering") && (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-black/10 bg-[#f2f4f8] px-4 py-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#006b2d] border-t-transparent" />
            <p className="text-sm text-[#364152]">{stageDetail}</p>
          </div>
        )}

        {stage === "done" && (
          <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
            <p className="text-sm font-medium text-green-800">✓ PDF wurde heruntergeladen</p>
            <p className="text-xs text-green-700">{stageDetail}</p>
          </div>
        )}

        {stage === "error" && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-medium text-red-800">Fehler</p>
            <p className="text-xs text-red-700">{errorMsg}</p>
            <Button
              size="xs"
              variant="outline"
              className="mt-2"
              onClick={() => { setStage("idle"); setErrorMsg(null); }}
            >
              Neu versuchen
            </Button>
          </div>
        )}
      </div>

      {/* ── History ─────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-black/10 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#131820]">Druckhistorie</h2>
          <Button size="xs" variant="outline" onClick={() => setHistoryRefreshKey((k) => k + 1)} disabled={historyLoading}>
            Aktualisieren
          </Button>
        </div>

        {historyLoading ? (
          <p className="mt-3 text-sm text-[#6b7280]">Lade…</p>
        ) : history ? (
          <>
            <p className="mt-2 text-sm text-[#364152]">
              Bisher gedruckt: <strong>{history.totalPrinted.toLocaleString("de")}</strong> Etikett
              {history.totalPrinted !== 1 ? "en" : ""}
            </p>
            {history.runs.length === 0 ? (
              <p className="mt-2 text-sm text-[#6b7280]">Noch keine Etiketten gedruckt.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded border border-black/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/10 bg-[#f2f4f8] text-left text-xs text-[#364152]">
                      <th className="px-3 py-2 font-medium">Datum</th>
                      <th className="px-3 py-2 font-medium">Seiten</th>
                      <th className="px-3 py-2 font-medium">Anzahl</th>
                      <th className="px-3 py-2 font-medium">Bereich</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.runs.map((run) => (
                      <tr key={run.id} className="border-b border-black/5 last:border-0">
                        <td className="px-3 py-2 text-xs">
                          {new Date(run.createdAt).toLocaleString("de-DE", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-3 py-2 text-xs">{run.pages}</td>
                        <td className="px-3 py-2 text-xs">{run.count}</td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {run.firstId} – {run.lastId}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PDF generation (client-side, dynamic imports to avoid SSR)
// ---------------------------------------------------------------------------
// Layout taken verbatim from RSV_Etiketten(23 0000-2999).avery (twips → mm):
//   A4, 3 cols × 17 rows = 51 labels/page
//   Label  : 70.00 × 16.90 mm  (no horiz. margin; 4.85 mm top/bottom)
//   Logo   : x=4.89  y=3.11  w=11.31  h=10.68 mm
//   Barcode: x=17.20 y=3.16  w=48.49  h=10.41 mm  (Code 39 Extended)
//            BAR_X shifted to logo right edge (16.20mm) + 1mm gap so the
//            barcode never overlaps the logo image.
// ---------------------------------------------------------------------------

const TWIP = 25.4 / 1440; // 1 twip in mm
const tw = (t: number) => t * TWIP;

// Label and element dimensions in mm, from Avery XML (in twips)
const LBL_W    = tw(3968.50396);  // 70.00 mm
const LBL_H    = tw(958.11024);   // 16.90 mm
const MARGIN_Y = tw(274.96063);   //  4.85 mm (top of first row)

const LOGO_X = tw(277.5);         //  4.89 mm  from label left
const LOGO_Y = tw(176.25);        //  3.11 mm  from label top
const LOGO_W = tw(641.06);        // 11.31 mm
const LOGO_H = tw(605.61);        // 10.68 mm

// Barcode starts 1 mm after the logo's right edge (4.89 + 11.31 + 1 = 17.20 mm)
// to avoid any overlap with the logo; right edge stays at ~65.69 mm.
const BAR_X = LOGO_X + LOGO_W + 1; // 17.20 mm  from label left
const BAR_Y = tw(179.27);           //  3.16 mm  from label top
const BAR_W = tw(3724.46) - BAR_X;  // ~48.49 mm (original right edge − new left)
const BAR_H = tw(590);              // 10.41 mm

async function generatePdf(labelIds: string[], onProgress: (msg: string) => void) {
  const [{ default: jsPDF }, bwipjs] = await Promise.all([
    import("jspdf"),
    import("bwip-js"),
  ]);

  const COLS = 3;
  const ROWS = 17;
  const LABELS_PER_PAGE_LOCAL = COLS * ROWS; // 51

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Load school logo once
  onProgress("Logo wird geladen…");
  const logoDataUrl = await loadImageAsDataUrl("/school-logo.jpg");

  // Generate all Code-39-Extended barcodes
  onProgress(`${labelIds.length} Barcodes werden generiert…`);
  const barcodeDataUrls = await Promise.all(
    labelIds.map((id) => generateCode39DataUrl(bwipjs as BwipJs, id)),
  );

  onProgress("PDF wird zusammengestellt…");

  for (let i = 0; i < labelIds.length; i++) {
    const posOnPage = i % LABELS_PER_PAGE_LOCAL;

    if (i > 0 && posOnPage === 0) {
      doc.addPage();
    }

    const col = posOnPage % COLS;
    const row = Math.floor(posOnPage / COLS);

    // Top-left corner of this label
    const lx = col * LBL_W;
    const ly = MARGIN_Y + row * LBL_H;

    // Light dashed cut guide
    doc.setDrawColor(200, 200, 200);
    doc.setLineDashPattern([0.6, 0.6], 0);
    doc.rect(lx, ly, LBL_W, LBL_H);
    doc.setLineDashPattern([], 0);

    // Logo — left side
    doc.addImage(logoDataUrl, "JPEG", lx + LOGO_X, ly + LOGO_Y, LOGO_W, LOGO_H);

    // Barcode — right of logo
    doc.addImage(barcodeDataUrls[i]!, "PNG", lx + BAR_X, ly + BAR_Y, BAR_W, BAR_H);
  }

  const date = new Date().toISOString().slice(0, 10);
  doc.save(`RSV-Etiketten-${date}.pdf`);
}

// ── helpers ────────────────────────────────────────────────────────────────

function loadImageAsDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.95));
    };
    img.onerror = reject;
    img.src = url;
  });
}

type BwipJs = {
  toCanvas: (canvas: HTMLCanvasElement, opts: Record<string, unknown>) => void;
};

function generateCode39DataUrl(bwipjs: BwipJs, text: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement("canvas");
      bwipjs.toCanvas(canvas, {
        bcid: "code39ext",
        text,
        scale: 3,
        height: 8,          // bar height in mm (bwip internal units ≈ mm)
        includetext: true,
        textxalign: "center",
        textsize: 7,
        paddingwidth: 0,
        paddingheight: 0,
      });
      resolve(canvas.toDataURL("image/png"));
    } catch (e) {
      reject(e);
    }
  });
}
