-- Tier 0 — vocabulário PNCP (facets) na ingest

ALTER TABLE item
  ADD COLUMN IF NOT EXISTS parsed_facets jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE item
  ADD COLUMN IF NOT EXISTS catalog_match_method text;

CREATE INDEX IF NOT EXISTS item_parsed_facets_tipo_idx
  ON item ((parsed_facets->>'tipo'))
  WHERE parsed_facets->>'tipo' IS NOT NULL;

CREATE INDEX IF NOT EXISTS item_parsed_facets_base_class_idx
  ON item ((parsed_facets->>'base_class'))
  WHERE parsed_facets->>'base_class' IS NOT NULL;
