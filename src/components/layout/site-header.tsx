import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { logoutAction } from "@/app/auth/actions";

export async function SiteHeader() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <header className="h-14 bg-[#006b2d] text-white">
      <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-center px-4">
        <nav aria-label="Main" className="flex items-center gap-4 text-sm font-semibold">
          <Link href="/" className="px-2 py-1 transition-opacity hover:opacity-90">
            LFB2
          </Link>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md bg-white px-4 py-2 text-sm font-medium text-[#111827] shadow-sm"
          >
            Daten
            <span aria-hidden="true" className="text-xs leading-none">
              v
            </span>
          </button>

          {session ? (
            <>
              {session.user.role === "ADMIN" ? (
                <Link href="/admin" className="px-2 py-1 transition-opacity hover:opacity-90">
                  Admin
                </Link>
              ) : null}

              <span className="px-2 py-1 text-xs font-medium text-white/90">{session.user.name}</span>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded-md bg-white px-3 py-1 text-sm font-semibold text-[#111827]"
                >
                  Logout
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="px-2 py-1 transition-opacity hover:opacity-90">
                Login
              </Link>
              <Link href="/register" className="px-2 py-1 transition-opacity hover:opacity-90">
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
