-- Additive and idempotent: no changes to existing balances, orders, or access.
CREATE TABLE IF NOT EXISTS halloween_draws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key varchar(64) NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prize jsonb NOT NULL,
  result jsonb,
  ledger_id uuid UNIQUE REFERENCES point_ledger(id) ON DELETE RESTRICT,
  order_id uuid UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_key, user_id)
);
