import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const PUBLIC_ROUTES = ["/auth/login", "/auth/signup", "/auth/logout"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next();
  }

  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  const accessToken = req.cookies.get("sb-access-token")?.value;
  const redirectToLogin = NextResponse.redirect(new URL("/auth/login", req.url));

  if (!accessToken) {
    return isPublicRoute ? NextResponse.next() : redirectToLogin;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return isPublicRoute ? NextResponse.next() : redirectToLogin;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase.auth.getUser(accessToken);
  const user = error ? null : data?.user;

  if (!user) {
    return isPublicRoute ? NextResponse.next() : redirectToLogin;
  }

  if (isPublicRoute) {
    return NextResponse.redirect(new URL("/chat", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/(.*)", "/"],
};
