import type { Database } from "./supabase";

type TeamMemberRow = Database["public"]["Tables"]["team_members"]["Row"];
type TeamInviteRow = Database["public"]["Tables"]["team_invites"]["Row"];

export type UserRole = "owner" | "manager" | "fitter" | "estimator";
export type InviteStatus = "pending" | "accepted" | "revoked";

export type TeamMember = TeamMemberRow & {
  email?: string | null;
};

export type TeamInvite = TeamInviteRow;
