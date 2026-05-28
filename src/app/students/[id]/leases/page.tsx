import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessStudents } from "@/lib/students-access";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function StudentLeasesPage({ params }: Props) {
  const { id } = await params;
  const studentId = Number(id);

  if (Number.isNaN(studentId)) {
    notFound();
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!canAccessStudents(session?.user.role)) {
    redirect("/login");
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      idOld: true,
      firstname: true,
      lastname: true,
      course: true,
    },
  });

  if (!student) {
    notFound();
  }

  const leases = await prisma.lease.findMany({
    where: { studentId, active: true },
    orderBy: { leasedAt: "desc" },
    select: {
      id: true,
      leasedAt: true,
      returnedAt: true,
      item: {
        select: {
          id: true,
          status: true,
          book: {
            select: {
              id: true,
              isbn: true,
              name: true,
            },
          },
        },
      },
    },
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 px-6 py-8">
      <div className="w-full space-y-4 rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#131820]">
              {student.lastname}, {student.firstname}
            </h1>
            <p className="mt-0.5 text-sm text-[#364152]">
              {student.idOld ? <span className="mr-3">ID: {student.idOld}</span> : null}
              Klasse: {student.course}
            </p>
          </div>
          <Link href="/students" className="text-sm font-medium text-[#006b2d] hover:underline">
            ← Zur Schülerliste
          </Link>
        </div>

        <h2 className="text-lg font-medium text-[#131820]">
          Aktuelle Ausleihen{" "}
          <span className="text-sm font-normal text-[#364152]">({leases.length})</span>
        </h2>

        {leases.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#364152]">Keine aktiven Ausleihen vorhanden.</p>
        ) : (
          <div className="rounded-lg border border-black/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#f2f4f8]">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-[#364152]">Buchtitel</th>
                  <th className="px-4 py-3 text-left font-medium text-[#364152]">ISBN</th>
                  <th className="px-4 py-3 text-left font-mono font-medium text-[#364152]">Item-ID</th>
                  <th className="px-4 py-3 text-left font-medium text-[#364152]">Ausgeliehen am</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {leases.map((lease) => (
                  <tr key={lease.id} className="hover:bg-[#f8faf8]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/books/${lease.item.book.id}?itemId=${lease.item.id}`}
                        className="font-medium text-[#131820] hover:text-[#006b2d] hover:underline"
                      >
                        {lease.item.book.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#364152]">{lease.item.book.isbn}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#364152]">{lease.item.id}</td>
                    <td className="px-4 py-3 text-[#364152]">
                      {new Date(lease.leasedAt).toLocaleDateString("de-DE")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
