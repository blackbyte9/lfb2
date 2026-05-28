import { defaultItemImportEntrySchema } from "@/lib/book-schemas";

type RawItemImportEntry = {
  id: string;
  status: "NEW" | "USED" | "DAMAGED" | "REMOVED";
  bookId: string;
};

export type ItemImportIssue = {
  line: number;
  reason: string;
};

export type ParsedItemImportEntry = {
  line: number;
  entry: RawItemImportEntry;
};

export function parseItemImportPayload(payload: unknown): {
  entries: ParsedItemImportEntry[];
  issues: ItemImportIssue[];
} {
  if (!Array.isArray(payload)) {
    throw new Error("Die Datei muss ein JSON-Array enthalten");
  }

  const entries: ParsedItemImportEntry[] = [];
  const issues: ItemImportIssue[] = [];

  for (const [index, rawEntry] of payload.entries()) {
    const parsed = defaultItemImportEntrySchema.safeParse(rawEntry);
    if (!parsed.success) {
      issues.push({
        line: index + 1,
        reason: parsed.error.issues[0]?.message ?? "Ungültiger Eintrag",
      });
      continue;
    }

    entries.push({
      line: index + 1,
      entry: parsed.data,
    });
  }

  return { entries, issues };
}