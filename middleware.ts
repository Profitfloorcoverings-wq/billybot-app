import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const ONBOARDING_ROUTES = [
  "/account/setup",
  "/account/accept-terms",
  "/post-onboard",
];
const AUTH_ROUTES = ["/auth/login", "/auth/signup"];
const PUBLIC_ROUTES = ["/terms", "/privacy"];

function redirectWithCookies(req: NextRequest, res: NextResponse, pathname: string) {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  const redirectResponse = NextResponse.redirect(url, { headers: res.headers });
  res.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
  return redirectResponse;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const internalToken = req.headers.get("x-internal-token");
  const isInternalApiCall =
    pathname.startsWith("/api/") &&
    internalToken !== null &&
    internalToken === process.env.INTERNAL_JOBS_TOKEN;
  if (isInternalApiCall) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  // Ensure onboarding guards are evaluated with fresh data on every request.
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("x-url", req.nextUrl.href);
  res.headers.set("x-pathname", req.nextUrl.pathname);

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

  const isPublicRoute =
    PUBLIC_ROUTES.some((route) => pathname.startsWith(route)) ||
    AUTH_ROUTES.some((route) => pathname.startsWith(route)) ||
    ONBOARDING_ROUTES.some((route) => pathname.startsWith(route));

  if (!user) {
    if (isPublicRoute) {
      return res;
    }

    return redirectWithCookies(req, res, "/auth/login");
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
    if (AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
      return redirectWithCookies(req, res, "/chat");
    }

    return res;
  }

  if (!businessComplete) {
    if (isPublicRoute) {
      return res;
    }
    return redirectWithCookies(req, res, "/account/setup");
  }

  if (!hasAcceptedTerms) {
    if (isPublicRoute) {
      return res;
    }
    return redirectWithCookies(req, res, "/account/accept-terms");
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
