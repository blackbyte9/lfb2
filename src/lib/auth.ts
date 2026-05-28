import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins/admin";
import { adminAc, userAc } from "better-auth/plugins/admin/access";
import { username } from "better-auth/plugins/username";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  appName: "LFB2",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
    }),
    admin({
      defaultRole: "GUEST",
      adminRoles: ["ADMIN"],
      roles: {
        GUEST: userAc,
        USER: userAc,
        ADMIN: adminAc,
      },
    }),
    nextCookies(),
  ],
});

export type AppSession = typeof auth.$Infer.Session;