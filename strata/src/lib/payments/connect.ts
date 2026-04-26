import { getStripe } from "./stripe";

export type CreateConnectAccountInput = {
  email: string;
  country?: string;
};

export type CreateTransferInput = {
  amountCents: number;
  destination: string;
  description?: string;
};

export type ConnectAccountHandle = {
  id: string;
  stub: boolean;
};

export type TransferHandle = {
  id: string;
  stub: boolean;
};

function isStub(): boolean {
  return (process.env.STRIPE_CONNECT_MODE ?? "stub") === "stub";
}

function stubId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_demo_${random}`;
}

export async function createConnectedAccount(
  input: CreateConnectAccountInput,
): Promise<ConnectAccountHandle> {
  if (isStub()) {
    return { id: stubId("acct"), stub: true };
  }
  const account = await getStripe().accounts.create({
    type: "express",
    email: input.email,
    country: input.country,
    capabilities: { transfers: { requested: true } },
  });
  return { id: account.id, stub: false };
}

export async function createTransfer(
  input: CreateTransferInput,
): Promise<TransferHandle> {
  if (isStub()) {
    return { id: stubId("tr"), stub: true };
  }
  const transfer = await getStripe().transfers.create({
    amount: input.amountCents,
    currency: "usd",
    destination: input.destination,
    description: input.description,
  });
  return { id: transfer.id, stub: false };
}
