import { createClient } from "@supabase/supabase-js";

import AcceptInviteForm from "./AcceptInviteForm";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type SearchParams = Promise<{ token?: string }>;

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="page-container flex min-h-screen items-center justify-center">
        <div className="card max-w-md w-full text-center p-8">
          <h1 className="section-title mb-4">Invalid invite</h1>
          <p className="text-[var(--muted)] text-sm">
            This invite link is missing or invalid. Please ask your business owner to resend the
            invite.
          </p>
        </div>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient(supabaseUrl, supabaseServiceKey) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invite } = await supabase
    .from("team_invites")
    .select("id, invite_email, name, role, expires_at, used_at")
    .eq("invite_token", token)
    .maybeSingle();

  if (!invite) {
    return (
      <div className="page-container flex min-h-screen items-center justify-center">
        <div className="card max-w-md w-full text-center p-8">
          <h1 className="section-title mb-4">Invite not found</h1>
          <p className="text-[var(--muted)] text-sm">
            This invite link is invalid. Please ask your business owner to send a new invite.
          </p>
        </div>
      </div>
    );
  }

  if (invite.used_at) {
    return (
      <div className="page-container flex min-h-screen items-center justify-center">
        <div className="card max-w-md w-full text-center p-8">
          <h1 className="section-title mb-4">Invite already used</h1>
          <p className="text-[var(--muted)] text-sm">
            This invite has already been accepted. Try logging in at{" "}
            <a href="/auth/login" className="text-[var(--brand1)]">
              app.billybot.ai
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  if (new Date(invite.expires_at) < new Date()) {
    return (
      <div className="page-container flex min-h-screen items-center justify-center">
        <div className="card max-w-md w-full text-center p-8">
          <h1 className="section-title mb-4">Invite expired</h1>
          <p className="text-[var(--muted)] text-sm">
            This invite expired on {new Date(invite.expires_at).toLocaleDateString()}. Please ask
            your business owner to send a new invite.
          </p>
        </div>
      </div>
    );
  }

  const roleLabelMap: Record<string, string> = {
    manager: "Manager",
    fitter: "Fitter",
    estimator: "Estimator",
  };

  return (
    <div className="page-container flex min-h-screen items-center justify-center">
      <div className="card max-w-md w-full p-8">
        <h1 className="section-title mb-2">You&apos;re invited!</h1>
        <p className="text-[var(--muted)] text-sm mb-6">
          You&apos;ve been invited to join BillyBot as a{" "}
          <strong className="text-[var(--text)]">
            {roleLabelMap[invite.role] ?? invite.role}
          </strong>
          . Set your password below to get started.
        </p>
        <AcceptInviteForm
          inviteToken={token}
          email={invite.invite_email}
          name={invite.name}
        />
      </div>
    </div>
  );
}
