import { z } from "zod";
import {
  reviewDraftSchema,
  publishRequestSchema,
  type ReviewDraft,
  type ReviewResult,
} from "@/features/operator/review/review.schema";
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
    () => (hydratePublished(), HttpResponse.json({ items })),
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
  hydratePublished();
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

const publishReceiptSchema = z
  .object({
    requestId: z.uuid(),
    draft: reviewDraftSchema,
    id: z.string().regex(/^OP-[A-F0-9-]+$/),
  })
  .strict();
const publishReceipts = new Map<string, z.infer<typeof publishReceiptSchema>>();
function applyPublished(draft: ReviewDraft, id: string): void {
  if (items.some((item) => item.id === id)) return;
  const start =
    Number(draft.time.slice(0, 2)) * 60 + Number(draft.time.slice(3));
  const end = Math.round(start + draft.duration * 60) % 1440;
  items.push({
    id,
    origin: draft.origin,
    destination: draft.destination,
    date: draft.date,
    departure: draft.time,
    arrival: `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`,
    vehicleLabel: draft.vehicle === "51B-208.36" ? "Limousine" : "Giường nằm",
    crew: `Xe ${draft.vehicle} · ${draft.driver.split(" — ")[0]}`,
    passengers: 0,
    capacity: draft.vehicle === "51B-208.36" ? 22 : 34,
    status: "scheduled",
    assignment: "complete",
  });
  detailEdits.set(id, {
    vehicle: draft.vehicle,
    driver: draft.driver,
    assistant: draft.assistant,
    pickup: draft.pickup,
    dropoff: draft.dropoff,
    note: "",
  });
}
function hydratePublished(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const raw = sessionStorage.getItem("blue-operator-published-v1");
    if (!raw || raw.length > 100000) return;
    const parsed = z
      .array(publishReceiptSchema)
      .max(50)
      .safeParse(JSON.parse(raw));
    if (!parsed.success) return;
    for (const receipt of parsed.data) {
      if (!publishReceipts.has(receipt.requestId)) {
        publishReceipts.set(receipt.requestId, receipt);
        applyPublished(receipt.draft, receipt.id);
      }
    }
  } catch {
    /* Keep mock runtime usable if storage is denied. */
  }
}
function checkOperatorDraft(draft: ReviewDraft): ReviewResult {
  hydratePublished();
  const vehicles = ["45B-204.12", "51B-208.36", "51B-219.34"];
  const drivers = ["Hoàng Nam", "Minh Khang", "Quang Huy"];
  const issues: string[] = [];
  const conflicts: ReviewResult["conflicts"] = [];
  const formatDate = (value: string): string =>
    value.split("-").reverse().join("/");
  const formatInstant = (value: number): string =>
    new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      dateStyle: "short",
      timeStyle: "short",
      hour12: false,
    }).format(new Date(value));
  const driver = draft.driver.split(" — ")[0];
  if (!vehicles.includes(draft.vehicle))
    issues.push("Phương tiện chưa được phân công hoặc không hoạt động.");
  if (!drivers.includes(driver))
    issues.push("Tài xế chưa được phân công hoặc không hoạt động.");
  // Canonical conflict case: Hoang Nam licence expired on 2026-08-20.
  const licenceExpiry = driver === "Hoàng Nam" ? "2026-08-20" : "2030-12-31";
  if (draft.date > licenceExpiry)
    issues.push(
      `GPLX hết hạn ngày ${licenceExpiry.split("-").reverse().join("/")}.`,
    );
  const start = Date.parse(`${draft.date}T${draft.time}:00+07:00`),
    end = start + draft.duration * 3600000,
    buffer = 30 * 60000;
  for (const trip of items) {
    if (trip.status === "draft") continue;
    const tripStart = Date.parse(`${trip.date}T${trip.departure}:00+07:00`);
    let tripEnd = Date.parse(`${trip.date}T${trip.arrival}:00+07:00`);
    if (tripEnd <= tripStart) tripEnd += 86400000;
    if (start < tripEnd + buffer && end + buffer > tripStart) {
      if (trip.crew.includes(draft.vehicle))
        conflicts.push({
          title: "Xe bị trùng lịch",
          description:
            draft.vehicle + " đang được phân công cho chuyến " + trip.id + ".",
          detail:
            "Thời gian sử dụng: " +
            formatInstant(tripStart) +
            " đến " +
            formatInstant(tripEnd) +
            ". Có tính khoảng đệm 30 phút.",
        });
      if (trip.crew.includes(driver))
        conflicts.push({
          title: "Tài xế bị trùng lịch",
          description: driver + " đang phụ trách chuyến " + trip.id + ".",
          detail:
            "Thời gian phân công: " +
            formatInstant(tripStart) +
            " đến " +
            formatInstant(tripEnd) +
            ". Có tính khoảng đệm 30 phút.",
        });
      if (trip.crew.includes(draft.vehicle))
        issues.push(`Xe trùng lịch chuyến ${trip.id}.`);
      if (trip.crew.includes(driver))
        issues.push(`Tài xế trùng lịch chuyến ${trip.id}.`);
    }
  }
  if (draft.date > licenceExpiry)
    conflicts.push({
      title: "Giấy phép lái xe hết hạn",
      description:
        "GPLX của " +
        driver +
        " đã hết hạn ngày " +
        formatDate(licenceExpiry) +
        ".",
      detail:
        "Không đủ điều kiện cho chuyến ngày " + formatDate(draft.date) + ".",
    });
  if (!vehicles.includes(draft.vehicle))
    conflicts.push({
      title: "Phương tiện chưa hợp lệ",
      description: "Phương tiện chưa được phân công hoặc không hoạt động.",
      detail: "Chọn phương tiện đang hoạt động và kiểm tra lại.",
    });
  if (!drivers.includes(driver))
    conflicts.push({
      title: "Tài xế chưa hợp lệ",
      description: "Tài xế chưa được phân công hoặc không hoạt động.",
      detail: "Chọn tài xế đang hoạt động và kiểm tra lại.",
    });
  return {
    conflicts,
    eligible: issues.length === 0,
    issues,
    capacity: draft.vehicle === "51B-208.36" ? 22 : 34,
    vehicleType: draft.vehicle === "51B-208.36" ? "Limousine" : "Giường nằm",
  };
}
operatorScheduleHandlers.push(
  http.post("/api/v1/operator/trip-review", async ({ request }) => {
    try {
      const parsed = reviewDraftSchema.safeParse(await request.json());
      if (!parsed.success) return new HttpResponse(null, { status: 400 });
      return HttpResponse.json(checkOperatorDraft(parsed.data));
    } catch {
      return new HttpResponse(null, { status: 400 });
    }
  }),
  http.post("/api/v1/operator/trip-publish", async ({ request }) => {
    try {
      const parsed = publishRequestSchema.safeParse(await request.json());
      if (!parsed.success) return new HttpResponse(null, { status: 400 });
      hydratePublished();
      const { requestId, draft } = parsed.data;
      const existing = publishReceipts.get(requestId);
      if (existing) {
        if (JSON.stringify(existing.draft) !== JSON.stringify(draft))
          return new HttpResponse(null, { status: 409 });
        return HttpResponse.json({ id: existing.id, status: "scheduled" });
      }
      if (publishReceipts.size >= 50)
        return new HttpResponse(null, { status: 503 });
      const result = checkOperatorDraft(draft);
      if (!result.eligible) return new HttpResponse(null, { status: 409 });
      const id = `OP-${requestId.slice(0, 8).toUpperCase()}`;
      applyPublished(draft, id);
      publishReceipts.set(requestId, { requestId, draft, id });
      try {
        sessionStorage.setItem(
          "blue-operator-published-v1",
          JSON.stringify([...publishReceipts.values()]),
        );
      } catch {
        /* Keep in-memory publication. */
      }
      return HttpResponse.json({ id, status: "scheduled" }, { status: 201 });
    } catch {
      return new HttpResponse(null, { status: 400 });
    }
  }),
);
