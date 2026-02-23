export type UserRole = "owner" | "manager" | "fitter" | "estimator";
export type InviteStatus = "pending" | "accepted" | "revoked";

export type TeamMember = {
  id: string;
  business_id: string;
  member_id: string;
  role: Exclude<UserRole, "owner">;
  invite_email: string;
  invite_status: InviteStatus;
  invited_by: string;
  created_at: string;
  accepted_at: string | null;
  // Joined from clients
  name?: string | null;
  email?: string | null;
};

export type TeamInvite = {
  id: string;
  business_id: string;
  invite_email: string;
  name: string;
  role: Exclude<UserRole, "owner">;
  invite_token: string;
  invited_by: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};
