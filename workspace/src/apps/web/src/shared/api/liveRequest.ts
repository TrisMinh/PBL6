import { z } from "zod";
import { apiJson } from "./client";
import { isMockApi } from "./config";
import { readApiSession } from "./session";
import { ApiError } from "./error";
import type { ApiRow } from "./fields";

export function liveQueryKey(...parts: unknown[]): readonly unknown[] {
  const session = readApiSession();
  return ["live-api", session?.user.id, session?.sessionId, ...parts];
}

/** Keep the same key after an ambiguous response, including across a page reload.
 * Store only a digest and a UUID, never the request body or credentials. */
export async function liveApiJson<T>(
  path: string,
  schema: { parse(value: unknown): T },
  options: NonNullable<Parameters<typeof apiJson>[2]> & { idempotent?: boolean } = {},
): Promise<T> {
  const { idempotent, ...request } = options;
  if (!idempotent || isMockApi) return apiJson(path, schema, request);
  const session = readApiSession();
  const fingerprint = JSON.stringify([session?.user.id, request.method, path, request.body]);
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprint));
  const digest = Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, "0")).join("");
  const storageKey = `blue-live-request:${digest}`;
  let key: string;
  try {
    key = sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
    sessionStorage.setItem(storageKey, key);
  } catch {
    throw new ApiError("STORAGE_UNAVAILABLE", 0, "Không lưu được mã yêu cầu. Vui lòng cho phép lưu trữ rồi thử lại.");
  }
  const result = await apiJson(path, schema, { ...request, idempotencyKey: key });
  try { sessionStorage.removeItem(storageKey); } catch { /* Replay remains safe. */ }
  return result;
}

const record = z.record(z.string(), z.unknown());
const collection = z.union([z.array(record), z.object({ items: z.array(record), totalPages: z.number().optional() })]);
export async function getLiveRows(path: string, signal?: AbortSignal): Promise<ApiRow[]> {
  const url = new URL(path, "https://relative.invalid");
  const items: ApiRow[] = [];
  for (let page = 0;; page++) {
    url.searchParams.set("page", String(page));
    url.searchParams.set("size", "100");
    const result = await apiJson(`${url.pathname}${url.search}`, collection, { signal });
    if (Array.isArray(result)) return result;
    items.push(...result.items);
    if (page + 1 >= (result.totalPages ?? 1)) return items;
  }
}
