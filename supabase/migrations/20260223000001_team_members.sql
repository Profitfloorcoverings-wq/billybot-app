-- Add user_role and parent_client_id to clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS user_role TEXT NOT NULL DEFAULT 'owner'
    CHECK (user_role IN ('owner', 'manager', 'fitter', 'estimator')),
  ADD COLUMN IF NOT EXISTS parent_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- team_members: accepted memberships (owner ↔ member)
CREATE TABLE IF NOT EXISTS public.team_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('manager', 'fitter', 'estimator')),
  invite_email    TEXT NOT NULL,
  invite_status   TEXT NOT NULL DEFAULT 'pending'
                    CHECK (invite_status IN ('pending', 'accepted', 'revoked')),
  invited_by      UUID NOT NULL REFERENCES public.clients(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at     TIMESTAMPTZ,
  UNIQUE (business_id, member_id)
);

-- team_invites: pending invitations (before account creation)
CREATE TABLE IF NOT EXISTS public.team_invites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  invite_email    TEXT NOT NULL,
  name            TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('manager', 'fitter', 'estimator')),
  invite_token    TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by      UUID NOT NULL REFERENCES public.clients(id),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_members_business_id ON public.team_members(business_id);
CREATE INDEX IF NOT EXISTS idx_team_members_member_id   ON public.team_members(member_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_token       ON public.team_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_team_invites_email       ON public.team_invites(invite_email);

-- RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invites  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_members_select" ON public.team_members FOR SELECT
  USING (business_id = auth.uid() OR member_id = auth.uid());

CREATE POLICY "team_members_insert" ON public.team_members FOR INSERT
  WITH CHECK (business_id = auth.uid());

CREATE POLICY "team_members_update" ON public.team_members FOR UPDATE
  USING (business_id = auth.uid());

CREATE POLICY "team_members_delete" ON public.team_members FOR DELETE
  USING (business_id = auth.uid());

CREATE POLICY "team_invites_select" ON public.team_invites FOR SELECT
  USING (business_id = auth.uid());

CREATE POLICY "team_invites_insert" ON public.team_invites FOR INSERT
  WITH CHECK (business_id = auth.uid());
