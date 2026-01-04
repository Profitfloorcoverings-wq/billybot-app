"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type LoginState = {
  error: string | null;
};

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    return { error: error?.message ?? "Unable to log in" };
  }

  const session = data.session;
  const maxAge = session.expires_at
    ? Math.max(session.expires_at - Math.floor(Date.now() / 1000), 3600)
    : 3600 * 24 * 7;

  const cookieStore = cookies();

  cookieStore.set("sb-access-token", session.access_token, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge,
  });

  if (session.refresh_token) {
    cookieStore.set("sb-refresh-token", session.refresh_token, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge,
    });
  }

  redirect("/chat");
}
