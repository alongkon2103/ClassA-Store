-- Additive only. Apply only to the explicitly isolated local PostgreSQL schema.
-- No catalog mutation, entitlement rewrite, or migration is run by this file.
ALTER TABLE products ADD COLUMN IF NOT EXISTS bundle_product_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bundle_snapshot jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bundle_parent_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_bundle_parent_id_fkey' AND conrelid = 'orders'::regclass) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_bundle_parent_id_fkey
      FOREIGN KEY (bundle_parent_id) REFERENCES orders(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_orders_bundle_parent ON orders(bundle_parent_id);
-- NULL parent IDs allow all existing standalone orders; a bundle cannot grant a game twice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_bundle_child_product ON orders(bundle_parent_id, product_id);
