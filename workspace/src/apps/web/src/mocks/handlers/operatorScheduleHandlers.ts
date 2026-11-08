import type { TripDetail } from "@/features/operator/detail/detail.schema";
import { tripEditSchema } from "@/features/operator/detail/detail.schema";
import { http, HttpResponse } from "msw";
import type { ScheduleTrip } from "@/features/operator/schedule/schedule.schema";

// Isolated presentation fixtures: no mutations to Customer/Admin booking state.
const items: ScheduleTrip[] = [
  {
    id: "BL-204",
    origin: "TP.HCM",
    destination: "Đà Lạt",
    date: "2026-08-28",
    departure: "11:00",
    arrival: "17:30",
    vehicleLabel: "Giường nằm",
    crew: "Xe 45B-204.12 · Hoàng Nam",
    passengers: 12,
    capacity: 34,
    status: "boarding",
    assignment: "complete",
  },
  {
    id: "BL-208",
    origin: "TP.HCM",
    destination: "Nha Trang",
    date: "2026-08-28",
    departure: "13:30",
    arrival: "20:00",
    vehicleLabel: "Limousine",
    crew: "Xe 51B-208.36 · Minh Khang",
    passengers: 0,
    capacity: 22,
    status: "scheduled",
    assignment: "complete",
  },
  {
    id: "BL-211",
    origin: "TP.HCM",
    destination: "Đà Lạt",
    date: "2026-08-28",
    departure: "22:00",
    arrival: "04:30",
    vehicleLabel: "Giường nằm",
    crew: "Bản nháp đã lưu — 3 lỗi cần xử lý",
    passengers: 4,
    capacity: 34,
    status: "draft",
    assignment: "conflict",
  },
  {
    id: "BL-214",
    origin: "Đà Lạt",
    destination: "TP.HCM",
    date: "2026-08-28",
    departure: "23:15",
    arrival: "05:45",
    vehicleLabel: "Ghế ngồi",
    crew: "Xe 49B-214.08 · Quốc Bảo",
    passengers: 0,
    capacity: 34,
    status: "scheduled",
    assignment: "complete",
  },
  {
    id: "BL-218",
    origin: "Phan Thiết",
    destination: "TP.HCM",
    date: "2026-08-28",
    departure: "07:30",
    arrival: "14:00",
    vehicleLabel: "Limousine",
    crew: "Xe 51B-218.52 · Thuận Phát",
    passengers: 18,
    capacity: 34,
    status: "scheduled",
    assignment: "complete",
  },
  {
    id: "BL-220",
    origin: "TP.HCM",
    destination: "Đà Lạt",
    date: "2026-08-28",
    departure: "15:00",
    arrival: "21:30",
    vehicleLabel: "Limousine",
    crew: "Chưa phân công phương tiện",
    passengers: 0,
    capacity: 22,
    status: "draft",
    assignment: "missing",
  },
  {
    id: "BL-222",
    origin: "Nha Trang",
    destination: "TP.HCM",
    date: "2026-08-28",
    departure: "18:00",
    arrival: "00:30",
    vehicleLabel: "Giường nằm",
    crew: "Xe 79B-222.10 · Minh Khang",
    passengers: 8,
    capacity: 34,
    status: "scheduled",
    assignment: "complete",
  },
  {
    id: "BL-224",
    origin: "Đà Lạt",
    destination: "Phan Thiết",
    date: "2026-08-28",
    departure: "09:00",
    arrival: "13:00",
    vehicleLabel: "Ghế ngồi",
    crew: "Xe 49B-224.08 · Quốc Bảo",
    passengers: 4,
    capacity: 29,
    status: "boarding",
    assignment: "complete",
  },
];
export const operatorScheduleHandlers = [
  http.get(
    "/api/v1/operator/schedule-preview",
    () => HttpResponse.json({ items }),
  ),
];

const detailEdits = new Map<
  string,
  {
    vehicle: string;
    driver: string;
    assistant: string;
    pickup: string;
    dropoff: string;
    note: string;
  }
>();
function detailFor(id: string): TripDetail | null {
  const trip = items.find((item) => item.id === id);
  if (!trip) return null;
  if (!detailEdits.has(id) && typeof sessionStorage !== "undefined") {
    try {
      const raw = sessionStorage.getItem(`blue-operator-detail-${id}`);
      const parsed = raw ? tripEditSchema.safeParse(JSON.parse(raw)) : null;
      if (parsed?.success) {
        const d = parsed.data;
        detailEdits.set(id, d);
        Object.assign(trip, {
          origin: d.origin,
          destination: d.destination,
          date: d.date,
          departure: d.departure,
          crew: `Xe ${d.vehicle} · ${d.driver}`,
          assignment: "complete",
        });
      }
    } catch {
      /* Storage denial leaves the mock in memory. */
    }
  }
  const names = [
    "Nguyễn Văn An",
    "Trần Thu Hà",
    "Lê Minh Khang",
    "Phạm Ngọc Mai",
  ];
  const phones = [
    "0901 234 567",
    "0935 661 820",
    "0988 210 445",
    "0917 842 336",
  ];
  const seats = ["A1", "A2", "B4", "C1"];
  return {
    ...trip,
    vehicle:
      trip.assignment !== "complete"
        ? "Chưa phân công"
        : trip.crew.split(" · ")[0].replace("Xe ", ""),
    driver:
      trip.assignment !== "complete"
        ? "Chưa phân công"
        : (trip.crew.split(" · ")[1] ?? "Chưa phân công"),
    assistant: "Chưa phân công",
    pickup:
      trip.origin === "TP.HCM"
        ? "Bến xe Miền Đông mới"
        : `Bến xe ${trip.origin}`,
    dropoff:
      trip.destination === "Đà Lạt"
        ? "Trung tâm Đà Lạt\nBến xe Liên tỉnh Đà Lạt"
        : `Bến xe ${trip.destination}`,
    note: "",
    ...detailEdits.get(id),
    passengerList: Array.from({ length: trip.passengers }, (_, i) => ({
      name: names[i] ?? `Khách mô phỏng ${i + 1}`,
      phone: phones[i] ?? "0900 000 000",
      seat: seats[i] ?? `A${i + 1}`,
      pickup:
        i === 2 && trip.origin === "TP.HCM"
          ? "Ngã tư Thủ Đức"
          : trip.origin === "TP.HCM"
            ? "Bến xe Miền Đông mới"
            : `Bến xe ${trip.origin}`,
      confirmed: i === 0,
    })),
  };
}
operatorScheduleHandlers.push(
  http.get("/api/v1/operator/schedule-preview/:tripId", ({ params }) => {
    const detail = detailFor(String(params.tripId));
    return detail
      ? HttpResponse.json(detail)
      : new HttpResponse(null, { status: 404 });
  }),
  http.put(
    "/api/v1/operator/schedule-preview/:tripId",
    async ({ params, request }) => {
      const id = String(params.tripId);
      const trip = items.find((item) => item.id === id);
      if (!trip) return new HttpResponse(null, { status: 404 });
      try {
        const parsed = tripEditSchema.safeParse(await request.json());
        if (!parsed.success) return new HttpResponse(null, { status: 400 });
        const data = parsed.data;
        const minutes = (v: string): number =>
          Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
        const delta =
          (minutes(trip.arrival) - minutes(trip.departure) + 1440) % 1440;
        const arrival = (minutes(data.departure) + delta) % 1440;
        Object.assign(trip, {
          origin: data.origin,
          destination: data.destination,
          date: data.date,
          departure: data.departure,
          arrival: `${String(Math.floor(arrival / 60)).padStart(2, "0")}:${String(arrival % 60).padStart(2, "0")}`,
          crew: `Xe ${data.vehicle} · ${data.driver}`,
          assignment: "complete",
        });
        detailEdits.set(id, {
          vehicle: data.vehicle,
          driver: data.driver,
          assistant: data.assistant,
          pickup: data.pickup,
          dropoff: data.dropoff,
          note: data.note,
        });
        try {
          sessionStorage.setItem(
            `blue-operator-detail-${id}`,
            JSON.stringify(data),
          );
        } catch {
          /* Keep the successful in-memory edit. */
        }
        return HttpResponse.json(detailFor(id));
      } catch {
        return new HttpResponse(null, { status: 400 });
      }
    },
  ),
);
