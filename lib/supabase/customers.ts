import { createClient } from "@/utils/supabase/client";

export async function fetchCustomers(profileId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("profile_id", profileId)
    .order("customer_name", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}
