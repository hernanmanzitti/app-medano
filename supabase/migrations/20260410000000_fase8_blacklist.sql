CREATE TABLE blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  phone TEXT NOT NULL,
  origin TEXT DEFAULT 'manual' CHECK (origin IN ('manual', 'automatic')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, phone)
);

ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage their blacklist"
ON blacklist FOR ALL
USING (
  org_id IN (
    SELECT id FROM organizations WHERE owner_id = auth.uid()
  )
);
