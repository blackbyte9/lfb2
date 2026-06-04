"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  canAccessStudents: boolean;
  isAdmin: boolean;
};

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNavLinks({ canAccessStudents, isAdmin }: Props) {
  const pathname = usePathname();

  const defaultClass = "px-2 py-1 transition-opacity hover:opacity-90";
  const activeClass = "rounded-md bg-white/20 px-2 py-1";

  return (
    <div className="flex items-center gap-4">
      <Link href="/" className={isActive(pathname, "/") ? activeClass : defaultClass}>
        LFB2
      </Link>
      {canAccessStudents ? (
        <Link
          href="/lease"
          className={`rounded-md px-3 py-1 font-bold ${
            isActive(pathname, "/lease") ? "bg-white text-[#0f172a]" : "bg-cyan-300 text-[#111827] hover:bg-cyan-200"
          }`}
        >
          Ausleihe
        </Link>
      ) : null}
      {canAccessStudents ? (
        <Link
          href="/return"
          className={`rounded-md px-3 py-1 font-bold ${
            isActive(pathname, "/return") ? "bg-white text-[#0f172a]" : "bg-amber-300 text-[#111827] hover:bg-amber-200"
          }`}
        >
          Rückgabe
        </Link>
      ) : null}
      <Link href="/books" className={isActive(pathname, "/books") ? activeClass : defaultClass}>
        Bücher
      </Link>
      {canAccessStudents ? (
        <Link href="/students" className={isActive(pathname, "/students") ? activeClass : defaultClass}>
          Schüler
        </Link>
      ) : null}
      {isAdmin ? (
        <Link href="/admin" className={isActive(pathname, "/admin") ? activeClass : defaultClass}>
          Verwaltung
        </Link>
      ) : null}
    </div>
  );
}
