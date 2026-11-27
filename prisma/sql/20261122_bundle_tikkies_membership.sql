-- Additive migration. Local preview only until deployment is explicitly requested.
ALTER TABLE products ADD COLUMN IF NOT EXISTS bundle_includes_tikkies boolean NOT NULL DEFAULT false;
