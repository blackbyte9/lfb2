import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { logoutAction } from "@/app/auth/actions";

export async function SiteHeader() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <header className="h-14 bg-[#006b2d] text-white">
      <div className="mx-auto flex h-full w-full max-w-5xl items-center px-4">
        <nav aria-label="Hauptnavigation" className="flex w-full items-center justify-between text-sm font-semibold">
          <div className="flex items-center gap-4">
            <Link href="/" className="px-2 py-1 transition-opacity hover:opacity-90">
              LFB2
            </Link>
            <Link href="/books" className="px-2 py-1 transition-opacity hover:opacity-90">
              Bücher
            </Link>
            <Link href="/students" className="px-2 py-1 transition-opacity hover:opacity-90">
              Schüler
            </Link>
            {session?.user.role === "ADMIN" ? (
              <Link href="/admin" className="px-2 py-1 transition-opacity hover:opacity-90">
                Verwaltung
              </Link>
            ) : null}
          </div>

          <div className="flex items-center gap-4">
            {session ? (
              <>
                <span className="px-2 py-1 text-xs font-medium text-white/90">{session.user.name}</span>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="rounded-md bg-white px-3 py-1 text-sm font-semibold text-[#111827]"
                  >
                    Abmelden
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" className="px-2 py-1 transition-opacity hover:opacity-90">
                  Anmelden
                </Link>
                <Link href="/register" className="px-2 py-1 transition-opacity hover:opacity-90">
                  Registrieren
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
