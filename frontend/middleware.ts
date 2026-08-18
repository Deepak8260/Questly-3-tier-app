import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// NOTE: These are intentionally NOT prefixed with NEXT_PUBLIC_.
// Middleware runs server-side (in the Node/Edge runtime) on every
// request, so process.env is read live at runtime here — there is no
// build-time inlining to worry about, unlike NEXT_PUBLIC_ vars used in
// client components. Using the plain names keeps this value out of the
// client bundle entirely and lets it be changed with a plain
// `docker run -e` / compose env change, no rebuild required.
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protect dashboard routes — redirect to login if not authenticated
  if (pathname.startsWith("/dashboard") && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Redirect logged-in users away from auth pages
  if ((pathname === "/login" || pathname === "/signup") && user) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
