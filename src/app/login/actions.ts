"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authEnabled, SESSION_COOKIE, SESSION_MAX_AGE, sessionToken } from "@/lib/auth";

export async function login(_prev: { error?: string }, fd: FormData): Promise<{ error?: string }> {
  if (!authEnabled()) redirect("/");
  const password = String(fd.get("password") ?? "");
  // Constant-time-ish comparison via the derived token.
  if ((await sessionToken(password)) !== (await sessionToken())) {
    await new Promise((r) => setTimeout(r, 600));
    return { error: "Wrong password" };
  }
  (await cookies()).set(SESSION_COOKIE, await sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
