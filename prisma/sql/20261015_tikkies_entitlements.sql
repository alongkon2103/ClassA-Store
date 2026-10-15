-- Additive migration. Run in a transaction before deploying; no customer backfill or mapping guesses.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS roblox_user_id varchar(32),
  ADD COLUMN IF NOT EXISTS roblox_username varchar(20),
  ADD COLUMN IF NOT EXISTS roblox_display_name varchar(100),
  ADD COLUMN IF NOT EXISTS roblox_resolved_for varchar(20),
  ADD COLUMN IF NOT EXISTS tikkies_revision integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tikkies_updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE products ADD COLUMN IF NOT EXISTS roblox_universe_id varchar(32),
  ADD COLUMN IF NOT EXISTS roblox_place_ids text[] NOT NULL DEFAULT ARRAY[]::text[];
CREATE TABLE IF NOT EXISTS tikkies_rate_limits (
  key_hash varchar(64) PRIMARY KEY, count integer NOT NULL, reset_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS tikkies_rate_limits_reset_at_idx ON tikkies_rate_limits(reset_at);
CREATE TABLE IF NOT EXISTS roblox_binding_audit (
  id bigserial PRIMARY KEY, order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  actor_id uuid, old_ign text, new_ign text, old_roblox_id text, new_roblox_id text,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS roblox_binding_audit_order_id_changed_at_idx ON roblox_binding_audit(order_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_orders_tikkies_customer_game ON orders(user_id, product_id);
CREATE INDEX IF NOT EXISTS idx_orders_tikkies_game_ign ON orders(product_id, lower(btrim(whitelisted_username)));
CREATE INDEX IF NOT EXISTS idx_whitelist_tikkies_game_ign ON user_whitelist_access(product_id, lower(btrim(ign)));

CREATE OR REPLACE FUNCTION tikkies_order_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor text;
BEGIN
  IF lower(btrim(NEW.whitelisted_username)) IS DISTINCT FROM lower(btrim(OLD.whitelisted_username))
     AND NEW.roblox_resolved_for IS DISTINCT FROM lower(btrim(NEW.whitelisted_username)) THEN
    NEW.roblox_user_id := NULL; NEW.roblox_username := NULL;
    NEW.roblox_display_name := NULL; NEW.roblox_resolved_for := NULL;
  END IF;
  IF ROW(NEW.user_id, NEW.product_id, NEW.status, NEW.paid_at, NEW.whitelist_status, NEW.expires_at,
         NEW.whitelisted_username, NEW.roblox_user_id, NEW.roblox_username, NEW.roblox_display_name, NEW.roblox_resolved_for)
     IS DISTINCT FROM ROW(OLD.user_id, OLD.product_id, OLD.status, OLD.paid_at, OLD.whitelist_status, OLD.expires_at,
         OLD.whitelisted_username, OLD.roblox_user_id, OLD.roblox_username, OLD.roblox_display_name, OLD.roblox_resolved_for)
     OR NEW.tikkies_revision IS DISTINCT FROM OLD.tikkies_revision THEN
    NEW.tikkies_revision := OLD.tikkies_revision + 1;
    NEW.tikkies_updated_at := clock_timestamp();
  ELSE
    NEW.tikkies_revision := OLD.tikkies_revision;
    NEW.tikkies_updated_at := OLD.tikkies_updated_at;
  END IF;
  IF ROW(NEW.whitelisted_username, NEW.roblox_user_id) IS DISTINCT FROM ROW(OLD.whitelisted_username, OLD.roblox_user_id) THEN
    actor := current_setting('app.actor_id', true);
    INSERT INTO roblox_binding_audit(order_id, actor_id, old_ign, new_ign, old_roblox_id, new_roblox_id)
    VALUES(NEW.id, CASE WHEN actor ~ '^[0-9a-fA-F-]{36}$' THEN actor::uuid ELSE NULL END,
           OLD.whitelisted_username, NEW.whitelisted_username, OLD.roblox_user_id, NEW.roblox_user_id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tikkies_order_revision_trigger ON orders;
CREATE TRIGGER tikkies_order_revision_trigger BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION tikkies_order_revision();

CREATE OR REPLACE FUNCTION tikkies_whitelist_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND ROW(NEW.ign, NEW.product_id, NEW.expires_at) IS NOT DISTINCT FROM ROW(OLD.ign, OLD.product_id, OLD.expires_at) THEN RETURN NEW; END IF;
  IF TG_OP <> 'INSERT' THEN
    UPDATE orders SET tikkies_revision = tikkies_revision + 1
      WHERE product_id = OLD.product_id AND lower(btrim(whitelisted_username)) = lower(btrim(OLD.ign));
  END IF;
  IF TG_OP <> 'DELETE' THEN
    UPDATE orders SET tikkies_revision = tikkies_revision + 1
      WHERE product_id = NEW.product_id AND lower(btrim(whitelisted_username)) = lower(btrim(NEW.ign));
    RETURN NEW;
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS tikkies_whitelist_revision_trigger ON user_whitelist_access;
CREATE TRIGGER tikkies_whitelist_revision_trigger AFTER INSERT OR UPDATE OR DELETE ON user_whitelist_access FOR EACH ROW EXECUTE FUNCTION tikkies_whitelist_revision();

CREATE OR REPLACE FUNCTION tikkies_product_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.name_en, NEW.type, NEW.roblox_universe_id, NEW.roblox_place_ids) IS DISTINCT FROM ROW(OLD.name_en, OLD.type, OLD.roblox_universe_id, OLD.roblox_place_ids) THEN
    UPDATE orders SET tikkies_revision = tikkies_revision + 1 WHERE product_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tikkies_product_revision_trigger ON products;
CREATE TRIGGER tikkies_product_revision_trigger AFTER UPDATE ON products FOR EACH ROW EXECUTE FUNCTION tikkies_product_revision();
