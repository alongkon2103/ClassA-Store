-- Additive Tikkies-only defaults. Never mutate Functions, customer mappings or sales.
BEGIN;
CREATE TABLE IF NOT EXISTS public.product_tikkies_defaults (
    product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
    config jsonb NOT NULL,
    revision varchar(64) NOT NULL,
    previous_config jsonb,
    previous_revision varchar(64),
    updated_at timestamptz(6) NOT NULL DEFAULT now(),
    CONSTRAINT product_tikkies_defaults_config_object CHECK (jsonb_typeof(config) = 'object'),
    CONSTRAINT product_tikkies_defaults_revision_format CHECK (revision ~ '^[0-9a-f]{64}$'),
    CONSTRAINT product_tikkies_defaults_config_bound CHECK (octet_length(config::text) <= 4194304)
);
COMMIT;
