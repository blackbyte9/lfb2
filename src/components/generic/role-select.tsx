"use client";

import { useState, useTransition } from "react";

import { updateUserRoleAction } from "@/app/admin/actions";

const USER_TYPES = ["GUEST", "USER", "ADMIN"] as const;

const ROLE_LABELS: Record<(typeof USER_TYPES)[number], string> = {
  GUEST: "Gast",
  USER: "Benutzer",
  ADMIN: "Administrator",
};

export function RoleSelect({ userId, userName, role }: { userId: string; userName: string; role: string }) {
  const [selectedRole, setSelectedRole] = useState(role);
  const [isPending, startTransition] = useTransition();

  async function handleRoleChange(nextRole: string) {
    setSelectedRole(nextRole);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("userId", userId);
      formData.set("role", nextRole);
      await updateUserRoleAction(formData);
    });
  }

  return (
    <select
      name="role"
      aria-label={`Rolle fur ${userName}`}
      value={selectedRole}
      onChange={(event) => void handleRoleChange(event.target.value)}
      disabled={isPending}
      className="rounded-md border border-black/20 bg-white px-2 py-1 disabled:opacity-60"
    >
      {USER_TYPES.map((value) => (
        <option key={value} value={value}>
          {ROLE_LABELS[value]}
        </option>
      ))}
    </select>
  );
}