import { z } from "zod";

const KEY = "blue-pending-verification";
const schema = z.object({
  challengeId: z.string().uuid(),
  email: z.string().email(),
  requestedAt: z.number(),
});
export type PendingVerification = z.infer<typeof schema>;

// Keep challenge context in this browser tab; never persist the password or OTP.
export function readPendingVerification(): PendingVerification | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = schema.safeParse(
      JSON.parse(sessionStorage.getItem(KEY) ?? "null"),
    );
    return parsed.success && Date.now() - parsed.data.requestedAt < 30 * 60_000
      ? parsed.data
      : null;
  } catch {
    return null;
  }
}
export function savePendingVerification(
  challengeId: string,
  email: string,
): void {
  sessionStorage.setItem(
    KEY,
    JSON.stringify(
      schema.parse({
        challengeId,
        email: email.trim(),
        requestedAt: Date.now(),
      }),
    ),
  );
}
export function clearPendingVerification(): void {
  sessionStorage.removeItem(KEY);
}
