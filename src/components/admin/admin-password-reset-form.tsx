import { updateUserPasswordAction } from "@/app/admin/actions";

type AdminPasswordResetFormProps = {
  userId: string;
};

export function AdminPasswordResetForm({ userId }: AdminPasswordResetFormProps) {
  return (
    <form action={updateUserPasswordAction} className="flex items-center gap-2">
      <input name="userId" type="hidden" value={userId} />
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
}