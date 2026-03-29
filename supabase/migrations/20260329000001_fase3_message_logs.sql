-- Fase 3: Envío de solicitudes de reseña
-- Agrega review_link a organizations y crea message_logs

-- Link de reseña configurable por organización (Google, TripAdvisor, etc.)
ALTER TABLE public.organizations ADD COLUMN review_link TEXT;

-- ============================================================
-- message_logs
-- Registro de cada solicitud de reseña enviada.
-- ============================================================
CREATE TABLE public.message_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_name  TEXT NOT NULL,
  phone          TEXT NOT NULL,  -- número completo con prefijo internacional (ej: 5491155441234)
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('sent', 'failed', 'pending')),
  error          TEXT,           -- detalle del error si status = 'failed'
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para listar historial por org ordenado por fecha
CREATE INDEX message_logs_org_id_created_at_idx ON public.message_logs(org_id, created_at DESC);

-- RLS
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "logs: owner can select"
  ON public.message_logs FOR SELECT
  USING (
    org_id IN (
      SELECT id FROM public.organizations WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "logs: owner can insert"
  ON public.message_logs FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT id FROM public.organizations WHERE owner_id = auth.uid()
    )
  );
