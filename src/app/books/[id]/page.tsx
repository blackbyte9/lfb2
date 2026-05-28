import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";

import { BookItemsManager, type BookOption, type ItemRow } from "@/components/books/book-items-manager";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ itemId?: string }>;
};

export default async function BookItemsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { itemId } = await searchParams;
  const bookId = Number(id);

  if (Number.isNaN(bookId)) {
    notFound();
  }

  const session = await auth.api.getSession({ headers: await headers() });

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { id: true, isbn: true, name: true },
  });

  if (!book) {
    notFound();
  }

  const books = await prisma.book.findMany({
    orderBy: { name: "asc" },
    select: { id: true, isbn: true, name: true },
  });

  const items = await prisma.item.findMany({
    where: { bookId: book.id, status: { not: "REMOVED" } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      status: true,
      bookId: true,
      createdAt: true,
      updatedAt: true,
      leases: {
        where: { active: true },
        select: { studentId: true, student: { select: { firstname: true, lastname: true } } },
        take: 1,
      },
    },
  });

  const isAdmin = session?.user.role === "ADMIN";
  const canManage = session?.user.role === "ADMIN" || session?.user.role === "USER";

  const booksForClient: BookOption[] = books;
  const itemsForClient: ItemRow[] = items.map((item) => ({
    id: item.id,
    status: item.status,
    bookId: item.bookId,
    isLeased: item.leases.length > 0,
    leasedStudentId: item.leases[0]?.studentId ?? null,
    leasedStudentName: item.leases[0]
      ? `${item.leases[0].student.lastname}, ${item.leases[0].student.firstname}`
      : null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 px-6 py-8">
      <div className="w-full space-y-4 rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-[#131820]">Buch-Items</h1>
          {isAdmin && (
            <Link href="/admin" className="text-sm font-medium text-[#006b2d] hover:underline">
              Zur Verwaltung
            </Link>
          )}
        </div>

        <BookItemsManager
          book={book}
          books={booksForClient}
          initialItems={itemsForClient}
          canManage={canManage}
          highlightItemId={itemId ?? null}
        />
      </div>
    </main>
  );
}
