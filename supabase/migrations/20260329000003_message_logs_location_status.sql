-- Agrega location_id a message_logs y amplía los statuses posibles
-- para soportar el ciclo de vida completo del mensaje WhatsApp.

ALTER TABLE public.message_logs
  ADD COLUMN location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

-- Reemplaza el CHECK constraint original (solo tenía sent/failed/pending)
ALTER TABLE public.message_logs
  DROP CONSTRAINT IF EXISTS message_logs_status_check;

ALTER TABLE public.message_logs
  ADD CONSTRAINT message_logs_status_check
  CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed'));
