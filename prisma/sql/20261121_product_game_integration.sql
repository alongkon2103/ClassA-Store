-- Additive product connection metadata; canonical Actions, entitlements and sales stay separate.
BEGIN;
CREATE TABLE IF NOT EXISTS public.product_tikkies_integrations (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  config jsonb NOT NULL,
  revision varchar(64) NOT NULL,
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT product_tikkies_integrations_config_object CHECK (jsonb_typeof(config) = 'object'),
  CONSTRAINT product_tikkies_integrations_revision_format CHECK (revision ~ '^[0-9a-f]{64}$'),
  CONSTRAINT product_tikkies_integrations_config_bound CHECK (octet_length(config::text) <= 16384)
);
-- Seed only known legacy identity. No Actions/effects/customer mappings are rewritten.
INSERT INTO public.product_tikkies_integrations (product_id, config, revision)
SELECT id, '{"schemaVersion":1,"mode":"api","protocol":"roblox-interactive-v1","placeIds":["113965026399564"],"universeId":"10775380860"}'::jsonb,
  '3e2c561c56180fbd782013576c722d62cb87326c585fd4ff375468748a5a6c8b'
FROM public.products WHERE id = 'ce4eb329-7ae9-43d4-bf6a-cfde0fe3cee7'::uuid
ON CONFLICT (product_id) DO NOTHING;
COMMIT;
