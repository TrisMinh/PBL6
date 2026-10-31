import { http, HttpResponse } from "msw";
import {
  bookingFiltersSchema,
  type OperatorBooking,
} from "@/features/operator/bookings/bookings.schema";
// Independent presentation fixtures; Customer/Admin bookings remain untouched.
const samples = [
  [
    "018",
    "Nguyễn Văn An",
    "BL-204",
    "TP.HCM",
    "Đà Lạt",
    "05",
    "11:00",
    "A1",
    450000,
    "confirmed",
  ],
  [
    "017",
    "Trần Thu Hà",
    "BL-208",
    "TP.HCM",
    "Nha Trang",
    "05",
    "13:30",
    "A2",
    520000,
    "pending",
  ],
  [
    "016",
    "Lê Minh Khang",
    "BL-218",
    "Phan Thiết",
    "TP.HCM",
    "05",
    "07:30",
    "B4",
    320000,
    "confirmed",
  ],
  [
    "015",
    "Phạm Ngọc Mai",
    "BL-214",
    "Đà Lạt",
    "TP.HCM",
    "05",
    "23:15",
    "C1",
    450000,
    "confirmed",
  ],
  [
    "014",
    "Võ Thành Đạt",
    "BL-204",
    "TP.HCM",
    "Đà Lạt",
    "05",
    "11:00",
    "A5",
    450000,
    "pending",
  ],
  [
    "013",
    "Đỗ Minh Anh",
    "BL-221",
    "TP.HCM",
    "Vũng Tàu",
    "06",
    "08:00",
    "D2",
    260000,
    "confirmed",
  ],
  [
    "012",
    "Bùi Khánh Linh",
    "BL-225",
    "Nha Trang",
    "TP.HCM",
    "06",
    "20:30",
    "B8",
    520000,
    "cancelled",
  ],
  [
    "011",
    "Hoàng Quốc Bảo",
    "BL-208",
    "TP.HCM",
    "Nha Trang",
    "05",
    "13:30",
    "A6",
    520000,
    "confirmed",
  ],
  [
    "010",
    "Ngô Lan Chi",
    "BL-214",
    "Đà Lạt",
    "TP.HCM",
    "05",
    "23:15",
    "C4",
    450000,
    "confirmed",
  ],
] as const;
const items: OperatorBooking[] = Array.from({ length: 1056 }, (_, index) => {
  const s = samples[index % samples.length];
  return {
    id:
      index < 9
        ? `BK-260905-${s[0]}`
        : `BK-MOCK-${String(index + 1).padStart(5, "0")}`,
    name: s[1],
    phone: `090${String(1000000 + index).padStart(7, "0")}`,
    tripId: s[2],
    origin: s[3],
    destination: s[4],
    departureDate: `2026-09-${s[5]}`,
    departureTime: s[6],
    createdDate: new Date(Date.UTC(2026, 8, 5 - Math.floor(index / 120)))
      .toISOString()
      .slice(0, 10),
    seat: s[7],
    amount: s[8],
    status: s[9],
    payment: s[9] === "pending" ? "unpaid" : "paid",
  };
});
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
