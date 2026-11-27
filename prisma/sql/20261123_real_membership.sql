-- Additive production rollout, after a verified backup. No existing orders or rights change.
ALTER TABLE products ADD COLUMN IF NOT EXISTS bundle_all_ac_games boolean NOT NULL DEFAULT false;
