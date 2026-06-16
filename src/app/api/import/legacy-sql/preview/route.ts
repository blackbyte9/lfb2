import { NextRequest } from "next/server";

import { readUploadedFileText, runManagedImport } from "@/lib/import-route";
import { previewLegacySql } from "@/lib/legacy-sql-import";

export async function POST(request: NextRequest) {
  return runManagedImport(request, {
    readText: () => readUploadedFileText(request),
    importText: async (text) => previewLegacySql(text),
  });
}
