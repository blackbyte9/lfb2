import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 px-6 py-6">
      <div className="space-y-4">
        <h1 className="text-[2rem] font-normal leading-none tracking-tight text-[#161b24] sm:text-[2.1rem]">
          Schulbuch Manager
        </h1>

        {session ? (
          <div className="rounded-lg border border-black/10 bg-white px-4 py-3 text-sm">
            <p>
              Angemeldet als <strong>{session.user.name}</strong> (@{session.user.username ?? "-"})
            </p>
            <p>
              Aktuelle Rolle: <strong>{session.user.role}</strong>
            </p>
            {session.user.role === "ADMIN" ? (
              <Link href="/admin" className="mt-2 inline-block font-semibold text-[#006b2d]">
                Zur Verwaltung
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-black/10 bg-white px-4 py-3 text-sm">
            <p>Du bist nicht angemeldet.</p>
            <p className="mt-1">
              <Link href="/login" className="font-semibold text-[#006b2d]">
                Anmelden
              </Link>{" "}
              oder{" "}
              <Link href="/register" className="font-semibold text-[#006b2d]">
                registrieren
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
