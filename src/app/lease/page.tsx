import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { parseStudentIdValue, STUDENT_SELECTION_COOKIE_KEY } from "@/lib/student-selection";
import { canAccessStudents } from "@/lib/students-access";
import { LeaseWorkflow } from "@/components/workflows/lease-workflow";

export default async function LeasePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!canAccessStudents(session?.user.role)) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const initialStudentId = parseStudentIdValue(cookieStore.get(STUDENT_SELECTION_COOKIE_KEY)?.value);
  if (initialStudentId) {
    redirect(`/lease/${initialStudentId}`);
  }

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
