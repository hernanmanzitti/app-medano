-- Fase 2: Onboarding + WABA connect
-- Tablas: organizations, waba_connections

-- ============================================================
-- organizations
-- Una organización por cliente. El owner es el usuario que
-- se registró y completó el onboarding.
-- ============================================================
CREATE TABLE public.organizations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  owner_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para lookup rápido por owner
CREATE UNIQUE INDEX organizations_owner_id_idx ON public.organizations(owner_id);

-- RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- El owner puede leer y modificar su propia organización
CREATE POLICY "org: owner can select"
  ON public.organizations FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "org: owner can insert"
  ON public.organizations FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "org: owner can update"
  ON public.organizations FOR UPDATE
  USING (owner_id = auth.uid());


-- ============================================================
-- waba_connections
-- Credenciales de la WABA conectada via 360dialog.
-- Una sola conexión activa por organización.
-- ============================================================
CREATE TABLE public.waba_connections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel_id  TEXT NOT NULL,           -- ID del canal en 360dialog
  api_key     TEXT NOT NULL,           -- API key de 360dialog para este canal
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Una organización solo puede tener una conexión activa
CREATE UNIQUE INDEX waba_connections_org_id_idx ON public.waba_connections(org_id);

-- RLS
ALTER TABLE public.waba_connections ENABLE ROW LEVEL SECURITY;

-- Solo el owner de la org puede ver/crear/modificar su conexión WABA
CREATE POLICY "waba: owner can select"
  ON public.waba_connections FOR SELECT
  USING (
    org_id IN (
      SELECT id FROM public.organizations WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "waba: owner can insert"
  ON public.waba_connections FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT id FROM public.organizations WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "waba: owner can update"
  ON public.waba_connections FOR UPDATE
  USING (
    org_id IN (
      SELECT id FROM public.organizations WHERE owner_id = auth.uid()
    )
  );
