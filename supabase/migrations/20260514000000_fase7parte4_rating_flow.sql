ALTER TABLE message_logs
  ADD COLUMN IF NOT EXISTS flow_step TEXT,
  ADD COLUMN IF NOT EXISTS satisfaction_score INT;

CREATE INDEX IF NOT EXISTS idx_message_logs_flow_lookup
  ON message_logs (org_id, phone, created_at DESC)
  WHERE flow_step IS NOT NULL;

COMMENT ON COLUMN message_logs.flow_step IS
  'Estado del flujo conversacional: rating_asked | link_sent | feedback_received | completed';
COMMENT ON COLUMN message_logs.satisfaction_score IS
  'Calificación 1-5 del usuario en el flujo conversacional. Null si no aplica.';
