import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { parseStudentIdValue } from "@/lib/student-selection";
import { canAccessStudents } from "@/lib/students-access";
import { ReturnWorkflow } from "@/components/returns/return-workflow";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ReturnStudentPage({ params }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!canAccessStudents(session?.user.role)) {
    redirect("/login");
  }

  const { id } = await params;
  const studentId = parseStudentIdValue(id);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 px-6 py-8">
      <div className="w-full space-y-4 rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-[#131820]">Rückgabe</h1>
        </div>
        <ReturnWorkflow initialStudentId={studentId} resetSelectionOnMount={studentId === null} />
      </div>
    </main>
  );
}
