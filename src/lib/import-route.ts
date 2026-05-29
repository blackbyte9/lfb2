import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";

type RunImportOptions<TResult> = {
  readText: () => Promise<string>;
  importText: (text: string) => Promise<TResult>;
  unauthorizedMessage?: string;
  unauthorizedStatus?: number;
  failureMessage?: string;
  failureStatus?: number;
};

export async function readUploadedFileText(request: NextRequest, fieldName = "file") {
  const formData = await request.formData();
  const file = formData.get(fieldName);
  if (!file || typeof file === "string") {
    throw new Error("Keine Datei hochgeladen");
  }

  return file.text();
}

export async function runManagedImport<TResult>(request: NextRequest, options: RunImportOptions<TResult>): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });
  const canManage = session?.user.role === "ADMIN";
  if (!canManage) {
    return NextResponse.json(
      { error: options.unauthorizedMessage ?? "Nicht autorisiert" },
      { status: options.unauthorizedStatus ?? 403 },
    );
  }

  try {
    const text = await options.readText();
    const result = await options.importText(text);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : options.failureMessage ?? "Import fehlgeschlagen",
      },
      { status: options.failureStatus ?? 400 },
    );
  }
}