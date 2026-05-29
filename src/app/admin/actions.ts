"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const USER_TYPES = ["GUEST", "USER", "ADMIN"] as const;

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  return session;
}

export async function updateUserRoleAction(formData: FormData) {
  await requireAdmin();

  const userId = readText(formData, "userId");
  const role = readText(formData, "role");

  if (!userId || !USER_TYPES.includes(role as (typeof USER_TYPES)[number])) {
    redirect("/admin?error=invalid-role");
  }

  const nextRole = role as (typeof USER_TYPES)[number];

  await auth.api.setRole({
    body: {
      userId,
      role: nextRole,
    },
    headers: await headers(),
  });

  revalidatePath("/admin");
}

export async function updateUserPasswordAction(formData: FormData) {
  await requireAdmin();

  const userId = readText(formData, "userId");
  const newPassword = readText(formData, "newPassword");

  if (!userId || newPassword.length < 8) {
    redirect("/admin?error=invalid-password");
  }

  await auth.api.setUserPassword({
    body: {
      userId,
      newPassword,
    },
    headers: await headers(),
  });

  revalidatePath("/admin");
}

export async function deleteUserAction(formData: FormData) {
  const session = await requireAdmin();

  const userId = readText(formData, "userId");

  if (!userId) {
    redirect("/admin?error=invalid-user-delete");
  }

  if (userId === session.user.id) {
    redirect("/admin?error=cannot-delete-self");
  }

  try {
    await prisma.user.delete({
      where: { id: userId },
    });
  } catch {
    redirect("/admin?error=invalid-user-delete");
  }

  revalidatePath("/admin");
}