import { z } from "zod";

import {
  MOCK_SESSION_LIMIT,
  MOCK_SESSION_TTL_MS,
} from "@/features/auth/config/session";
import { authenticatedSessionSchema } from "@/features/auth/schemas/session.schema";
import { findDemoAccount } from "./customerAccounts";
import type { MockAuthGrant } from "@/mocks/state/authState";

export const authSnapshotSchema = z
  .array(
    authenticatedSessionSchema
      .unwrap()
      .extend({ createdAt: z.iso.datetime() })
      .strict()
      .readonly(),
  )
  .max(MOCK_SESSION_LIMIT)
  .default([]);
export function validAuthGrants(
  grants: readonly MockAuthGrant[],
  now: number,
): boolean {
  return (
    new Set(grants.map((grant) => grant.token)).size === grants.length &&
    grants.every(
      (grant) =>
        Date.parse(grant.createdAt) <= now &&
        Date.parse(grant.expiresAt) - Date.parse(grant.createdAt) ===
          MOCK_SESSION_TTL_MS &&
        findDemoAccount(grant.userId, true)?.role === grant.role,
    )
  );
}
