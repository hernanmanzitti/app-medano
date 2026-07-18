-- Multi-tenant: cada subaccount de Twilio tiene su propio auth token
-- (necesario para validar la firma de webhooks) y su propio template SID
-- (cada cliente aprueba su template en su propio subaccount).
ALTER TABLE waba_connections
  ADD COLUMN IF NOT EXISTS auth_token TEXT,
  ADD COLUMN IF NOT EXISTS template_sid TEXT;

-- Backfill de COBA (ejecutar a mano en SQL Editor de Supabase, no vía CLI):
-- UPDATE waba_connections
--   SET auth_token = '<valor actual de TWILIO_SUBACCOUNT_AUTH_TOKEN en Netlify>',
--       template_sid = '<valor actual de TWILIO_TEMPLATE_SID en Netlify>'
--   WHERE phone_number = '+13659063072';
