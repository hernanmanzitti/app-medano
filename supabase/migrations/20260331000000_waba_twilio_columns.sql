-- Agregar columnas de Twilio a waba_connections si no existen
ALTER TABLE waba_connections
  ADD COLUMN IF NOT EXISTS twilio_subaccount_sid TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT;
