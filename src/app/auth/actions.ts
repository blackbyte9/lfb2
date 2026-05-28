"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function registerAction(formData: FormData) {
  const name = readText(formData, "name");
  const email = readText(formData, "email");
  const username = readText(formData, "username");
  const password = readText(formData, "password");

  if (!name || !email || !username || !password) {
    redirect("/register?error=missing-fields");
  }

  try {
    await auth.api.signUpEmail({
      body: {
        name,
        email,
        password,
        username,
        displayUsername: username,
      },
      headers: await headers(),
    });
  } catch {
    redirect("/register?error=signup-failed");
  }

  redirect("/");
}

export async function loginAction(formData: FormData) {
  const username = readText(formData, "username");
  const password = readText(formData, "password");

  if (!username || !password) {
    redirect("/login?error=missing-fields");
  }

  try {
    await auth.api.signInUsername({
      body: {
        username,
        password,
      },
      headers: await headers(),
    });
  } catch {
    redirect("/login?error=invalid-credentials");
  }

  redirect("/");
}

export async function logoutAction() {
  await auth.api.signOut({
    headers: await headers(),
  });

  redirect("/");
}