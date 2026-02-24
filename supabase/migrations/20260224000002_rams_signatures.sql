-- RAMS signatures table: tracks which fitters need to sign each document
CREATE TABLE IF NOT EXISTS public.rams_signatures (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  document_type  TEXT NOT NULL CHECK (document_type IN ('risk_assessment', 'method_statement')),
  document_url   TEXT,
  signer_id      UUID NOT NULL REFERENCES public.clients(id),
  signer_name    TEXT NOT NULL,
  signature_data TEXT,        -- base64 PNG data URI, null until signed
  signed_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, document_type, signer_id)
);

CREATE INDEX IF NOT EXISTS idx_rams_signatures_job_id    ON public.rams_signatures(job_id);
CREATE INDEX IF NOT EXISTS idx_rams_signatures_signer_id ON public.rams_signatures(signer_id);

ALTER TABLE public.rams_signatures ENABLE ROW LEVEL SECURITY;

-- Fitters see their own rows
CREATE POLICY "rams_sigs_select_signer" ON public.rams_signatures
  FOR SELECT USING (signer_id = auth.uid());

-- Business owners see all rows for their jobs
CREATE POLICY "rams_sigs_select_owner" ON public.rams_signatures
  FOR SELECT USING (
    job_id IN (SELECT id FROM public.jobs WHERE client_id = auth.uid())
  );

-- Fitters can sign their own row (update signature_data + signed_at)
CREATE POLICY "rams_sigs_update" ON public.rams_signatures
  FOR UPDATE USING (signer_id = auth.uid());

-- Owners can insert pending rows (N8N uses service role so also bypasses RLS)
CREATE POLICY "rams_sigs_insert" ON public.rams_signatures
  FOR INSERT WITH CHECK (
    job_id IN (SELECT id FROM public.jobs WHERE client_id = auth.uid())
  );
