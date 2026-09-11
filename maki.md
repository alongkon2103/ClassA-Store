# Maki Partner API — Reseller Integration Guide

Version 1.1 · September 2026

This API lets **Partner** sell Maki games directly from your own shop:

- You pick the sell price (it just has to be at or above our minimum for each game).
- We generate a Stripe payment link for your customer.
- When the customer pays, their game access is delivered **automatically** — no keys, no manual work.
- Your margin (sell price − our minimum) lands in **your own Stripe account** automatically.

---

## 1. How it works (architecture)

```
Your shop                     Maki API                          Stripe
─────────                     ─────────                          ──────
customer logs in
(Discord or Google OAuth)
        │
        ▼
POST /orders ───────────────► validates price ≥ minimum
        │                     creates order (UUID)
        │                     creates Checkout Session ───────► hosted payment page
        ◄──────────────────── returns payment_url ────────────┘
        │
redirect customer to
payment_url
        │                                                        customer pays
        │                                                        ◄─────────────
        │                     Stripe webhook ──────────────────── payment confirmed
        │                     whitelist the customer's
        │                     Discord/Google identity
        ◄──── GET /orders/:id (poll) ──────┘
        status: "paid" + delivered access

GET /orders ────────────────► your full order history
(reconciliation, dashboards)

                                Maki pays your share manually
                                (e.g. a monthly batch) ───────► your account
```

**You never handle cards or keys.** Stripe handles the payment, we handle delivery, and your share is paid out to you manually — see §8 for how the money works.

## 2. Base URL & authentication

| | |
|---|---|
| Base URL | `https://maki-website.onrender.com/api/partner/v1` |
| Auth header | `X-Partner-Key: <your key>` |
| Protocol | HTTPS only, server-to-server |

Your API key is a static string issued by Maki admin. Send it as a header on **every** request:

```
X-Partner-Key: mpk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
We will give u separate
```

- Never put the key in a URL, in frontend code, or in logs.
- If it leaks, Maki admin rotates it — your old key dies instantly and you get a new one.
- Calls without a valid key get `401`; a disabled key gets `403`.

## 3. Product catalog

### `GET /products`

Returns every product key you're allowed to sell, its **minimum sell price**, its **preset folder link** (Google Drive — game presets/templates your customer may need), a **video preview link**, and the game's **icon + banner images**.

```json
{
  "success": true,
  "data": {
    "products": [
      {
        "key": "maki_boxing_1m",
        "name": "Maki Boxing",
        "plan": "1m",
        "duration_days": 30,
        "min_price_thb": 550,
        "preset_link": "https://drive.google.com/drive/folders/17vFNNUPQr1OGbQZt_IPtEseYJfxb5kzb",
        "preview_url": "https://youtu.be/XIxoTCQdrds",
        "icon_url": "https://maki-website.onrender.com/Picture/minecraft_server_icon/maki_boxing.jpg",
        "banner_url": "https://maki-website.onrender.com/Picture/minecraft_server_banner/BannerBoxing.jpg"
      },
      {
        "key": "maki_boxing_perma",
        "name": "Maki Boxing",
        "plan": "perma",
        "duration_days": 36500,
        "min_price_thb": 1250,
        "preset_link": "https://drive.google.com/drive/folders/17vFNNUPQr1OGbQZt_IPtEseYJfxb5kzb",
        "preview_url": "https://youtu.be/XIxoTCQdrds",
        "icon_url": "https://maki-website.onrender.com/Picture/minecraft_server_icon/maki_boxing.jpg",
        "banner_url": "https://maki-website.onrender.com/Picture/minecraft_server_banner/BannerBoxing.jpg"
      }
    ]
  }
}
```

Field notes:

- `key` — the identifier you send when creating an order. Format is `<game>_1m` (30 days) or `<game>_perma` (permanent).
- `min_price_thb` — the **lowest total** you may charge for one unit of this key.
- `preset_link` — Google Drive folder with that game's presets. Show it to the customer after purchase (also present in the order detail).
- `preview_url` — official YouTube gameplay video for the game. Use it on your product pages so customers see what they're buying (embed it or link it — `null` only if we haven't published a video yet).
- `icon_url` / `banner_url` — the game's official square icon and wide banner image, hosted by us. Hot-link them directly on your product pages, or download and re-host your own copies. `null` only if a game has no image yet.
- Sync this list periodically (e.g. daily) — prices and availability change.

## 4. Creating an order

### `POST /orders`

```json
{
  "items": {
    "maki_boxing_1m": 2,
    "maki_block_1m": 1
  },
  "price_thb": 1800,
  "customer": {
    "provider": "discord",
    "id": "470113895490521088"
  },
  "partner_order_ref": "ACS-1024",
  "redirect_link": "https://your-shop.com/orders/ACS-1024/thanks"
}
```

| Field | Meaning |
|---|---|
| `items` | Product key → quantity (1–50 each, max 20 keys). Quantities stack: `maki_boxing_1m: 2` = 60 days. |
| `price_thb` | **Your** total sell price for the whole order. Must be ≥ the sum of minimums (here 2×550 + 1×500 = 1600). |
| `customer.provider` | `discord` or `google` — wherever the customer logged in at YOUR shop. |
| `customer.id` | The customer's **global** Discord ID or Google subject ID (see §7). |
| `partner_order_ref` | Your own unique order number. **Reusing it returns the same order** — this makes retries safe. |
| `redirect_link` | *(Optional)* Absolute `http(s)` URL, max 500 chars. Where the customer lands after **successful** payment — see below. |

Successful response:

```json
{
  "success": true,
  "data": {
    "order_id": "9f3c1a2e-7b4d-4e8f-9a2b-1c3d5e7f9a01",
    "status": "pending",
    "payment_url": "https://checkout.stripe.com/c/pay/cs_test_...",
    "expires_at": "2026-09-08T11:24:00.000Z",
    "partner_order_ref": "ACS-1024"
  }
}
```

Redirect the customer to `payment_url`. The link lives ~24 hours (`expires_at`); after that, create a **new order with a new ref**.

**Custom return URL (`redirect_link`)** — optional, per order:

- Provided → after successful payment the customer is redirected to your link with `order_id` and `status=paid` appended: `https://your-shop.com/orders/ACS-1024/thanks?order_id=9f3c1a2e-…&status=paid` (merged cleanly if your link already has a query string).
- Omitted or empty → the customer lands on the **Maki receipt page**, which confirms the order for them and links back to your shop.
- **Cancelled** payments always land on the Maki page — you never have to build a cancel screen.
- Your landing page can confirm payment itself: poll `GET /orders/{order_id}` from **your backend** (full detail), or the public `GET /order-status/{order_id}` directly from the browser (status only, no key needed).

**Idempotency — read this:** if your request times out or your code retries, sending the same `partner_order_ref` returns the *existing* order (same `order_id`, same payment link). No double charges, ever. So: one unique ref per logical order, always.

## 5. Checking an order

### `GET /orders/{order_id}`

Poll this every few seconds after sending the customer to Stripe (or when they return to your site). Full example of a **paid** order:

```json
{
  "success": true,
  "data": {
    "order_id": "9f3c1a2e-7b4d-4e8f-9a2b-1c3d5e7f9a01",
    "status": "paid",
    "partner_order_ref": "ACS-1024",
    "items": [
      { "key": "maki_boxing_1m", "name": "Maki Boxing", "qty": 2, "days": 60, "min_price_thb": 550 },
      { "key": "maki_block_1m",  "name": "Maki Block",  "qty": 1, "days": 30, "min_price_thb": 500 }
    ],
    "min_total_thb": 1600,
    "price_thb": 1800,
    "customer": { "provider": "discord", "id": "470113895490521088" },
    "access": [
      { "key": "maki_boxing_1m", "product": "Maki Boxing", "server_id": "Maki_Boxing", "days": 60, "expires_at": "2026-11-06T11:30:00.000Z" },
      { "key": "maki_block_1m",  "product": "Maki Block",  "server_id": "Maki_Block",  "days": 30, "expires_at": "2026-10-07T11:30:00.000Z" }
    ],
    "stripe": {
      "checkout_session_id": "cs_test_...",
      "payment_intent_id": "pi_...",
      "paid_at": "2026-09-07T11:30:12.000Z"
    },
    "expires_at": "2026-09-08T11:24:00.000Z",
    "created_at": "2026-09-07T11:24:00.000Z"
  }
}
```

Status lifecycle:

| Status | Meaning | What you do |
|---|---|---|
| `pending` | Link created, not paid yet | Keep waiting (or until `expires_at`) |
| `paid` | Paid **and delivered** — `access[]` shows what the customer got, with expiry dates | Mark complete in your shop, show receipt |
| `expired` | Link died unpaid | New order, new ref, if the customer still wants it |
| `failed` | Payment failed / link creation failed | New order, new ref |

Notes:

- After Stripe redirects the customer back, we drop them on a Maki page that says "payment successful — your games are active", with a link back to your shop.
- `access` may be `null` for a few seconds after `status` flips to `paid` (delivery is finishing). Poll again if you need it.
- If the customer already had time on a game (bought from anywhere), new days **stack on top** — `expires_at` reflects the real expiry.

### `GET /orders` — your order history

All your orders, newest first, each entry the same shape as the single-order detail above. Use it for reconciliation, a sales dashboard, or to find an order whose `order_id` you lost (`partner_order_ref` is in every entry).

Query parameters (all optional):

| Param | Values | Default |
|---|---|---|
| `limit` | 1–200 | 50 |
| `status` | `pending` / `paid` / `failed` / `expired` | all statuses |
| `game` | any product key, e.g. `maki_boxing_1m` | all games |

Example — your last 10 paid orders containing Maki Boxing 1m:

`GET /orders?status=paid&game=maki_boxing_1m&limit=10`

Response (shown unfiltered — the filters just narrow the list):

```json
{
  "success": true,
  "data": {
    "count": 2,
    "orders": [
      {
        "order_id": "9f3c1a2e-7b4d-4e8f-9a2b-1c3d5e7f9a01",
        "status": "paid",
        "partner_order_ref": "ACS-1024",
        "items": [ { "key": "maki_boxing_1m", "name": "Maki Boxing", "qty": 2, "days": 60, "min_price_thb": 550 } ],
        "min_total_thb": 1100,
        "price_thb": 1300,
        "customer": { "provider": "discord", "id": "470113895490521088" },
        "access": [ { "key": "maki_boxing_1m", "product": "Maki Boxing", "server_id": "Maki_Boxing", "days": 60, "expires_at": "2026-11-06T11:30:00.000Z" } ],
        "stripe": { "checkout_session_id": "cs_test_...", "payment_intent_id": "pi_...", "paid_at": "2026-09-07T11:30:12.000Z" },
        "expires_at": "2026-09-08T11:24:00.000Z",
        "created_at": "2026-09-07T11:24:00.000Z"
      },
      {
        "order_id": "7a2b1c3d-5e7f-9a2b-1c3d-5e7f9a017b4d",
        "status": "expired",
        "partner_order_ref": "ACS-1023",
        "items": [ { "key": "maki_block_1m", "name": "Maki Block", "qty": 1, "days": 30, "min_price_thb": 500 } ],
        "min_total_thb": 500,
        "price_thb": 600,
        "customer": { "provider": "google", "id": "104320571283960198734" },
        "access": null,
        "stripe": { "checkout_session_id": "cs_test_...", "payment_intent_id": null, "paid_at": null },
        "expires_at": "2026-09-06T09:00:00.000Z",
        "created_at": "2026-09-05T09:00:00.000Z"
      }
    ]
  }
}
```

## 6. Checking what a customer currently has (support)

When a customer asks "where are my games?" or "how many days do I have left?", look them up by the same ID you send on orders:

### `GET /whitelist?provider=discord&id=470113895490521088`

```json
{
  "success": true,
  "data": {
    "customer": { "provider": "discord", "id": "470113895490521088" },
    "access": [
      {
        "game": "Maki Boxing",
        "server_id": "Maki_Boxing",
        "days_remaining": 74,
        "expires_at": "2026-11-20T05:47:10.000Z",
        "added_by": "partner:example name:9f3c1a2e",
        "from_your_orders": true
      },
      {
        "game": "Maki Farm",
        "server_id": "Maki_Farm",
        "days_remaining": 3,
        "expires_at": "2026-09-10T05:47:10.000Z",
        "added_by": "webshop:abcdef12",
        "from_your_orders": false
      }
    ]
  }
}
```

This reads the **live whitelist** the launcher actually checks at login, so it shows the customer's complete picture — entries your orders created **and** ones from the Maki webshop or other sources. Useful for support:

- `access: []` → the customer has nothing active. If they claim they paid, they're probably logged into the launcher with a *different* account (or a different provider — Discord vs Google) than the one on the order.
- `days_remaining` counts down in real time; `expires_at` is the exact expiry.
- `from_your_orders: true` marks the entries your sales created; `added_by` shows the origin tag for everything else.
- Rows include *all* games the customer owns, not just yours — treat the data as confidential to that customer.

## 7. Customer identity (important)

There are no keys and no codes in this system. Game access is delivered **directly to an account**: when payment succeeds, we add the purchased days to whatever Discord or Google account you identified in the order. The customer later opens the **Maki Launcher**, logs in with that same account, and their games are simply unlocked.

That's why every order must tell us *which account* to deliver to, using the provider the customer logged in with at **your** shop:

- **Discord** → send the customer's Discord user ID
- **Google** → send the customer's Google subject ID

Both IDs are **global** — the same number identifies that person everywhere (Discord IDs and Google IDs are unique per person, not per website). So the ID your OAuth login gives you is the exact same ID our launcher checks. You do not need the customer to do anything on our side, and we do not need to know their email, username, or password.

### How to get the IDs (standard OAuth)

| Provider | OAuth setup | Where the ID is |
|---|---|---|
| Discord | OAuth2 with the `identify` scope | `GET https://discord.com/api/users/@me` → `id` |
| Google | OAuth2 / OpenID Connect with the `openid` scope | ID token `sub` claim, or `GET https://www.googleapis.com/oauth2/v3/userinfo` → `sub` |

### What the values look like

Both are plain numeric strings — no name, no email, no `@`:

```jsonc
// Customer logged in with Discord:
"customer": {
  "provider": "discord",
  "id": "470113895490521088"   // 17-20 digit Discord user ID
}

// Customer logged in with Google:
"customer": {
  "provider": "google",
  "id": "104320571283960198734"   // ~21-digit Google subject ID ("sub")
}
```

Common mistakes to avoid:

- ❌ Discord **username** (`"username"`) or Google **email** (`"someone@gmail.com"`) — these can change and don't identify the account to our launcher. Only the numeric ID works.
- ❌ Your own internal user ID from your database — we can't map it to anything.
- ❌ A `U-` prefixed Google value (that's a legacy Gaia ID format; use the numeric `sub`).

⚠️ **Deliver-to risk is yours to prevent:** we whitelist exactly the ID you send. If your checkout lets a customer pay while logged into the *wrong* account, that wrong account gets the games. Show "This purchase unlocks for **@username**" before payment, and put the delivered identity (`customer` field in the order detail) on your receipt so the customer can self-verify.

## 8. Money — how payment works

For an order of minimum total **B** and your price **P**:

- The customer pays **P** on Stripe. The full amount goes to Maki.
- Maki pays you your share **P − B** manually (e.g. as a monthly batch) via the connected Stripe account you set up during onboarding. The Maki team sees every order (and its share) in their sales channel and reconciles payouts from that.
- Stripe's processing fee for the whole charge is borne by Maki's account under this model; agree on any fee-sharing when you set your price.
- Maki policy: **no refunds** on partner orders (digital goods, delivered instantly).

One-time setup: Maki admin sends you a Stripe onboarding link (Stripe-hosted). You sign in with your Thai Stripe account (or create one), enter your ID + bank details, and you're connected. Until onboarding completes, `POST /orders` returns `409` — that's the signal setup isn't finished.

## 9. Errors

| HTTP | Meaning |
|---|---|
| `400` | Validation — read `message`: unknown/disabled product key, price below minimum, bad quantity, missing/invalid fields |
| `401` | Missing/invalid `X-Partner-Key` |
| `403` | Partner key disabled |
| `404` | Order not found (or belongs to another partner) |
| `409` | Stripe onboarding incomplete — contact Maki admin |
| `502` | Stripe session could not be created — retry with a **new** `partner_order_ref` |

All errors share the shape `{ "success": false, "message": "..." }`.

## 10. Integration checklist

1. Store `X-Partner-Key` in your backend env (never in frontend code).
2. Build your whole integration against the **test API** first (section 12) — no money, no Stripe setup needed.
3. `GET /products` → import catalog (name, key, min price, preset link).
4. Product page: let your staff pick the sell price, enforce ≥ min price in YOUR UI too.
5. Checkout: customer logs in with Discord/Google → show "unlocks for @username" → `POST /orders` → redirect to `payment_url`.
6. On return / webhook-of-your-own: poll `GET /orders/{id}` every 3–5 s until `paid`/`expired`.
7. On `paid`: mark order done, show receipt (include delivered identity + preset links from the catalog).
8. Retries: always reuse the same `partner_order_ref` for the same logical order.
9. Go live: run ONE real order at minimum price end-to-end before opening your store.

## 11. Quick test with curl

Replace `mpk_...` with your key. All commands work in any terminal (and import into Postman).

**Catalog:**

```bash
curl -s "https://maki-website.onrender.com/api/partner/v1/products" \
  -H "X-Partner-Key: mpk_YOUR_KEY"
```

**Create an order** (minimum for this cart is 2 × 550 = ฿1,100, we charge ฿1,300 → margin ฿200):

```bash
curl -s -X POST "https://maki-website.onrender.com/api/partner/v1/orders" \
  -H "X-Partner-Key: mpk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "items": { "maki_boxing_1m": 2 },
    "price_thb": 1300,
    "customer": { "provider": "discord", "id": "470113895490521088" },
    "partner_order_ref": "ACS-EXAMPLE-1"
  }'
```

**Retry the same request** (same `partner_order_ref`) → returns the SAME order, no second payment link. That's the idempotency contract — safe retries.

**Below the minimum** → `400` with the exact required amount:

```bash
curl -s -X POST "https://maki-website.onrender.com/api/partner/v1/orders" \
  -H "X-Partner-Key: mpk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "items": { "maki_boxing_perma": 1 },
    "price_thb": 100,
    "customer": { "provider": "google", "id": "104320571283960198734" },
    "partner_order_ref": "ACS-EXAMPLE-2"
  }'
```

**Check an order** (replace the UUID with the `order_id` from the create response — poll every few seconds until `paid`):

```bash
curl -s "https://maki-website.onrender.com/api/partner/v1/orders/9f3c1a2e-7b4d-4e8f-9a2b-1c3d5e7f9a01" \
  -H "X-Partner-Key: mpk_YOUR_KEY"
```

**Your order history** — e.g. the last 10 paid Maki Boxing orders (drop `game` for all games, `status` for all states):

```bash
curl -s "https://maki-website.onrender.com/api/partner/v1/orders?status=paid&game=maki_boxing_1m&limit=10" \
  -H "X-Partner-Key: mpk_YOUR_KEY"
```

**Look up what a customer currently has** (support):

```bash
curl -s "https://maki-website.onrender.com/api/partner/v1/whitelist?provider=discord&id=470113895490521088" \
  -H "X-Partner-Key: mpk_YOUR_KEY"
```

## 12. Test mode (sandbox)

Build and debug your integration **without money, Stripe, or delivery**. Same key, same request/response shapes — you only add `/test` to the path.

| Real endpoint | Test endpoint | What you get |
|---|---|---|
| `GET /products` | `GET /test/products` | An **example** catalog (not the live one — always fetch real `/products` in production) |
| `POST /orders` | `POST /test/orders` | Validates your request with the **same rules** (unknown key, quantity, minimum total, ฿10 floor, customer identity, ref length) → valid requests get a fixed example response |
| `GET /orders` | `GET /test/orders` | An **example** order history — the `status` / `game` / `limit` filters work on the example data |
| `GET /orders/{id}` | `GET /test/orders/pending` | The polling response while awaiting payment (`status: "pending"`, `access: null`) |
| | `GET /test/orders/paid` | The **success** response (`status: "paid"`, mocked `access` list with `TEST-` keys, `stripe.paid_at` set) |
| | `GET /test/orders/expired` | The expiry response |

Any other id returns the pending example, so a real polling loop pointed at the sandbox just spins on pending — point it at `.../paid` to exercise your success branch.

**Not covered by test mode:** real Stripe payments and payouts, real key delivery, and the customer return page. Verify those once with a single minimum-priced real order before going live.

Walkthrough:

```bash
# 1) Example catalog
curl -s "https://maki-website.onrender.com/api/partner/v1/test/products" \
  -H "X-Partner-Key: mpk_YOUR_KEY"

# 2) Validate a create request — valid input gets the fixed example response
#    (redirect_link is optional and validated the same way as production)
curl -s -X POST "https://maki-website.onrender.com/api/partner/v1/test/orders" \
  -H "X-Partner-Key: mpk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "items": { "maki_boxing_1m": 2 },
    "price_thb": 1300,
    "customer": { "provider": "discord", "id": "470113895490521088" },
    "partner_order_ref": "ACS-TEST-1",
    "redirect_link": "https://your-shop.com/orders/ACS-TEST-1/thanks"
  }'
# → { "order_id": "test-a1b2c3d4-…", "status": "pending", "payment_url": "…mock…", … }

# 3) Below the minimum → same 400 as production
curl -s -X POST "https://maki-website.onrender.com/api/partner/v1/test/orders" \
  -H "X-Partner-Key: mpk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "items": { "maki_boxing_perma": 1 },
    "price_thb": 100,
    "customer": { "provider": "google", "id": "104320571283960198734" },
    "partner_order_ref": "ACS-TEST-2"
  }'

# 4) Poll examples — pending / paid / expired
curl -s "https://maki-website.onrender.com/api/partner/v1/test/orders/pending" \
  -H "X-Partner-Key: mpk_YOUR_KEY"
curl -s "https://maki-website.onrender.com/api/partner/v1/test/orders/paid" \
  -H "X-Partner-Key: mpk_YOUR_KEY"
curl -s "https://maki-website.onrender.com/api/partner/v1/test/orders/expired" \
  -H "X-Partner-Key: mpk_YOUR_KEY"

# 5) Example history — filters work on the example data
curl -s "https://maki-website.onrender.com/api/partner/v1/test/orders?status=paid&game=maki_boxing_1m&limit=10" \
  -H "X-Partner-Key: mpk_YOUR_KEY"
```

## 13. Support

Something wrong with an order (paid but no access, wrong identity)? Bring the `order_id` — every investigation starts there. Contact Maki admin.