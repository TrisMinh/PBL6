import { z } from "zod";
const local = z.iso.datetime({ local: true, precision: -1 });
export function suggestedArrival(
  departure: string,
  minutes?: number | null,
): string {
  if (!local.safeParse(departure).success || !minutes || minutes <= 0)
    return "";
  const timestamp = Date.parse(departure + ":00+07:00");
  return new Date(timestamp + minutes * 60_000 + 7 * 3600_000)
    .toISOString()
    .slice(0, 16);
}
export function durationLabel(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "Chưa xác định";
  const total = Math.round(minutes),
    days = Math.floor(total / 1440),
    hours = Math.floor((total % 1440) / 60),
    remainder = total % 60;
  return [
    days ? `${days} ngày` : "",
    hours ? `${hours} giờ` : "",
    remainder ? `${remainder} phút` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
export function timingError(
  departure: string,
  arrival: string,
  future: boolean,
  now = Date.now(),
): string {
  if (!local.safeParse(departure).success || !local.safeParse(arrival).success)
    return "Nhập đầy đủ ngày, giờ và phút hợp lệ cho giờ đi và giờ đến.";
  const start = Date.parse(departure + ":00+07:00"),
    end = Date.parse(arrival + ":00+07:00");
  if (end <= start)
    return "Giờ đến phải sau giờ khởi hành. Chuyến qua đêm cần chọn ngày đến kế tiếp.";
  if (future && start <= now)
    return "Giờ khởi hành đã qua. Vui lòng chọn thời điểm trong tương lai.";
  return "";
}

/** Suggest a future Vietnam departure only when the operator has not entered one. */
export function routeTiming(
  times: { departureAt: string; arrivalAt: string },
  minutes: number | null | undefined,
  manual: { departure: boolean; arrival: boolean },
  now = Date.now(),
): { departureAt: string; arrivalAt: string } {
  let departureAt = times.departureAt;
  if (!departureAt && !manual.departure)
    departureAt = new Date(
      (Math.floor(now / 3600_000) + 1) * 3600_000 + 7 * 3600_000,
    )
      .toISOString()
      .slice(0, 16);
  return {
    departureAt,
    arrivalAt: manual.arrival
      ? times.arrivalAt
      : suggestedArrival(departureAt, minutes),
  };
}
