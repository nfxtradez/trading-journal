import { NextResponse, type NextRequest } from "next/server";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";

// Redirect signed-out visitors to /login. (Pages and actions re-check via ready().)
export async function proxy(req: NextRequest) {
  if (await isValidSession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (req.method !== "GET") return new NextResponse("Unauthorized", { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the login page and the assets needed to install the app / render the login page.
  matcher: [
    "/((?!login|api/webhooks|_next/static|_next/image|manifest.webmanifest|sw.js|offline.html|icon|apple-icon|favicon).*)",
  ],
};
