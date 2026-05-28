import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessStudents } from "@/lib/students-access";
import { StudentsManager } from "@/components/students/students-manager";

export default async function StudentsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const canAccess = canAccessStudents(session?.user.role);
  if (!canAccess) {
    redirect("/login");
  }

  const students = await prisma.student.findMany({
    orderBy: [{ lastname: "asc" }, { firstname: "asc" }, { idOld: "asc" }],
    select: {
      id: true,
      idOld: true,
      firstname: true,
      lastname: true,
      course: true,
      status: true,
      createdAt: true,
      _count: { select: { leases: { where: { active: true } } } },
    },
  });

  const tableRows = students.map((student) => ({
    id: student.id,
    idOld: student.idOld,
    firstname: student.firstname,
    lastname: student.lastname,
    course: student.course,
    status: student.status,
    activeLeasesCount: student._count.leases,
    createdAt: student.createdAt.toISOString(),
  }));

  const canManage = canAccess;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 px-6 py-8">
      <div className="w-full space-y-4 rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-[#131820]">Schüler</h1>
        </div>
        <StudentsManager initialStudents={tableRows} canManage={canManage} />
      </div>
    </main>
  );
}