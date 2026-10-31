import { apiFetch as fetch } from "@/shared/api/client";
import type { z } from "zod";
import {
  provinceDetailSchema,
  provinceListSchema,
  provinceSlugSchema,
  type ProvinceDetail,
  type ProvinceSummary,
} from "@/features/explore/explore.schema";

export class ExploreRepositoryError extends Error {
  readonly canRetry: boolean;
  constructor(
    readonly code:
      | "HTTP_ERROR"
      | "NETWORK_ERROR"
      | "INVALID_RESPONSE"
      | "INVALID_INPUT"
      | "ABORTED",
    readonly status = 0,
  ) {
    super("Không thể tải dữ liệu khám phá.");
    this.name = "ExploreRepositoryError";
    this.canRetry =
      code !== "ABORTED" &&
      code !== "INVALID_INPUT" &&
      (code !== "HTTP_ERROR" || status === 429 || status >= 500);
  }
}
async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { signal });
  } catch {
    throw new ExploreRepositoryError(
      signal?.aborted ? "ABORTED" : "NETWORK_ERROR",
    );
  }
  if (!response.ok)
    throw new ExploreRepositoryError("HTTP_ERROR", response.status);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ExploreRepositoryError("INVALID_RESPONSE", response.status);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new ExploreRepositoryError("INVALID_RESPONSE", response.status);
  return parsed.data;
}
export const exploreRepository = {
  list: async (signal?: AbortSignal): Promise<ProvinceSummary[]> =>
    (await request("/api/v1/explore/provinces", provinceListSchema, signal))
      .items,
  detail: async (
    slug: string,
    signal?: AbortSignal,
  ): Promise<ProvinceDetail> => {
    if (!provinceSlugSchema.safeParse(slug).success)
      throw new ExploreRepositoryError("INVALID_INPUT");
    const detail = await request(
      `/api/v1/explore/provinces/${encodeURIComponent(slug)}`,
      provinceDetailSchema,
      signal,
    );
    if (detail.slug !== slug)
      throw new ExploreRepositoryError("INVALID_RESPONSE", 200);
    return detail;
  },
};
