import Link from "next/link";
import { loginAction } from "@/app/auth/actions";

const LOGIN_ERRORS: Record<string, string> = {
  "missing-fields": "Please enter both username and password.",
  "invalid-credentials": "Invalid username or password.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const message = params.error ? LOGIN_ERRORS[params.error] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center px-6 py-10">
      <div className="w-full max-w-md rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-[#131820]">Login</h1>
        <p className="mt-1 text-sm text-[#364152]">Sign in with your username and password.</p>

        {message ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {message}
          </p>
        ) : null}

        <form action={loginAction} className="mt-5 space-y-4">
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
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-black/20 px-3 py-2 text-sm"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-md bg-[#006b2d] px-4 py-2 text-sm font-semibold text-white"
          >
            Sign in
          </button>
        </form>

        <p className="mt-4 text-sm text-[#364152]">
          No account yet? <Link href="/register" className="font-semibold text-[#006b2d]">Register here</Link>
        </p>
      </div>
    </main>
  );
}