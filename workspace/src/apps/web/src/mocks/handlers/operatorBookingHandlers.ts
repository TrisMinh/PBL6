import { http, HttpResponse } from "msw";
import { bookingFiltersSchema } from "@/features/operator/bookings/bookings.schema";
import { operatorBookingFixtures as items } from "@/mocks/fixtures/operatorBookings";
const normalize = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
export const operatorBookingHandlers = [
  http.get("/api/v1/operator/bookings-preview", ({ request }) => {
    const parsed = bookingFiltersSchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success || parsed.data.from > parsed.data.to)
      return new HttpResponse(null, { status: 400 });
    const f = parsed.data;
    const filtered = items.filter(
      (item) =>
        item.createdDate >= f.from &&
        item.createdDate <= f.to &&
        (f.status === "all" || item.status === f.status) &&
        (f.payment === "all" || item.payment === f.payment) &&
        normalize(`${item.id} ${item.name} ${item.phone}`).includes(
          normalize(f.search.trim()),
        ),
    );
    const pageSize = 9,
      page = Math.min(
        f.page,
        Math.max(1, Math.ceil(filtered.length / pageSize)),
      );
    return HttpResponse.json({
      items: filtered.slice((page - 1) * pageSize, page * pageSize),
      total: filtered.length,
      page,
      pageSize,
    });
  }),
];
