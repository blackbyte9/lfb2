type AdminUserSummaryCellProps = {
  name: string;
  email: string;
  username: string | null;
  createdAt: string;
};

export function AdminUserSummaryCell({ name, email, username, createdAt }: AdminUserSummaryCellProps) {
  return (
    <div>
      <p className="font-medium text-[#131820]">{name}</p>
      <p className="text-[#364152]">{email}</p>
      <p className="text-xs text-[#4b5563]">
        @{username ?? "kein-benutzername"} | {new Date(createdAt).toLocaleDateString("de-DE")}
      </p>
    </div>
  );
}