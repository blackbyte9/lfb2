import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { exportAllAppData } from "@/lib/app-data-export-import";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  try {
    const data = await exportAllAppData();
    const json = JSON.stringify(data, null, 2);
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="lfb-export-${date}.json"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export fehlgeschlagen" },
      { status: 500 },
    );
  }
}
