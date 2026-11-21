-- Additive presentation metadata. Existing function IDs, keys and bindings stay intact.
-- Existing rows remain NULL until a confident category backfill. New records
-- default to intentional neutral; this distinguishes legacy unclassified data.
ALTER TABLE product_functions ADD COLUMN IF NOT EXISTS category varchar(16);
ALTER TABLE product_functions ALTER COLUMN category DROP NOT NULL;
ALTER TABLE product_functions ALTER COLUMN category SET DEFAULT 'neutral';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='product_functions'::regclass AND conname='product_functions_category_check') THEN
    ALTER TABLE product_functions ADD CONSTRAINT product_functions_category_check CHECK (category IS NULL OR category IN ('help','troll','neutral')) NOT VALID;
  END IF;
END $$;
ALTER TABLE product_functions VALIDATE CONSTRAINT product_functions_category_check;
