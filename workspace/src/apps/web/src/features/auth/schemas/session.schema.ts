import { isMockApi } from "@/shared/api/config";
import { z } from "zod";

export const sessionTokenSchema = isMockApi
  ? z.string().uuid()
  : z.string().min(1).max(8192);
export const mockSessionSchema = z
  .object({
    userId: z.string().min(1).max(128),
    role: z.enum(["customer", "admin"]),
    expiresAt: z.iso.datetime(),
    token: sessionTokenSchema.optional(),
  })
  .strict()
  .readonly();
export const authenticatedSessionSchema = mockSessionSchema
  .unwrap()
  .extend({ token: sessionTokenSchema })
  .strict()
  .readonly();
