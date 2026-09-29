import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_AUTH_SKIP_ROUTES, processAuthMiddleware } from "@neondatabase/auth/server";

// Every page under here calls auth.getSession() (directly, or through
// src/lib/db.ts's getAuthedContext()) to read the session and, when the app's own
// session-data cache cookie has expired, to refresh it. That refresh writes a cookie,
// and Next.js only allows a cookie write from a Server Action, a Route Handler, or here
// in the proxy — never from a Server Component's render, which is where every one of
// those calls otherwise happens. Without this proxy running first, a request that needs
// a refresh crashes with "Cookies can only be modified in a Server Action or Route
// Handler" the moment the page calls getSession(). Running the same session lookup here
// performs that refresh through NextResponse's headers (always allowed) so the page's
// own call finds an already-fresh session and never needs to write anything itself.
//
// auth.middleware() (the SDK's ready-made helper) would do this too, but it redirects
// every route outside its fixed skip list to loginUrl — including "/" (breaks the public
// landing page a signed-out visitor is meant to see, src/app/page.tsx) and "/admin"
// (would leak that the page exists to a non-admin instead of the 404 requireAdminPage()
// gives today, src/lib/admin.ts). Both pages already handle "no session"/"no admin role"
// themselves, so they're added to the skip list here instead: still refreshed, never
// redirected. The session lookup itself runs whenever the request carries a session
// cookie, regardless of skip status, so a signed-in visitor on "/" or "/admin" still gets
// refreshed here.
const NEVER_REDIRECT_ROUTES = [...DEFAULT_AUTH_SKIP_ROUTES, "/", "/admin"];

export default async function proxy(request: NextRequest) {
  const result = await processAuthMiddleware({
    request,
    pathname: request.nextUrl.pathname,
    skipRoutes: NEVER_REDIRECT_ROUTES,
    loginUrl: "/auth/sign-in",
    baseUrl: process.env.NEON_AUTH_BASE_URL!,
    cookieSecret: process.env.NEON_AUTH_COOKIE_SECRET!,
  });

  switch (result.action) {
    case "allow": {
      const headers = new Headers(request.headers);
      if (result.headers) {
        for (const [key, value] of Object.entries(result.headers)) headers.set(key, value);
      }
      const response = NextResponse.next({ request: { headers } });
      if (result.cookies) {
        for (const cookie of result.cookies) response.headers.append("Set-Cookie", cookie);
      }
      return response;
    }
    case "redirect_oauth": {
      const oauthHeaders = new Headers();
      for (const cookie of result.cookies) oauthHeaders.append("Set-Cookie", cookie);
      return NextResponse.redirect(result.redirectUrl, { headers: oauthHeaders });
    }
    case "redirect_login":
      if (result.cookies && result.cookies.length > 0) {
        const loginHeaders = new Headers();
        for (const cookie of result.cookies) loginHeaders.append("Set-Cookie", cookie);
        return NextResponse.redirect(result.redirectUrl, { headers: loginHeaders });
      }
      return NextResponse.redirect(result.redirectUrl);
  }
}

// Every route calls into Neon Auth except the auth pages themselves, the legal pages
// (never touch the session) and the auth API proxy — those stay untouched so the
// sign-in/sign-up flow and static assets never depend on this proxy running first.
export const config = {
  matcher: ["/((?!auth|legal|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
