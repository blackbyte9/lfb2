import { headers } from "next/headers";

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
      items: {
        where: { status: { not: "REMOVED" } },
        select: {
          id: true,
          _count: { select: { leases: { where: { active: true } } } },
        },
      },
    },
  });

  const tableRows = books.map((book) => ({
    id: book.id,
    isbn: book.isbn,
    name: book.name,
    itemCount: book.items.length,
    leasedCount: book.items.filter((item) => item._count.leases > 0).length,
    createdAt: book.createdAt.toISOString(),
  }));

  const canManage = session?.user.role === "ADMIN" || session?.user.role === "USER";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 px-6 py-8">
      <div className="w-full space-y-4 rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-[#131820]">Bücher</h1>
        </div>
        <BooksManager initialBooks={tableRows} canManage={canManage} />
      </div>
    </main>
  );
}
