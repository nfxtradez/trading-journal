import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidSession, SESSION_COOKIE } from "./auth";
import { loadDb } from "./db";

/**
 * Entry guard for every page, server action and route handler:
 * verifies the session (when a password is configured) and loads the database.
 */
export async function ready(): Promise<void> {
  const jar = await cookies();
  if (!(await isValidSession(jar.get(SESSION_COOKIE)?.value))) redirect("/login");
  await loadDb();
}
