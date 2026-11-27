-- Short-lived PKCE-bound browser approval for the isolated Tikkies checkout.
CREATE TABLE IF NOT EXISTS tikkies_checkout_codes (
 code_hash char(64) PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 challenge varchar(43) NOT NULL,
 offer jsonb,
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS tikkies_checkout_codes_expiry ON tikkies_checkout_codes(expires_at);
ALTER TABLE tikkies_checkout_codes ADD COLUMN IF NOT EXISTS offer jsonb;
