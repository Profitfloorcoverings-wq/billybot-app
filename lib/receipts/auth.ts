import type { SupabaseClient } from "@supabase/supabase-js";

export type ReceiptUserInfo = {
  userId: string;
  businessId: string;
  role: string;
};

/**
 * Resolve the business owner ID and role for a given user.
 * If the user is a team member (fitter/estimator/manager), returns their parent business ID.
 * Same pattern as diary's resolveBusinessId but also returns the role.
 */
export async function resolveReceiptUser(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<ReceiptUserInfo> {
  const { data } = await supabaseAdmin
    .from("clients")
    .select("user_role, parent_client_id")
    .eq("id", userId)
    .maybeSingle();

  const role = data?.user_role ?? "owner";
  const businessId =
    role !== "owner" && data?.parent_client_id
      ? data.parent_client_id
      : userId;

  return { userId, businessId, role };
}

/**
 * Only owners and managers can approve receipts or sync to accounting.
 */
export function canApproveOrSync(role: string): boolean {
  return role === "owner" || role === "manager";
}
