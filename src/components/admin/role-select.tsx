"use client";

import { updateUserRoleAction } from "@/app/admin/actions";

const USER_TYPES = ["GUEST", "USER", "ADMIN"] as const;

export function RoleSelect({ userId, userName, role }: { userId: string; userName: string; role: string }) {
  return (
    <form action={updateUserRoleAction}>
      <input name="userId" type="hidden" value={userId} />
      <select
        name="role"
        aria-label={`Role for ${userName}`}
        defaultValue={role}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-black/20 bg-white px-2 py-1"
      >
        {USER_TYPES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </form>
  );
}