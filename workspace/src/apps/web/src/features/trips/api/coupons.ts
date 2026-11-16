import { z } from "zod";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiJson } from "@/shared/api/client";
import { isMockApi } from "@/shared/api/config";
export const couponSchema = z.object({
  code: z.string(),
  percent: z.number().int().min(1).max(90),
  cap: z.number().int().positive(),
  minimum: z.number().int().nonnegative(),
  organizationId: z.string().nullish(),
  startsAt: z.string(),
  expiresAt: z.string(),
  active: z.boolean(),
});
export const couponQuoteSchema = z.object({
  code: z.string(),
  subtotal: z.number().int().nonnegative(),
  discount: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  currency: z.literal("VND"),
  expiresAt: z.string(),
});
export type CouponQuote = z.infer<typeof couponQuoteSchema>;
export function useTripCoupons(
  tripId: string,
): UseQueryResult<z.infer<typeof couponSchema>[]> {
  return useQuery({
    queryKey: ["trip-coupons", tripId],
    queryFn: ({ signal }) =>
      apiJson(
        `/api/v1/trips/${encodeURIComponent(tripId)}/coupons`,
        z.array(couponSchema),
        { signal },
      ),
    enabled: !isMockApi,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
