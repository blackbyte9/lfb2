import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { importLegacySql, type LegacySqlImportOverrides } from "@/lib/legacy-sql-import";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Keine Datei hochgeladen" }, { status: 400 });
    }

    const text = await file.text();

    let overrides: LegacySqlImportOverrides = { isbnFixes: [], studentNames: [] };
    const overridesRaw = formData.get("overrides");
    if (overridesRaw && typeof overridesRaw === "string") {
      try {
        overrides = JSON.parse(overridesRaw) as LegacySqlImportOverrides;
      } catch {
        // use defaults
      }
    }

    const result = await importLegacySql(text, overrides);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import fehlgeschlagen" },
      { status: 400 },
    );
  }
}
