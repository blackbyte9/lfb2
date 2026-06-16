import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { LegacySqlImportPanel } from "@/components/managers/legacy-sql-import-panel";

export default async function ImportLegacyPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 px-6 py-8">
      <div className="w-full space-y-4">
        <Link href="/admin?tab=imports" className="text-sm font-medium text-[#006b2d] hover:underline">
          ← Zurück zu Importen
        </Link>
        <LegacySqlImportPanel />
      </div>
    </main>
  );
}
