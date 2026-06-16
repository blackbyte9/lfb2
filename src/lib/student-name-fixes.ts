type StudentNameCandidate = {
  id: number;
  idOld: string | null;
  firstname: string;
  lastname: string;
};

export type StudentNameFixProposal = {
  id: number;
  idOld: string;
  firstnameBefore: string;
  firstnameAfter: string;
  lastnameBefore: string;
  lastnameAfter: string;
  changedFields: Array<"firstname" | "lastname">;
};

const BROKEN_MARKER_REGEX = /(Ã.|Â.|â.|ð|Ð|Ñ|�)/g;
const UMLAUT_REGEX = /[ÄÖÜäöüß]/g;
const REPLACEMENT_CHAR = "�";
const REPLACEMENT_CANDIDATES = ["ä", "ö", "ü", "Ä", "Ö", "Ü", "ß"];

// Reverse map for cp1252-only characters so we can reconstruct original bytes.
const CP1252_BYTE_BY_CHAR = new Map<string, number>([
  ["€", 0x80],
  ["‚", 0x82],
  ["ƒ", 0x83],
  ["„", 0x84],
  ["…", 0x85],
  ["†", 0x86],
  ["‡", 0x87],
  ["ˆ", 0x88],
  ["‰", 0x89],
  ["Š", 0x8a],
  ["‹", 0x8b],
  ["Œ", 0x8c],
  ["Ž", 0x8e],
  ["‘", 0x91],
  ["’", 0x92],
  ["“", 0x93],
  ["”", 0x94],
  ["•", 0x95],
  ["–", 0x96],
  ["—", 0x97],
  ["˜", 0x98],
  ["™", 0x99],
  ["š", 0x9a],
  ["›", 0x9b],
  ["œ", 0x9c],
  ["ž", 0x9e],
  ["Ÿ", 0x9f],
]);

function scoreText(value: string) {
  const markerCount = value.match(BROKEN_MARKER_REGEX)?.length ?? 0;
  const replacementCount = value.split("�").length - 1;
  const umlautCount = value.match(UMLAUT_REGEX)?.length ?? 0;

  return markerCount * 5 + replacementCount * 8 - umlautCount;
}

function germanNameAffinity(value: string) {
  let score = 0;

  score += (value.match(UMLAUT_REGEX)?.length ?? 0) * 3;

  if (/sch[äöü]/i.test(value)) {
    score += 10;
  }

  if (/[äöüß][a-z]/i.test(value)) {
    score += 2;
  }

  if (/[^a-zA-ZäöüÄÖÜß\-\s']/u.test(value)) {
    score -= 8;
  }

  return score;
}

function enumerateReplacementCandidates(value: string) {
  const replacementCount = value.split(REPLACEMENT_CHAR).length - 1;
  if (replacementCount === 0 || replacementCount > 3) {
    return [value];
  }

  let candidates = [value];
  for (let i = 0; i < replacementCount; i += 1) {
    const next: string[] = [];
    for (const candidate of candidates) {
      const replacementIndex = candidate.indexOf(REPLACEMENT_CHAR);
      if (replacementIndex < 0) {
        next.push(candidate);
        continue;
      }

      for (const replacement of REPLACEMENT_CANDIDATES) {
        next.push(candidate.slice(0, replacementIndex) + replacement + candidate.slice(replacementIndex + 1));
      }
    }
    candidates = next;
  }

  return candidates;
}

function repairReplacementCharacters(value: string) {
  if (!value.includes(REPLACEMENT_CHAR)) {
    return value;
  }

  const candidates = enumerateReplacementCandidates(value);
  let best = value;
  let bestRank = scoreText(value) * 10 - germanNameAffinity(value);

  for (const candidate of candidates) {
    const rank = scoreText(candidate) * 10 - germanNameAffinity(candidate);
    if (rank < bestRank) {
      best = candidate;
      bestRank = rank;
    }
  }

  return best;
}

function decodeWindows1252AsUtf8(value: string) {
  const bytes: number[] = [];

  for (const char of value) {
    const code = char.codePointAt(0);
    if (code === undefined) {
      continue;
    }

    if (code <= 0xff) {
      bytes.push(code);
      continue;
    }

    const cp1252Byte = CP1252_BYTE_BY_CHAR.get(char);
    if (cp1252Byte !== undefined) {
      bytes.push(cp1252Byte);
      continue;
    }

    return value;
  }

  return Buffer.from(bytes).toString("utf8");
}

function guessFixedText(value: string) {
  if (!value.trim()) {
    return value;
  }

  const originalScore = scoreText(value);
  let best = value;
  let bestScore = originalScore;
  let current = value;

  for (let i = 0; i < 3; i += 1) {
    const decoded = decodeWindows1252AsUtf8(current);
    if (decoded === current) {
      break;
    }

    const decodedScore = scoreText(decoded);
    if (decodedScore < bestScore) {
      best = decoded;
      bestScore = decodedScore;
    }

    current = decoded;
  }

  const repaired = repairReplacementCharacters(best);
  if (repaired !== best) {
    const repairedScore = scoreText(repaired);
    if (repairedScore <= bestScore) {
      best = repaired;
      bestScore = repairedScore;
    }
  }

  return bestScore < originalScore ? best : value;
}

export { guessFixedText };

export function buildStudentNameFixProposals(students: StudentNameCandidate[]): StudentNameFixProposal[] {
  const fixes: StudentNameFixProposal[] = [];

  for (const student of students) {
    const firstnameAfter = guessFixedText(student.firstname);
    const lastnameAfter = guessFixedText(student.lastname);
    const changedFields: Array<"firstname" | "lastname"> = [];

    if (firstnameAfter !== student.firstname) {
      changedFields.push("firstname");
    }

    if (lastnameAfter !== student.lastname) {
      changedFields.push("lastname");
    }

    if (changedFields.length === 0) {
      continue;
    }

    fixes.push({
      id: student.id,
      idOld: student.idOld ?? "-",
      firstnameBefore: student.firstname,
      firstnameAfter,
      lastnameBefore: student.lastname,
      lastnameAfter,
      changedFields,
    });
  }

  return fixes;
}