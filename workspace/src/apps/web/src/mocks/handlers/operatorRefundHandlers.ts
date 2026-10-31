import { http, HttpResponse } from "msw";
import {
  refundFiltersSchema,
  cancellationMinutes,
  refundLevel,
  type RefundRequest,
} from "@/features/operator/refunds/refunds.schema";
const initial: RefundRequest[] = [
  {
    bookingCode: "BK-0905-018",
    customer: "Nguyễn Văn An",
    phone: "0901 234 567",
    bookedTickets: 3,
    seats: ["A01", "A02"],
    plate: "45B-204.12",
    vehicleType: "Giường 34 chỗ",
    tripCode: "BL-204",
    route: "TP.HCM → Đà Lạt",
    requestedAt: "2026-09-05T09:00:00+07:00",
    departureAt: "2026-09-07T11:00:00+07:00",
    status: "processing",
  },
  {
    bookingCode: "BK-0905-017",
    customer: "Trần Thu Hà",
    phone: "0935 661 820",
    bookedTickets: 2,
    seats: ["A02"],
    plate: "51B-208.36",
    vehicleType: "Giường 36 chỗ",
    tripCode: "BL-208",
    route: "TP.HCM → Nha Trang",
    requestedAt: "2026-09-05T10:30:00+07:00",
    departureAt: "2026-09-06T13:30:00+07:00",
    status: "completed",
  },
  {
    bookingCode: "BK-0905-015",
    customer: "Phạm Ngọc Mai",
    phone: "0917 842 336",
    bookedTickets: 4,
    seats: ["C01", "C02"],
    plate: "49B-214.08",
    vehicleType: "Ghế 29 VIP",
    tripCode: "BL-214",
    route: "Đà Lạt → TP.HCM",
    requestedAt: "2026-09-05T14:00:00+07:00",
    departureAt: "2026-09-05T23:15:00+07:00",
    status: "processing",
  },
  {
    bookingCode: "BK-0905-016",
    customer: "Lê Minh Khang",
    phone: "0988 210 445",
    bookedTickets: 2,
    seats: ["B01", "B02"],
    plate: "51B-218.52",
    vehicleType: "Giường 30 chỗ",
    tripCode: "BL-218",
    route: "Phan Thiết → TP.HCM",
    requestedAt: "2026-09-05T16:15:00+07:00",
    departureAt: "2026-09-05T18:30:00+07:00",
    status: "processing",
  },
  {
    bookingCode: "BK-0905-012",
    customer: "Bùi Khánh Linh",
    phone: "0905 742 921",
    bookedTickets: 3,
    seats: ["B08"],
    plate: "79B-225.40",
    vehicleType: "Giường 40 chỗ",
    tripCode: "BL-225",
    route: "Nha Trang → TP.HCM",
    requestedAt: "2026-09-05T18:45:00+07:00",
    departureAt: "2026-09-05T20:30:00+07:00",
    status: "exception",
  },
  {
    bookingCode: "BK-0905-013",
    customer: "Đỗ Minh Anh",
    phone: "0972 445 802",
    bookedTickets: 2,
    seats: ["D02"],
    plate: "72B-221.19",
    vehicleType: "Limousine 24",
    tripCode: "BL-221",
    route: "TP.HCM → Vũng Tàu",
    requestedAt: "2026-09-05T20:10:00+07:00",
    departureAt: "2026-09-06T08:00:00+07:00",
    status: "completed",
  },
];
const trackingCases: Record<
  string,
  {
    cancellationValue: number | null;
    refundReference: string | null;
    progressLayout?: "timeline";
  }
> = {
  "BK-0905-018": { cancellationValue: 640000, refundReference: "RF-0905-018" },
  "BK-0905-017": { cancellationValue: 260000, refundReference: "RF-0905-017" },
  "BK-0905-015": {
    cancellationValue: 225000,
    refundReference: "RF-0905-015",
    progressLayout: "timeline",
  },
  "BK-0905-016": {
    cancellationValue: 320000,
    refundReference: "RF-0905-016",
    progressLayout: "timeline",
  },
  "BK-0905-012": {
    cancellationValue: null,
    refundReference: null,
    progressLayout: "timeline",
  },
  "BK-0905-013": {
    cancellationValue: 130000,
    refundReference: "RF-0905-013",
    progressLayout: "timeline",
  },
};
const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s/g, "");
export const operatorRefundHandlers = [
  http.get(
    "/api/v1/operator/refund-requests-preview/:bookingCode",
    ({ params }) => {
      const item = initial.find((i) => i.bookingCode === params.bookingCode);
      if (!item)
        return HttpResponse.json(
          { message: "Không tìm thấy yêu cầu." },
          { status: 404 },
        );
      const tracking = trackingCases[item.bookingCode];
      return HttpResponse.json({
        ...item,
        cancelledTickets:
          item.status === "processing" || item.status === "completed"
            ? item.seats.length
            : 0,
        progressLayout: tracking?.progressLayout ?? "standard",
        cancellationValue: tracking?.cancellationValue ?? null,
        paymentMethod: tracking?.refundReference ? "VNPay" : null,
        refundReference: tracking?.refundReference ?? null,
      });
    },
  ),
  http.get("/api/v1/operator/refund-requests-preview", ({ request }) => {
    const parsed = refundFiltersSchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success)
      return HttpResponse.json(
        { message: "Bộ lọc không hợp lệ." },
        { status: 400 },
      );
    const f = parsed.data;
    const items = initial.filter(
      (item) =>
        (!f.date || item.requestedAt.slice(0, 10) === f.date) &&
        (f.status === "all" || item.status === f.status) &&
        (f.level === "all" ||
          refundLevel(
            cancellationMinutes(item.requestedAt, item.departureAt),
          ) === f.level) &&
        normalize(`${item.customer}${item.phone}${item.bookingCode}`).includes(
          normalize(f.search),
        ),
    );
    return HttpResponse.json({ items, total: items.length });
  }),
];
