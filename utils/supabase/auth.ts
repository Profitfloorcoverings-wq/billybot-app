import { cookies } from "next/headers";
import { createClient, type User } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getServerClient() {
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

export async function getUserFromCookies(): Promise<User | null> {
  const cookieStore = cookies();
  const accessToken = cookieStore.get("sb-access-token")?.value;

  if (!accessToken) return null;

  const supabase = getServerClient();
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data?.user) return null;
  return data.user;
}
