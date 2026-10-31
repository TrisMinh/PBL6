import { z } from "zod";

import type { AdminListStatus } from "../types/admin";

export const ADMIN_LIST_STATUSES = [
  "active",
  "inactive",
  "pending-payment",
  "paid",
  "cancelled",
  "pending",
  "success",
  "failed",
  "processing",
  "completed",
] as const satisfies readonly AdminListStatus[];

const querySchema = z.string().trim().min(1).max(100);
const organizationIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const statusSchema = z.enum(ADMIN_LIST_STATUSES);
const positiveDecimalStringSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number);
const pageFromUrlSchema = positiveDecimalStringSchema.pipe(
  z.number().int().min(1),
);
const pageSizeFromUrlSchema = positiveDecimalStringSchema.pipe(
  z.number().int().min(1).max(100),
);

export const adminListParamsSchema = z
  .object({
    query: querySchema.optional(),
    status: statusSchema.optional(),
    organizationId: organizationIdSchema.optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20),
  })
  .strict();

export type AdminListParams = z.infer<typeof adminListParamsSchema>;

function readSingle(params: URLSearchParams, key: string): string | undefined {
  const values = params.getAll(key);
  return values.length === 1 ? values[0] : undefined;
}

function parseOptional<T>(
  schema: z.ZodType<T>,
  value: string | undefined,
): T | undefined {
  if (value === undefined) return undefined;
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}

function parsePage(
  params: URLSearchParams,
  key: "page" | "pageSize",
  fallback: number,
): number {
  const rawValue = readSingle(params, key);
  if (rawValue === undefined || rawValue.trim() === "") return fallback;

  const schema = key === "page" ? pageFromUrlSchema : pageSizeFromUrlSchema;
  const result = schema.safeParse(rawValue);
  return result.success ? result.data : fallback;
}

export function parseAdminListParams(params: URLSearchParams): AdminListParams {
  const query = parseOptional(querySchema, readSingle(params, "query"));
  const status = parseOptional(statusSchema, readSingle(params, "status"));
  const organizationId = parseOptional(
    organizationIdSchema,
    readSingle(params, "organizationId"),
  );

  return adminListParamsSchema.parse({
    ...(query === undefined ? {} : { query }),
    ...(status === undefined ? {} : { status }),
    ...(organizationId === undefined ? {} : { organizationId }),
    page: parsePage(params, "page", 1),
    pageSize: parsePage(params, "pageSize", 20),
  });
}
