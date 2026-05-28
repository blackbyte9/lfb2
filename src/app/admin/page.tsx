import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateUserPasswordAction } from "@/app/admin/actions";
import { RoleSelect } from "@/components/admin/role-select";

const ADMIN_ERRORS: Record<string, string> = {
  "invalid-role": "Could not update role. Please choose a valid role.",
  "invalid-password": "Password must be at least 8 characters long.",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 px-6 py-8">
        <div className="w-full rounded-xl border border-black/10 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-[#131820]">Admin Panel</h1>
          <p className="mt-2 text-[#364152]">This area is only accessible to users with role ADMIN.</p>
          <Link href="/" className="mt-4 inline-block font-semibold text-[#006b2d]">
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  const params = await searchParams;
  const errorMessage = params.error ? ADMIN_ERRORS[params.error] : undefined;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      role: true,
      createdAt: true,
    },
  });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 px-6 py-8">
      <div className="w-full space-y-4 rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold text-[#131820]">Admin Panel</h1>
          <p className="text-sm text-[#364152]">Manage user type and reset passwords.</p>
        </div>

        {errorMessage ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-lg border border-black/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#f2f4f8] text-[#111827]">
              <tr>
                <th className="px-3 py-2 font-semibold">User</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Reset Password</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-black/10 align-top">
                  <td className="px-3 py-3">
                    <p className="font-medium text-[#131820]">{user.name}</p>
                    <p className="text-[#364152]">{user.email}</p>
                    <p className="text-xs text-[#4b5563]">
                      @{user.username ?? "no-username"} | {user.createdAt.toLocaleDateString()}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <RoleSelect userId={user.id} userName={user.name} role={user.role} />
                  </td>
                  <td className="px-3 py-3">
                    <form action={updateUserPasswordAction} className="flex items-center gap-2">
                      <input name="userId" type="hidden" value={user.id} />
                      <input
                        name="newPassword"
                        type="password"
                        minLength={8}
                        placeholder="new password"
                        className="w-44 rounded-md border border-black/20 px-2 py-1"
                      />
                      <button
                        type="submit"
                        className="rounded-md bg-[#111827] px-3 py-1 text-xs font-semibold text-white"
                      >
                        Update
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}