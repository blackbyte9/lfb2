import Link from "next/link";

export function SiteHeader() {
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
          <Link href="/api/auth/signin" className="px-2 py-1 transition-opacity hover:opacity-90">
            Login
          </Link>
        </nav>
      </div>
    </header>
  );
}
