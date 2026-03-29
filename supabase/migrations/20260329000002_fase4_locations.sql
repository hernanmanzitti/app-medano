-- Fase 4: Settings — sucursales por organización

CREATE TABLE public.locations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  review_link  TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX locations_org_id_idx ON public.locations(org_id);

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locations: owner can select"
  ON public.locations FOR SELECT
  USING (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()));

CREATE POLICY "locations: owner can insert"
  ON public.locations FOR INSERT
  WITH CHECK (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()));

CREATE POLICY "locations: owner can update"
  ON public.locations FOR UPDATE
  USING (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()));

CREATE POLICY "locations: owner can delete"
  ON public.locations FOR DELETE
  USING (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()));
