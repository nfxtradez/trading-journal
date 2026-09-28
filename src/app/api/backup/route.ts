import { cookies } from "next/headers";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { db, loadDb } from "@/lib/db";

// Downloads the whole journal as a SQLite file (open it with any SQLite tool, or drop it into data/journal.db).
export async function GET() {
  if (!(await isValidSession((await cookies()).get(SESSION_COOKIE)?.value))) {
    return new Response("Unauthorized", { status: 401 });
  }
  await loadDb();
  const bytes = new Uint8Array(db().serialize());
  const date = new Date().toISOString().slice(0, 10);
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/vnd.sqlite3",
      "Content-Disposition": `attachment; filename="tradelog-${date}.db"`,
      "Cache-Control": "no-store",
    },
  });
}
