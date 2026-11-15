import type { z } from "zod";

import { authenticatedSessionSchema } from "@/features/auth/schemas/session.schema";
import { findDemoAccount } from "./customerAccounts";
import type { MockDb } from "@/mocks/state/mockDb";
import { MOCK_SESSION_HEADER } from "@/features/auth/config/session";

export type MockAuthGrant = z.infer<typeof authenticatedSessionSchema> & {
  readonly createdAt: string;
};
export function readAuthGrant(
  db: MockDb,
  request: Request,
  now: number,
): MockAuthGrant | null {
  const token = request.headers.get(MOCK_SESSION_HEADER);
  const grant = token ? db.authSessions.get(token) : undefined;
  if (!grant || Date.parse(grant.expiresAt) <= now) return null;
  return grant;
}
export function accountOwnsTicket(
  grant: MockAuthGrant,
  email: string,
): boolean {
  return (
    grant.role === "customer" &&
    findDemoAccount(grant.userId, true)?.email === email.trim().toLowerCase()
  );
}
