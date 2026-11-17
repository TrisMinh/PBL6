import { isMockApi } from "@/shared/api/config";

export function operatorDefaultRange(
  kind: "bookings" | "reports" | "settlements",
): { from: string; to: string } {
  if (isMockApi) {
    if (kind === "bookings") return { from: "2026-08-28", to: "2026-09-05" };
    if (kind === "settlements") return { from: "2026-09-01", to: "2026-09-30" };
    return { from: "2026-08-01", to: "2026-08-31" };
  }
  if (kind !== "reports") return { from: "", to: "" };
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return { from: `${today.slice(0, 7)}-01`, to: today };
}
