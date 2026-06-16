import { NextRequest } from "next/server";

import { readUploadedFileText, runManagedImport } from "@/lib/import-route";
import { importAllAppData } from "@/lib/app-data-export-import";

export async function POST(request: NextRequest) {
  return runManagedImport(request, {
    readText: () => readUploadedFileText(request),
    importText: (text) => importAllAppData(JSON.parse(text)),
  });
}
