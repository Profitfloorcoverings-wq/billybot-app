import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

type AuthenticatedUser = {
  id: string;
  email: string | null;
  business_name: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getServerClient(useServiceRole = false) {
  if (!supabaseUrl) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabaseKey = useServiceRole ? supabaseServiceKey ?? supabaseAnonKey : supabaseAnonKey;

  if (!supabaseKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function getUserFromCookies(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("sb-access-token")?.value;

  if (!accessToken) return null;

  const supabase = getServerClient(true);
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data?.user) return null;

  let businessName: string | null = null;
  let email = data.user.email ?? null;

  const { data: client } = await supabase
    .from("clients")
    .select("business_name, email")
    .eq("id", data.user.id)
    .maybeSingle();

  if (client) {
    businessName = client.business_name ?? null;
    email = client.email ?? email;
  }

  return {
    id: data.user.id,
    email,
    business_name: businessName,
  };
}

export async function getAuthenticatedUserId(): Promise<string | null> {
  const user = await getUserFromCookies();
  return user?.id ?? null;
}
