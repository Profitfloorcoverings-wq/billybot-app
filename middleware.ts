import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_ROUTES = [
  "/app/chat",
  "/app/quotes",
  "/app/customers",
  "/app/pricing",
  "/app/requests",
  "/account",
];
const ONBOARDING_ROUTES = ["/account/setup", "/account/accept-terms", "/post-onboard"];
const AUTH_ROUTES = ["/auth/login", "/auth/signup"];
const PUBLIC_ROUTES = ["/terms", "/privacy"];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  // Ensure onboarding guards are evaluated with fresh data on every request.
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.headers.set("Pragma", "no-cache");

  // Initialize Supabase server client using request cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch(input, init) {
          return fetch(input, { ...init, cache: "no-store" });
        },
      },
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set({ name, value, ...options });
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = req.nextUrl.pathname;

  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return res;
  }

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isOnboardingRoute = ONBOARDING_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  const isSetupRoute = pathname.startsWith("/account/setup");
  const isAcceptTermsRoute = pathname.startsWith("/account/accept-terms");
  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  if (!user) {
    if (isAuthRoute) {
      return res;
    }

    if (isProtected || isOnboardingRoute) {
      const redirectUrl = new URL("/auth/login", req.url);
      const redirectResponse = NextResponse.redirect(redirectUrl, { headers: res.headers });
      res.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
      return redirectResponse;
    }

    return res;
  }

  const { data: clientProfile } = await supabase
    .from("clients")
    .select(
      "business_name, contact_name, phone, address_line1, city, postcode, country, is_onboarded, terms_accepted"
    )
    .eq("id", user.id)
    .maybeSingle();

  const businessComplete =
    clientProfile?.is_onboarded === true ||
    Boolean(
      clientProfile?.business_name &&
        clientProfile?.contact_name &&
        clientProfile?.phone &&
        clientProfile?.address_line1 &&
        clientProfile?.city &&
        clientProfile?.postcode &&
        clientProfile?.country
    );
  const hasAcceptedTerms = clientProfile?.terms_accepted === true;
  const isFullyOnboarded = businessComplete && hasAcceptedTerms;

  if (isFullyOnboarded) {
    if (isAuthRoute || isOnboardingRoute) {
      const redirectUrl = new URL("/app/chat", req.url);
      const redirectResponse = NextResponse.redirect(redirectUrl, { headers: res.headers });
      res.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
      return redirectResponse;
    }

    return res;
  }

  if (!businessComplete) {
    if (isSetupRoute) {
      return res;
    }
    const redirectUrl = new URL("/account/setup", req.url);
    const redirectResponse = NextResponse.redirect(redirectUrl, { headers: res.headers });
    res.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  if (!hasAcceptedTerms) {
    if (isAcceptTermsRoute) {
      return res;
    }
    const redirectUrl = new URL("/account/accept-terms", req.url);
    const redirectResponse = NextResponse.redirect(redirectUrl, { headers: res.headers });
    res.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  return res;
}

export const config = {
  matcher: ["/app/:path*", "/account/:path*", "/auth/:path*"],
};
