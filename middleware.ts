import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const PUBLIC_ROUTES = ["/auth/login", "/auth/signup", "/auth/logout"];

function createMiddlewareSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const supabase = createMiddlewareSupabaseClient();
  const accessToken = req.cookies.get("sb-access-token")?.value;
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  const redirectToLogin = NextResponse.redirect(new URL("/auth/login", req.url));

  if (!accessToken) {
    return isPublicRoute ? NextResponse.next() : redirectToLogin;
  }

  const { data, error } = await supabase.auth.getUser(accessToken);
  const user = error ? null : data?.user;

  if (!user) {
    return isPublicRoute ? NextResponse.next() : redirectToLogin;
  }

  if (pathname.startsWith("/auth")) {
    if (pathname.startsWith("/auth/logout")) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/chat", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/(.*)", "/"],
};
