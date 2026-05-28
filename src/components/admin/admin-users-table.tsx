"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { updateUserPasswordAction } from "@/app/admin/actions";
import { RoleSelect } from "@/components/admin/role-select";
import { DataTable } from "@/components/ui/data-table";

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: string;
  createdAt: string;
};

const columns: ColumnDef<AdminUserRow>[] = [
  {
    accessorKey: "name",
    header: "Benutzer",
    cell: ({ row }) => {
      const user = row.original;

      return (
        <div>
          <p className="font-medium text-[#131820]">{user.name}</p>
          <p className="text-[#364152]">{user.email}</p>
          <p className="text-xs text-[#4b5563]">
            @{user.username ?? "kein-benutzername"} | {new Date(user.createdAt).toLocaleDateString("de-DE")}
          </p>
        </div>
      );
    },
  },
  {
    accessorKey: "role",
    header: "Typ",
    cell: ({ row }) => {
      const user = row.original;
      return <RoleSelect userId={user.id} userName={user.name} role={user.role} />;
    },
  },
  {
    id: "password",
    header: "Passwort zurucksetzen",
    cell: ({ row }) => {
      const user = row.original;

      return (
        <form action={updateUserPasswordAction} className="flex items-center gap-2">
          <input name="userId" type="hidden" value={user.id} />
          <input
            name="newPassword"
            type="password"
            minLength={8}
            placeholder="neues Passwort"
            className="w-44 rounded-md border border-black/20 px-2 py-1"
          />
          <button type="submit" className="rounded-md bg-[#111827] px-3 py-1 text-xs font-semibold text-white">
            Aktualisieren
          </button>
        </form>
      );
    },
  },
];

export function AdminUsersTable({ users }: { users: AdminUserRow[] }) {
  return <DataTable columns={columns} data={users} emptyMessage="Keine Benutzer gefunden." />;
}