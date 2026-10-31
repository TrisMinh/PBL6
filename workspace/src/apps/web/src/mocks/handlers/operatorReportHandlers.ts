import { http, HttpResponse } from "msw";
import {
  reportFiltersSchema,
  type OperatorReport,
  type ReportBooking,
} from "@/features/operator/reports/reports.schema";
const bookings: ReportBooking[] = [
  {
    id: "RP-001",
    name: "Nguyễn Minh Anh",
    route: "TP.HCM → Đà Lạt",
    departure: "2026-08-28",
    time: "07:30",
    vehicle: "Giường nằm",
    seats: "A1, A2",
  },
  {
    id: "RP-002",
    name: "Trần Gia Huy",
    route: "Đà Lạt → TP.HCM",
    departure: "2026-08-29",
    time: "13:00",
    vehicle: "Limousine",
    seats: "B4",
  },
  {
    id: "RP-003",
    name: "Lê Khánh An",
    route: "TP.HCM → Nha Trang",
    departure: "2026-08-30",
    time: "20:30",
    vehicle: "Giường nằm",
    seats: "C1, C2",
  },
  {
    id: "RP-004",
    name: "Phạm Minh Khang",
    route: "Nha Trang → TP.HCM",
    departure: "2026-08-31",
    time: "08:00",
    vehicle: "Ghế ngồi",
    seats: "D5",
  },
  {
    id: "RP-005",
    name: "Võ Thanh Hà",
    route: "TP.HCM → Đà Lạt",
    departure: "2026-08-31",
    time: "22:00",
    vehicle: "Limousine",
    seats: "A6",
  },
];
const vehicles: OperatorReport["vehicles"] = [
  {
    id: "A",
    name: "Xe A",
    plate: "45B-204.12",
    trip: "BL-204",
    route: "TP.HCM → Đà Lạt",
    status: "running",
    x: 86,
    y: 164,
  },
  {
    id: "B",
    name: "Xe B",
    plate: "51B-208.36",
    trip: "BL-208",
    route: "TP.HCM → Nha Trang",
    status: "running",
    x: 256,
    y: 112,
  },
  {
    id: "C",
    name: "Xe C",
    plate: "49B-214.08",
    trip: "BL-214",
    route: "Đà Lạt → TP.HCM",
    status: "running",
    x: 448,
    y: 76,
  },
  {
    id: "D",
    name: "Xe D",
    plate: "51B-230.10",
    trip: "Chưa phân công",
    route: "Bến xe",
    status: "parked",
    x: 490,
    y: 230,
  },
];
const daily = Array.from({ length: 31 }, (_, index) => ({
  date: `2026-08-${String(index + 1).padStart(2, "0")}`,
  revenue: index === 16 ? 82400000 : Math.floor((1820000000 - 82400000) / 30),
  costs: Math.floor(586000000 / 31) + (index === 30 ? 25 : 0),
  tickets: index === 16 ? 1032 : 155 + (index === 30 ? 2 : 0),
  customers: 158 + (index === 30 ? 23 : 0),
}));
export const operatorReportHandlers = [
  http.get("/api/v1/operator/reports-preview", ({ request }) => {
    const params = new URL(request.url).searchParams;
    const parsed = reportFiltersSchema.safeParse({
      from: params.get("from") ?? "2026-08-01",
      to: params.get("to") ?? "2026-08-31",
      period: params.get("period") ?? "month",
    });
    if (!parsed.success) return new HttpResponse(null, { status: 400 });
    const { from, to, period } = parsed.data;
    let start = from,
      end = to;
    if (period !== "month") {
      const week = Number(period.slice(-1)) - 1;
      start = new Date(Date.parse(from) + week * 7 * 86400000)
        .toISOString()
        .slice(0, 10);
      end =
        period === "week4"
          ? to
          : new Date(Math.min(Date.parse(to), Date.parse(start) + 6 * 86400000))
              .toISOString()
              .slice(0, 10);
    }
    const selected = daily.filter((d) => d.date >= start && d.date <= end);
    const referenceChart =
      from === "2026-08-01" && to === "2026-08-31" && period === "month";
    const series = referenceChart
      ? [1, 5, 8, 11, 14, 17, 20, 23, 26, 31].map((day) => daily[day - 1])
      : selected;
    const totals = selected.reduce(
      (sum, d) => ({
        revenue: sum.revenue + d.revenue,
        costs: sum.costs + d.costs,
        tickets: sum.tickets + d.tickets,
        customers: sum.customers + d.customers,
      }),
      { revenue: 0, costs: 0, tickets: 0, customers: 0 },
    );
    return HttpResponse.json({
      range: { from: start > to ? from : start, to: end < start ? to : end },
      totals,
      referenceChart,
      series,
      bookings: bookings.filter(
        (b) => b.departure >= start && b.departure <= end,
      ),
      vehicles,
    } satisfies OperatorReport);
  }),
];
