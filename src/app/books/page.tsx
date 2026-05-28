import { headers } from "next/headers";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BooksManager } from "@/components/books/books-manager";

export default async function BooksPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  const books = await prisma.book.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      isbn: true,
      name: true,
      createdAt: true,
      _count: { select: { items: { where: { status: { not: "REMOVED" } } } } },
    },
  });

  const tableRows = books.map((book) => ({
    id: book.id,
    isbn: book.isbn,
    name: book.name,
    itemCount: book._count.items,
    createdAt: book.createdAt.toISOString(),
  }));

  const isAdmin = session?.user.role === "ADMIN";
  const canManage = session?.user.role === "ADMIN" || session?.user.role === "USER";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 px-6 py-8">
      <div className="w-full space-y-4 rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-[#131820]">Bücher</h1>
          {isAdmin && (
            <Link href="/admin" className="text-sm font-medium text-[#006b2d] hover:underline">
              Zur Verwaltung
            </Link>
          )}
        </div>
        <BooksManager initialBooks={tableRows} canManage={canManage} />
      </div>
    </main>
  );
}
