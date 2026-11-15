import { locations } from "@/mocks/fixtures/locations";

const stationDisplay = {
  "loc-hcm": { provinceSlug: "ho-chi-minh", imageIndex: 0 },
  "loc-dalat": { provinceSlug: "lam-dong", imageIndex: 2 },
  "loc-danang": { provinceSlug: "da-nang", imageIndex: 1 },
  "loc-hanoi": { provinceSlug: "ha-noi", imageIndex: 3 },
} satisfies Record<
  (typeof locations)[number]["id"],
  { provinceSlug: string; imageIndex: number }
>;

export const exploreStations = locations.map((location) => ({
  ...location,
  ...stationDisplay[location.id],
}));
