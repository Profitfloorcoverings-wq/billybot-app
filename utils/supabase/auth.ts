import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

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
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set({ name, value, ...options });
        });
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const serviceClient = getServerClient(true);

  let businessName: string | null = null;
  let email = user.email ?? null;

  const { data: client } = await serviceClient
    .from("clients")
    .select("business_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (client) {
    businessName = client.business_name ?? null;
    email = client.email ?? email;
  }

  return {
    id: user.id,
    email,
    business_name: businessName,
  };
}

export async function getAuthenticatedUserId(): Promise<string | null> {
  const user = await getUserFromCookies();
  return user?.id ?? null;
}

/**
 * Accepts either:
 *   - Authorization: Bearer <supabase-jwt>  (mobile app)
 *   - Supabase SSR cookies                  (web app)
 */
export async function getUserFromRequest(request: Request): Promise<{ id: string } | null> {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (!supabaseUrl || !supabaseServiceKey) return null;
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user } } = await admin.auth.getUser(token);
    if (user?.id) return { id: user.id };
  }
  const user = await getUserFromCookies();
  return user ? { id: user.id } : null;
}
