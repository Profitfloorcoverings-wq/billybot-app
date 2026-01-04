import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Routes that require login
const PROTECTED_ROUTES = [
  "/chat",
  "/quotes",
  "/customers",
  "/pricing",
  "/requests",
  "/account",
];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Initialize Supabase server client using request cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // Get session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = req.nextUrl.pathname;
  const publicRoutes = ["/terms", "/privacy"];

  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return res;
  }

  if (session && pathname.startsWith("/auth")) {
    const redirectUrl = new URL("/chat", req.url);
    return NextResponse.redirect(redirectUrl, { headers: res.headers });
  }

  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  // --- ONBOARDING LOGIC ---
  let isOnboarded = true;
  let termsAccepted = true;

  if (session?.user) {
    const { data: clientProfile } = await supabase
      .from("clients")
      .select("is_onboarded, terms_accepted")
      .eq("id", session.user.id)
      .maybeSingle();

    isOnboarded = clientProfile?.is_onboarded ?? false;
    termsAccepted = clientProfile?.terms_accepted ?? false;
  }

  const onboardingExemptRoutes = [
    "/account/setup",
    "/account/accept-terms",
    "/auth/login",
    "/auth/signup",
  ];

  const isOnboardingRoute = onboardingExemptRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // If no session AND route is protected → redirect to login
  if (isProtected && !session) {
    const redirectUrl = new URL("/auth/login", req.url);
    return NextResponse.redirect(redirectUrl, { headers: res.headers });
  }

  // User logged in but NOT onboarded → force into setup flow
  if (session && !isOnboarded && !isOnboardingRoute) {
    const redirectUrl = new URL("/account/setup", req.url);
    return NextResponse.redirect(redirectUrl, { headers: res.headers });
  }

  if (session && isOnboarded && !termsAccepted && !isOnboardingRoute) {
    const redirectUrl = new URL("/account/accept-terms", req.url);
    return NextResponse.redirect(redirectUrl, { headers: res.headers });
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
