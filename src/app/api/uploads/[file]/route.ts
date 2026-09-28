import path from "node:path";
import { cookies } from "next/headers";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { IMAGE_TYPES, readUpload } from "@/lib/uploads";

export async function GET(_req: Request, ctx: RouteContext<"/api/uploads/[file]">) {
  if (!(await isValidSession((await cookies()).get(SESSION_COOKIE)?.value))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { file } = await ctx.params;
  const data = await readUpload(file);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(data, {
    headers: {
      "Content-Type": IMAGE_TYPES[path.extname(file).toLowerCase()],
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
