import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminUsersTable } from "@/components/admin/admin-users-table";

const ADMIN_ERRORS: Record<string, string> = {
  "invalid-role": "Die Rolle konnte nicht aktualisiert werden. Bitte wähle eine gültige Rolle.",
  "invalid-password": "Das Passwort muss mindestens 8 Zeichen lang sein.",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 px-6 py-8">
        <div className="w-full rounded-xl border border-black/10 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-[#131820]">Verwaltung</h1>
          <p className="mt-2 text-[#364152]">Dieser Bereich ist nur für Benutzer mit der Rolle ADMIN zugänglich.</p>
          <Link href="/" className="mt-4 inline-block font-semibold text-[#006b2d]">
            Zurück zur Startseite
          </Link>
        </div>
      </main>
    );
  }

  const params = await searchParams;
  const errorMessage = params.error ? ADMIN_ERRORS[params.error] : undefined;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      role: true,
      createdAt: true,
    },
  });

  const tableRows = users.map((user) => ({
    ...user,
    createdAt: user.createdAt.toISOString(),
  }));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 px-6 py-8">
      <div className="w-full space-y-4 rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold text-[#131820]">Verwaltung</h1>
          <p className="text-sm text-[#364152]">Benutzertypen verwalten und Passwörter zurücksetzen.</p>
        </div>

        {errorMessage ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="rounded-lg border border-black/10">
          <AdminUsersTable users={tableRows} />
        </div>
      </div>
    </main>
  );
}