import Stripe from "stripe";

let cachedClient: Stripe | null = null;

/**
 * Manually-configured Stripe client — uses STRIPE_SECRET_KEY provided directly
 * by the project owner (not the Replit-managed Stripe connector).
 */
export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!cachedClient) {
    cachedClient = new Stripe(secretKey);
  }
  return cachedClient;
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  return secret;
}
