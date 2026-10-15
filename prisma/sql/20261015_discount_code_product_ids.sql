-- Apply before deploying the application; existing codes retain their current scope.
ALTER TABLE "discount_codes"
  ADD COLUMN IF NOT EXISTS "product_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];
