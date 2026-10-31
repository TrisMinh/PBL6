import { http, HttpResponse } from "msw";
import {
  tripListFiltersSchema,
  type PassengerTrip,
} from "@/features/operator/bookings/tripLists.schema";
// September presentation fixtures are independent of August schedule and Customer/Admin data.
const trips: PassengerTrip[] = [
  {
    id: "BL-204",
    origin: "TP.HCM",
    destination: "Đà Lạt",
    date: "2026-09-05",
    departure: "11:00",
    arrival: "17:30",
    vehicle: "45B-204.12",
    booked: 12,
    capacity: 34,
    checkedIn: 0,
    status: "boarding",
  },
  {
    id: "BL-208",
    origin: "TP.HCM",
    destination: "Nha Trang",
    date: "2026-09-05",
    departure: "13:30",
    arrival: "20:00",
    vehicle: "51B-208.36",
    booked: 22,
    capacity: 22,
    checkedIn: 0,
    status: "scheduled",
  },
  {
    id: "BL-211",
    origin: "TP.HCM",
    destination: "Đà Lạt",
    date: "2026-09-05",
    departure: "22:00",
    arrival: "04:30",
    vehicle: "Chưa phân công",
    booked: 0,
    capacity: 34,
    checkedIn: 0,
    status: "conflict",
  },
  {
    id: "BL-214",
    origin: "Đà Lạt",
    destination: "TP.HCM",
    date: "2026-09-05",
    departure: "23:15",
    arrival: "05:45",
    vehicle: "49B-214.08",
    booked: 18,
    capacity: 34,
    checkedIn: 0,
    status: "scheduled",
  },
  {
    id: "BL-218",
    origin: "Phan Thiết",
    destination: "TP.HCM",
    date: "2026-09-06",
    departure: "07:30",
    arrival: "14:00",
    vehicle: "51B-218.52",
    booked: 26,
    capacity: 34,
    checkedIn: 0,
    status: "scheduled",
  },
  {
    id: "BL-221",
    origin: "TP.HCM",
    destination: "Vũng Tàu",
    date: "2026-09-06",
    departure: "08:00",
    arrival: "11:15",
    vehicle: "72B-221.19",
    booked: 16,
    capacity: 28,
    checkedIn: 0,
    status: "scheduled",
  },
  {
    id: "BL-225",
    origin: "Nha Trang",
    destination: "TP.HCM",
    date: "2026-09-06",
    departure: "20:30",
    arrival: "03:00",
    vehicle: "79B-225.40",
    booked: 31,
    capacity: 34,
    checkedIn: 0,
    status: "departing",
  },
  {
    id: "BL-229",
    origin: "TP.HCM",
    destination: "Đà Lạt",
    date: "2026-09-07",
    departure: "06:00",
    arrival: "12:30",
    vehicle: "45B-229.72",
    booked: 9,
    capacity: 34,
    checkedIn: 0,
    status: "scheduled",
  },
];
const routeLabel = (trip: PassengerTrip): string =>
  `${trip.origin} → ${trip.destination}`;
const normalize = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
export const operatorTripListHandlers = [
  http.get("/api/v1/operator/passenger-trips", ({ request }) => {
    const parsed = tripListFiltersSchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success) return new HttpResponse(null, { status: 400 });
    const f = parsed.data;
    return HttpResponse.json({
      items: trips.filter(
        (trip) =>
          trip.date >= f.date &&
          (f.route === "all" || routeLabel(trip) === f.route) &&
          (f.status === "all" || trip.status === f.status) &&
          normalize(`${trip.id} ${routeLabel(trip)}`).includes(
            normalize(f.search.trim()),
          ),
      ),
      routes: [...new Set(trips.map(routeLabel))],
    });
  }),
  http.get("/api/v1/operator/passenger-trips/:id/passengers", ({ params }) => {
    const trip = trips.find((item) => item.id === params.id);
    if (!trip) return new HttpResponse(null, { status: 404 });
    const sample = [
      [
        "A1",
        "Nguyễn Văn An",
        "0901 234 567",
        "Bến xe Miền Đông mới",
        "paid",
        "confirmed",
      ],
      [
        "A2",
        "Trần Thu Hà",
        "0935 661 820",
        "Bến xe Miền Đông mới",
        "paid",
        "waiting",
      ],
      [
        "A5",
        "Võ Thành Đạt",
        "0908 245 117",
        "Bến xe Miền Đông mới",
        "unpaid",
        "waiting",
      ],
      [
        "B1",
        "Đỗ Minh Anh",
        "0972 445 802",
        "Ngã tư Thủ Đức",
        "paid",
        "waiting",
      ],
      [
        "B2",
        "Hoàng Quốc Bảo",
        "0913 886 521",
        "Ngã tư Thủ Đức",
        "paid",
        "waiting",
      ],
      [
        "B4",
        "Lê Minh Khang",
        "0988 210 445",
        "Bến xe Miền Đông mới",
        "paid",
        "waiting",
      ],
      [
        "C1",
        "Phạm Ngọc Mai",
        "0917 842 336",
        "Bến xe Miền Đông mới",
        "paid",
        "waiting",
      ],
      [
        "C3",
        "Ngô Lan Chi",
        "0966 183 254",
        "Ngã tư Thủ Đức",
        "paid",
        "waiting",
      ],
      [
        "D2",
        "Bùi Khánh Linh",
        "0905 742 921",
        "Bến xe Miền Đông mới",
        "paid",
        "waiting",
      ],
    ];
    return HttpResponse.json({
      trip: {
        ...trip,
        driver: trip.id === "BL-204" ? "Hoàng Nam" : "Chưa phân công",
      },
      passengers: Array.from({ length: trip.booked }, (_, i) => {
        const s = sample[i];
        const isSample = trip.id === "BL-204" && !!s;
        const seat =
          trip.id === "BL-204"
            ? (s?.[0] ?? ["A6", "C4", "D3"][i - 9])
            : String.fromCharCode(65 + Math.floor(i / 9)) + ((i % 9) + 1);
        return {
          name: isSample ? s[1] : (s?.[1] ?? "Hành khách mẫu " + (i + 1)),
          phone: isSample ? s[2] : "090" + String(1000000 + i).padStart(7, "0"),
          seat,
          ticketCode: "VE-" + trip.id.replace("BL-", "") + "-" + seat,
          pickup: isSample
            ? s[3]
            : trip.origin === "TP.HCM"
              ? "Bến xe Miền Đông mới"
              : "Bến xe " + trip.origin,
          payment: isSample ? s[4] : "paid",
          boardingStatus: isSample ? s[5] : "waiting",
          confirmed: false,
        };
      }),
    });
  }),
];
