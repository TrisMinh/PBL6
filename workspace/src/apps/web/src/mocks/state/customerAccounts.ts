import { z } from "zod";
import { accounts } from "../fixtures/accounts";
import type { RegisterInput } from "@/features/auth/repositories/authRepository";

const KEY = "blue-demo-customer-accounts";
const CHALLENGE = "blue-demo-customer-challenge";
const schema = z.object({
  userId: z.string(),
  role: z.literal("customer"),
  email: z.string().email(),
  digest: z.string(),
  verified: z.boolean(),
  fullName: z.string().optional(),
  phone: z.string().optional(),
});
type DemoAccount = z.infer<typeof schema>;
type Account = {
  userId: string;
  email: string;
  role: string;
  digest?: string;
  verified?: boolean;
  fullName?: string;
  phone?: string;
};

function readAccounts(): DemoAccount[] {
  try {
    return z
      .array(schema)
      .parse(JSON.parse(sessionStorage.getItem(KEY) ?? "[]"));
  } catch {
    return [];
  }
}
function saveAccount(account: DemoAccount): void {
  const remaining = readAccounts().filter(
    (entry) => entry.email !== account.email,
  );
  sessionStorage.setItem(
    KEY,
    JSON.stringify([...remaining.slice(-19), account]),
  );
}
async function digest(password: string, userId: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${userId}:${password}`),
  );
  return Array.from(new Uint8Array(bytes), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}
export function findDemoAccount(
  value: string,
  byUserId = false,
): Account | undefined {
  const matches = (account: Account): boolean =>
    byUserId ? account.userId === value : account.email === value;
  return readAccounts().find(matches) ?? accounts.find(matches);
}
export async function checkDemoPassword(
  account: Account,
  password: string,
): Promise<boolean> {
  if (account.verified === false) return false;
  return account.digest
    ? account.digest === (await digest(password, account.userId))
    : password === "BlueDemo2026";
}
export async function registerDemoAccount(input: RegisterInput): Promise<void> {
  if (!findDemoAccount(input.email)) {
    const userId = `mock-customer-${crypto.randomUUID()}`;
    saveAccount({
      userId,
      role: "customer",
      email: input.email,
      digest: await digest(input.password, userId),
      verified: false,
      fullName: input.fullName,
      phone: input.phone,
    });
  }
  sessionStorage.setItem(
    CHALLENGE,
    JSON.stringify({ email: input.email, expiresAt: Date.now() + 600000 }),
  );
}
export function beginDemoRecovery(email: string): void {
  sessionStorage.setItem(
    CHALLENGE,
    JSON.stringify({ email, expiresAt: Date.now() + 600000 }),
  );
}
export function resendDemoChallenge(): void {
  const challenge = readChallenge();
  if (challenge)
    sessionStorage.setItem(
      CHALLENGE,
      JSON.stringify({ ...challenge, expiresAt: Date.now() + 600000 }),
    );
}
function readChallenge(): { email: string; expiresAt: number } | null {
  try {
    return z
      .object({ email: z.string().email(), expiresAt: z.number() })
      .parse(JSON.parse(sessionStorage.getItem(CHALLENGE) ?? "null"));
  } catch {
    return null;
  }
}
export function hasDemoChallenge(): boolean {
  return Boolean(readChallenge());
}
export async function completeDemoChallenge(
  reset: boolean,
  password = "",
): Promise<void> {
  const challenge = readChallenge();
  if (!challenge) return;
  if (Date.now() >= challenge.expiresAt)
    throw Error("Mã đã hết hạn. Vui lòng gửi lại mã.");
  const account = findDemoAccount(challenge.email);
  if (account?.role === "customer") {
    const previous = readAccounts().find(
      (entry) => entry.userId === account.userId,
    );
    const passwordDigest = reset
      ? await digest(password, account.userId)
      : previous?.digest;
    if (passwordDigest)
      saveAccount({
        ...previous,
        userId: account.userId,
        role: "customer",
        email: account.email,
        digest: passwordDigest,
        verified: true,
      });
  }
  sessionStorage.removeItem(CHALLENGE);
}
