export type WibImportIssue = {
  line: number;
  reason: string;
};

export type WibImportEntry = {
  line: number;
  entry: {
    course: string;
    lastname: string;
    firstname: string;
  };
};

function splitCsvLine(line: string, delimiter = ";") {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  fields.push(current.trim());
  return fields;
}

function cleanCell(value: string) {
  return value.replace(/^\uFEFF/, "").trim();
}

export function parseWibCsvPayload(text: string): { entries: WibImportEntry[]; issues: WibImportIssue[] } {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error("CSV-Datei ist leer");
  }

  const headers = splitCsvLine(lines[0]).map((value) => cleanCell(value).toLowerCase());
  const classIndex = headers.indexOf("klasse");
  const lastnameIndex = headers.indexOf("familienname");
  const firstnameIndex = headers.indexOf("rufname");

  if (classIndex < 0 || lastnameIndex < 0 || firstnameIndex < 0) {
    throw new Error("CSV-Header muss Klasse, Familienname und Rufname enthalten");
  }

  const entries: WibImportEntry[] = [];
  const issues: WibImportIssue[] = [];

  for (let lineIdx = 1; lineIdx < lines.length; lineIdx += 1) {
    const fields = splitCsvLine(lines[lineIdx]);
    const lineNumber = lineIdx + 1;

    const course = cleanCell(fields[classIndex] ?? "");
    const lastname = cleanCell(fields[lastnameIndex] ?? "");
    const firstname = cleanCell(fields[firstnameIndex] ?? "");

    if (!lastname || !firstname) {
      issues.push({
        line: lineNumber,
        reason: "Familienname und Rufname sind erforderlich",
      });
      continue;
    }

    entries.push({
      line: lineNumber,
      entry: {
        course,
        lastname,
        firstname,
      },
    });
  }

  return { entries, issues };
}

export function normalizeSchoolYear(input: string | null | undefined) {
  const trimmed = (input ?? "").trim();
  const slashMatch = trimmed.match(/^(\d{4})\s*\/\s*(\d{4})$/);
  if (slashMatch) {
    return `${slashMatch[1]}/${slashMatch[2]}`;
  }

  const yearMatch = trimmed.match(/^(\d{4})$/);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    return `${year}/${year + 1}`;
  }

  const now = new Date();
  const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}/${startYear + 1}`;
}