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

-- TikTok has different gift IDs with the same public name. Identity is the ID.
-- Discover actual constraint/index names rather than assuming a Prisma name.
DO $$ DECLARE item record; BEGIN
  FOR item IN SELECT c.conname FROM pg_constraint c
    WHERE c.conrelid='gifts'::regclass AND c.contype='u'
      AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='gifts'::regclass AND attname='name')]::smallint[]
  LOOP EXECUTE format('ALTER TABLE gifts DROP CONSTRAINT %I',item.conname); END LOOP;
  FOR item IN SELECT i.indexrelid::regclass AS index_name FROM pg_index i
    WHERE i.indrelid='gifts'::regclass AND i.indisunique AND NOT i.indisprimary
      AND i.indnatts=1 AND i.indkey[0]=(SELECT attnum FROM pg_attribute WHERE attrelid='gifts'::regclass AND attname='name')
  LOOP EXECUTE format('DROP INDEX %s',item.index_name); END LOOP;
END $$;
CREATE INDEX IF NOT EXISTS idx_gifts_name ON gifts(name);
