"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const USER_TYPES = ["GUEST", "USER", "ADMIN"] as const;

export async function createUserAction(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  await requireAdmin();

  const name = readText(formData, "name");
  const email = readText(formData, "email");
  const username = readText(formData, "username");
  const password = readText(formData, "password");
  const role = readText(formData, "role");

  if (!name) return { error: "Name ist erforderlich." };
  if (!email) return { error: "E-Mail ist erforderlich." };
  if (password.length < 8) return { error: "Das Passwort muss mindestens 8 Zeichen lang sein." };

  const nextRole = USER_TYPES.includes(role as (typeof USER_TYPES)[number])
    ? (role as (typeof USER_TYPES)[number])
    : "GUEST";

  try {
    await auth.api.createUser({
      body: {
        name,
        email,
        password,
        role: nextRole,
        data: username ? { username, displayUsername: username } : undefined,
      },
      headers: await headers(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Fehler beim Anlegen: ${message}` };
  }

  revalidatePath("/admin");
  return null;
}

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

export async function deleteAllAppDataAction() {
  await requireAdmin();

  await prisma.$transaction([
    prisma.lease.deleteMany(),
    prisma.item.deleteMany(),
    prisma.studentGradeHistory.deleteMany(),
    prisma.student.deleteMany(),
    prisma.book.deleteMany(),
    prisma.test.deleteMany(),
  ]);

  revalidatePath("/books");
  revalidatePath("/students");
  revalidatePath("/lease");
  revalidatePath("/return");
  revalidatePath("/admin");
}