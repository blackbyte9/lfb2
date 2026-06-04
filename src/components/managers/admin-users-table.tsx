"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { AdminPasswordResetForm } from "@/components/generic/admin-password-reset-form";
import { AdminUserSummaryCell } from "@/components/rows/admin-user-summary-cell";
import { deleteUserAction } from "@/app/admin/actions";
import { RoleSelect } from "@/components/generic/role-select";
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
      return <AdminUserSummaryCell name={user.name} email={user.email} username={user.username} createdAt={user.createdAt} />;
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
      return <AdminPasswordResetForm userId={user.id} />;
    },
  },
  {
    id: "delete",
    header: "Löschen",
    cell: ({ row }) => {
      const user = row.original;
      return (
        <form
          action={deleteUserAction}
          onSubmit={(event) => {
            const confirmed = window.confirm(`Benutzer ${user.name} wirklich löschen?`);
            if (!confirmed) {
              event.preventDefault();
            }
          }}
        >
          <input name="userId" type="hidden" value={user.id} />
          <button type="submit" className="rounded-md border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">
            Löschen
          </button>
        </form>
      );
    },
  },
];

export function AdminUsersTable({ users }: { users: AdminUserRow[] }) {
  return <DataTable columns={columns} data={users} emptyMessage="Keine Benutzer gefunden." />;
}