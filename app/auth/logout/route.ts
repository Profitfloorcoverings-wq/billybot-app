import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(req: Request) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  await supabase.auth.signOut();

  const response = NextResponse.redirect(new URL("/auth/login", req.url));
  const cookieStore = cookies();

  ["sb-access-token", "sb-refresh-token"].forEach((name) => {
    const existing = cookieStore.get(name);
    if (existing) {
      response.cookies.set(name, "", {
        value: "",
        maxAge: 0,
        path: "/",
      });
    }
  });

  return response;
}
