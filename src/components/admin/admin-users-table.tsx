"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { AdminPasswordResetForm } from "@/components/admin/admin-password-reset-form";
import { AdminUserSummaryCell } from "@/components/admin/admin-user-summary-cell";
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
];

export function AdminUsersTable({ users }: { users: AdminUserRow[] }) {
  return <DataTable columns={columns} data={users} emptyMessage="Keine Benutzer gefunden." />;
}