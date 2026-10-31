import { http, HttpResponse } from "msw";

import { locations } from "@/mocks/fixtures/locations";

export const locationHandlers = [
  http.get("/api/v1/locations", () => HttpResponse.json({ items: locations })),
];
