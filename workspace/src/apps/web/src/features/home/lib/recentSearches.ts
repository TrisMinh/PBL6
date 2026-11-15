import { z } from "zod";
import { tripSearchSchema } from "@/features/trips/schemas/search.schema";
import type { TripSearch } from "@/features/trips/types/trip";
import { ROUTES } from "@/shared/config/routes";

export const RECENT_SEARCHES_KEY = "blue-recent-searches";
export const RECENT_SEARCHES_EVENT = "blue:recent-searches";
const entrySchema = z.object({
  search: tripSearchSchema,
  originLabel: z.string().min(1).max(100),
  destinationLabel: z.string().min(1).max(100),
});
export type RecentSearch = z.infer<typeof entrySchema>;
export function homeSearchPath(search: TripSearch): string {
  return (
    ROUTES.trips +
    "?" +
    new URLSearchParams({
      originId: search.originId,
      destinationId: search.destinationId,
      departureDate: search.departureDate,
      passengerCount: String(search.passengerCount),
    })
  );
}
export function readRecentSearches(): RecentSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw: unknown = JSON.parse(
      localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]",
    );
    if (!Array.isArray(raw)) return [];
    return raw
      .slice(0, 20)
      .flatMap((item) => {
        const parsed = entrySchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      })
      .slice(0, 4);
  } catch {
    return [];
  }
}
function write(items: RecentSearch[]): void {
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(items));
  } catch {
    /* Searching remains usable when browser storage is unavailable. */
  }
  window.dispatchEvent(new Event(RECENT_SEARCHES_EVENT));
}
export function rememberSearch(entry: RecentSearch): void {
  const parsed = entrySchema.safeParse(entry);
  if (!parsed.success || typeof window === "undefined") return;
  const key = homeSearchPath(parsed.data.search);
  write(
    [
      parsed.data,
      ...readRecentSearches().filter(
        (item) => homeSearchPath(item.search) !== key,
      ),
    ].slice(0, 4),
  );
}
export function removeRecentSearch(key?: string): void {
  write(
    key
      ? readRecentSearches().filter(
          (item) => homeSearchPath(item.search) !== key,
        )
      : [],
  );
}
