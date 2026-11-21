-- Additive only. Back up product_presets and generate Prisma Client before switching the app.
ALTER TABLE product_presets ADD COLUMN IF NOT EXISTS tikkies_bindings JSONB;
