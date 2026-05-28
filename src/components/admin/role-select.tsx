"use client";

import { updateUserRoleAction } from "@/app/admin/actions";

const USER_TYPES = ["GUEST", "USER", "ADMIN"] as const;

const ROLE_LABELS: Record<(typeof USER_TYPES)[number], string> = {
  GUEST: "Gast",
  USER: "Benutzer",
  ADMIN: "Administrator",
};

export function RoleSelect({ userId, userName, role }: { userId: string; userName: string; role: string }) {
  return (
    <form action={updateUserRoleAction}>
      <input name="userId" type="hidden" value={userId} />
      <select
        name="role"
        aria-label={`Rolle fur ${userName}`}
        defaultValue={role}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-black/20 bg-white px-2 py-1"
      >
        {USER_TYPES.map((value) => (
          <option key={value} value={value}>
            {ROLE_LABELS[value]}
          </option>
        ))}
      </select>
    </form>
  );
}