import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { canAccessStudents } from "@/lib/students-access";
import { LeaseWorkflow } from "@/components/leases/lease-workflow";

type LeasePageProps = {
  searchParams: Promise<{ studentId?: string }>;
};

export default async function LeasePage({ searchParams }: LeasePageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!canAccessStudents(session?.user.role)) {
    redirect("/login");
  }

  const params = await searchParams;
  const parsedStudentId = Number(params.studentId);
  const initialStudentId = Number.isFinite(parsedStudentId) && parsedStudentId > 0 ? parsedStudentId : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 px-6 py-8">
      <div className="w-full space-y-4 rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-[#131820]">Ausleihe</h1>
        </div>
        <LeaseWorkflow initialStudentId={initialStudentId} />
      </div>
    </main>
  );
}
