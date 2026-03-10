-- AI Audit Log: tracks all AI-initiated writes (inserts/updates) for traceability
CREATE TABLE ai_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES clients(id),
  conversation_id uuid REFERENCES conversations(id),
  table_name text NOT NULL,
  operation text NOT NULL,  -- 'insert' or 'update'
  row_id uuid,
  payload jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own audit logs"
  ON ai_audit_log
  FOR SELECT
  USING (profile_id = auth.uid());

-- Index for querying by profile
CREATE INDEX idx_ai_audit_log_profile ON ai_audit_log(profile_id);
CREATE INDEX idx_ai_audit_log_conversation ON ai_audit_log(conversation_id);
