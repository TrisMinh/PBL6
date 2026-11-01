import { useQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { Link } from "react-router";
import { z } from "zod";

import { useAccountSession } from "@/features/auth/hooks/useAccountSession";
import { apiJson } from "@/shared/api/client";
import { liveQueryKey } from "@/shared/api/liveRequest";

const assignmentSchema = z.object({
  tripId: z.string(),
  driverId: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  active: z.boolean(),
});
const responseSchema = z.union([
  z.array(assignmentSchema),
  z.object({ items: z.array(assignmentSchema) }).transform((v) => v.items),
]);

const time = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN");
};

/** GET /api/v1/driver/assignments. Shown only when the API returns data for the signed-in driver. */
export function LiveDriverAssignments(): ReactElement | null {
  const { session, isHydrated } = useAccountSession();
  const query = useQuery({
    queryKey: liveQueryKey("driver-assignments"),
    queryFn: ({ signal }) =>
      apiJson("/api/v1/driver/assignments", responseSchema, { signal }),
    enabled: isHydrated && Boolean(session),
    retry: false,
  });
  // Non-driver accounts are refused by the API; stay out of their way.
  if (!query.data || query.data.length === 0) return null;
  return (
    <section aria-label="Lịch chạy của tài xế" className="live-api">
      <h2>Lịch chạy của tôi</h2>
      <ul>
        {query.data.map((item) => (
          <li key={`${item.tripId}-${item.startAt}`}>
            <Link to={`/operator/bookings/trips/${encodeURIComponent(item.tripId)}/passengers`}>
              {time(item.startAt)} đến {time(item.endAt)}
            </Link>
            {item.active ? "" : " (đã kết thúc)"}
          </li>
        ))}
      </ul>
    </section>
  );
}
