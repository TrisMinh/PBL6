import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { z } from "zod";
import { apiJson } from "./client";
import { ApiError } from "./error";
import { readApiSession } from "./session";
import type { ApiRow } from "./fields";

export const apiRecordSchema = z.record(z.string(), z.unknown());
const collectionSchema = z.union([
  z.array(apiRecordSchema),
  z.object({
    items: z.array(apiRecordSchema),
    totalPages: z.number().optional(),
  }),
]);
export async function loadRows(
  endpoint: string,
  signal?: AbortSignal,
): Promise<ApiRow[]> {
  const items: ApiRow[] = [];
  let page = 0;
  for (;;) {
    const result = await apiJson(
      `${endpoint}${endpoint.includes("?") ? "&" : "?"}page=${page}&size=100`,
      collectionSchema,
      { signal },
    );
    if (Array.isArray(result)) return result;
    items.push(...result.items);
    if (++page >= (result.totalPages ?? 1)) return items;
  }
}
export function useApiRows(
  endpoint: string,
  enabled = true,
): UseQueryResult<ApiRow[], Error> {
  return useQuery({
    queryKey: ["live-api", readApiSession()?.user.id, "rows", endpoint],
    queryFn: ({ signal }) => loadRows(endpoint, signal),
    enabled,
    retry: false,
  });
}
export function useApiRecord(
  endpoint: string,
  enabled = true,
): UseQueryResult<ApiRow, Error> {
  return useQuery({
    queryKey: ["live-api", readApiSession()?.user.id, "record", endpoint],
    queryFn: ({ signal }) => apiJson(endpoint, apiRecordSchema, { signal }),
    enabled,
    retry: false,
  });
}

export function requiredId(value: unknown, label: string): string {
  const result = z.string().uuid().safeParse(value);
  if (!result.success)
    throw new ApiError("VALIDATION_ERROR", 400, `${label} không hợp lệ.`);
  return result.data;
}
export const csv = (value: unknown): string[] =>
  String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
export const versionOf = (row?: ApiRow): number =>
  Number(row?.rowVersion ?? row?.expectedVersion ?? 0);
