import type { Artwork } from "./ExploreImage";
import { getVietnamTodayDate } from "@/shared/lib/getVietnamTodayDate";

export function catalogueArtwork(destination: string): Artwork {
  if (/Đà Lạt|Lâm Đồng/.test(destination)) return ["travel", 0];
  if (/Đà Nẵng/.test(destination)) return ["travel", 1];
  if (/Hà Nội/.test(destination)) return ["travel", 3];
  return ["extra", 0];
}
export function nextCatalogueDate(): string {
  const today = new Date(`${getVietnamTodayDate()}T12:00:00+07:00`);
  today.setTime(today.getTime() + 86_400_000);
  return today.toISOString().slice(0, 10);
}
export function catalogueSearchPath(
  origin: string,
  destination: string,
): string {
  return `/trips?${new URLSearchParams({ originId: origin, destinationId: destination, departureDate: nextCatalogueDate(), passengerCount: "1" })}`;
}
