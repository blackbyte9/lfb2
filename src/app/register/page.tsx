import Link from "next/link";
import { registerAction } from "@/app/auth/actions";

const REGISTER_ERRORS: Record<string, string> = {
  "missing-fields": "Please complete every field.",
  "signup-failed": "Registration failed. Username or email may already exist.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const message = params.error ? REGISTER_ERRORS[params.error] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center px-6 py-10">
      <div className="w-full max-w-md rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-[#131820]">Register</h1>
        <p className="mt-1 text-sm text-[#364152]">
          New accounts are created with role <strong>GUEST</strong>.
        </p>

        {message ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {message}
          </p>
        ) : null}

        <form action={registerAction} className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-[#111827]">
            Name
            <input name="name" className="mt-1 w-full rounded-md border border-black/20 px-3 py-2 text-sm" />
          </label>

          <label className="block text-sm font-medium text-[#111827]">
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-md border border-black/20 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium text-[#111827]">
            Username
            <input
              name="username"
              autoComplete="username"
              className="mt-1 w-full rounded-md border border-black/20 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium text-[#111827]">
            Password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              className="mt-1 w-full rounded-md border border-black/20 px-3 py-2 text-sm"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-md bg-[#006b2d] px-4 py-2 text-sm font-semibold text-white"
          >
            Create account
          </button>
        </form>

        <p className="mt-4 text-sm text-[#364152]">
          Already have an account? <Link href="/login" className="font-semibold text-[#006b2d]">Login here</Link>
        </p>
      </div>
    </main>
  );
}