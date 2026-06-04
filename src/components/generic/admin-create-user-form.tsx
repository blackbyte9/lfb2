"use client";

import { useActionState, useState, useRef, useEffect } from "react";
import { createUserAction } from "@/app/admin/actions";

export function AdminCreateUserForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createUserAction, null);

  // Track how many times we've submitted so we can detect a null return after a real submission
  const submitCountRef = useRef(0);
  const lastSeenCountRef = useRef(0);

  useEffect(() => {
    if (submitCountRef.current > lastSeenCountRef.current && state === null && !isPending) {
      lastSeenCountRef.current = submitCountRef.current;
      setOpen(false);
    }
  }, [state, isPending]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-[#006b2d] px-3 py-1.5 text-sm font-semibold text-[#006b2d] hover:bg-[#006b2d]/5"
      >
        + Benutzer anlegen
      </button>
    );
  }

  return (
    <form
      action={(formData) => {
        submitCountRef.current += 1;
        formAction(formData);
      }}
      className="rounded-lg border border-black/10 bg-[#f9fafb] p-4"
    >
      <h2 className="mb-3 text-sm font-semibold text-[#131820]">Neuen Benutzer anlegen</h2>

      {state?.error ? (
        <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="create-name" className="text-xs font-medium text-[#364152]">
            Name <span className="text-red-600">*</span>
          </label>
          <input
            id="create-name"
            name="name"
            type="text"
            required
            className="rounded-md border border-black/20 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006b2d]/40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="create-email" className="text-xs font-medium text-[#364152]">
            E-Mail <span className="text-red-600">*</span>
          </label>
          <input
            id="create-email"
            name="email"
            type="email"
            required
            className="rounded-md border border-black/20 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006b2d]/40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="create-username" className="text-xs font-medium text-[#364152]">
            Benutzername
          </label>
          <input
            id="create-username"
            name="username"
            type="text"
            className="rounded-md border border-black/20 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006b2d]/40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="create-password" className="text-xs font-medium text-[#364152]">
            Passwort <span className="text-red-600">*</span>
          </label>
          <input
            id="create-password"
            name="password"
            type="password"
            required
            minLength={8}
            className="rounded-md border border-black/20 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006b2d]/40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="create-role" className="text-xs font-medium text-[#364152]">
            Rolle
          </label>
          <select
            id="create-role"
            name="role"
            defaultValue="GUEST"
            className="rounded-md border border-black/20 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006b2d]/40"
          >
            <option value="GUEST">GUEST</option>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-[#006b2d] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#005a25] disabled:opacity-60"
        >
          {isPending ? "Wird angelegt…" : "Anlegen"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-black/20 px-3 py-1.5 text-sm font-semibold text-[#364152] hover:bg-black/5"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
