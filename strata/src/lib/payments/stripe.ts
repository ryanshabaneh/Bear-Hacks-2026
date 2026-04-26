import Stripe from "stripe";

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY not set. Required for payment intents and webhook verification.",
    );
  }
  client = new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
  return client;
}

export type CreateForecastIntentInput = {
  budgetCents: number;
  forecastId: string;
  clientId: string;
};

export async function createForecastFundingIntent(
  input: CreateForecastIntentInput,
): Promise<Stripe.PaymentIntent> {
  return getStripe().paymentIntents.create({
    amount: input.budgetCents,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    metadata: {
      forecastId: input.forecastId,
      clientId: input.clientId,
    },
  });
}

export function constructWebhookEvent(
  rawBody: Buffer | string,
  signatureHeader: string,
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET not set. For local dev, run `stripe listen --forward-to http://localhost:3000/api/stripe/webhook` and use the printed secret.",
    );
  }
  return getStripe().webhooks.constructEvent(rawBody, signatureHeader, secret);
}
