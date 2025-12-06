import { NextRequest, NextResponse } from "next/server";

/**
 * Lightweight middleware hook. For now this does NOT talk to Supabase;
 * it just forwards the request so we avoid importing @supabase/ssr.
 * We can reintroduce full SSR auth later if needed.
 */
export async function updateSession(req: NextRequest) {
  return NextResponse.next({
    request: {
      headers: req.headers,
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|auth).*)"],
};
