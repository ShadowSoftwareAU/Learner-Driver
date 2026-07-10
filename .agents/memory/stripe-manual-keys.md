---
name: Stripe integration with manually-provided keys
description: When the user explicitly declines the Replit Stripe connector and provides STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET directly, use the official stripe npm package, not stripe-replit-sync.
---

If the user dismisses `proposeIntegration` for Stripe (once or twice) and instead asks to provide API keys manually, stop suggesting the connector and request `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` via `requestEnvVar`.

**Why:** The `stripe-replit-sync` package and `getUncachableStripeClient()` pattern from the stripe skill only work with a Replit-managed connector session. With manually-supplied keys there is no connector session, so a plain `new Stripe(process.env.STRIPE_SECRET_KEY)` client is the correct approach instead.

**How to apply:**
- Webhook route must be registered with `express.raw()` *before* the global `express.json()` middleware, or signature verification (`stripe.webhooks.constructEvent`) fails.
- For arbitrary/variable checkout amounts (e.g. wallet top-ups), Stripe Checkout `price_data` inline pricing is correct and does not violate the "don't duplicate Stripe catalog" rule — that rule is about pre-created catalog products/prices, not ad-hoc `price_data`.
