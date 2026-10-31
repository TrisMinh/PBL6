import { http, HttpResponse } from "msw";
import { z } from "zod";
import {
  updateDriverSchema,
  driverSchema,
  createDriverSchema,
  driversSchema,
  type OperatorDriver,
} from "@/features/operator/drivers/drivers.schema";

const names = [
  "Nguyễn Minh Khang",
  "Trần Quốc Bảo",
  "Lê Hoàng Tùng",
  "Phạm Tuấn Anh",
  "Đỗ Văn Hưng",
  "Võ Đức Minh",
];
const phones = [
  "0901234567",
  "0902345678",
  "0903456789",
  "0904567890",
  "0905678901",
  "0906789012",
];
const emails = [
  "minhkhang",
  "quocbao",
  "hoangtung",
  "tuananh",
  "vanhung",
  "ducminh",
];
const initial: OperatorDriver[] = names.map((name, i) => ({
  id: `TX-00${i + 1}`,
  name,
  phone: phones[i] ?? "0901234567",
  email: `${emails[i]}@example.com`,
  birthDate: i === 0 ? "1988-05-18" : `1990-0${i + 1}-18`,
  address: "Thủ Đức, TP. Hồ Chí Minh",
  licenseNumber: String(790123456789 + i),
  licenseClass: "D",
  issuedAt: "2023-08-20",
  expiresAt: "2028-08-20",
  joinedAt: "2024-03-12",
  status: i === 1 || i === 4 ? "running" : i === 3 ? "paused" : "available",
}));
const KEY = "blue-operator-drivers-v1";
let memory = structuredClone(initial);
function read(): OperatorDriver[] {
  if (typeof sessionStorage === "undefined") return memory;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return structuredClone(initial);
    const parsed = driversSchema.safeParse(JSON.parse(raw));
    if (
      parsed.success &&
      new Set(parsed.data.map((d) => d.id)).size === parsed.data.length
    )
      return parsed.data;
  } catch {
    /* Invalid cached mock data falls back to fixtures. */
  }
  return structuredClone(initial);
}
function commit(next: OperatorDriver[]): void {
  if (typeof sessionStorage !== "undefined")
    sessionStorage.setItem(KEY, JSON.stringify(next));
  memory = next;
}
const error = (message: string, status: number): Response =>
  HttpResponse.json({ message }, { status });
const endpoint = "/api/v1/operator/drivers-preview";
async function save(request: Request, id?: string): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return error("Dữ liệu không hợp lệ.", 400);
  }
  const parsed = (id ? updateDriverSchema : createDriverSchema).safeParse(
    payload,
  );
  if (!parsed.success)
    return error(
      parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.",
      400,
    );
  const drivers = read();
  const existing = drivers.find((d) => d.id === id);
  if (id && !existing) return error("Không tìm thấy tài xế.", 404);
  if (
    drivers.some(
      (d) =>
        d.id !== id &&
        (d.phone === parsed.data.phone ||
          d.licenseNumber === parsed.data.licenseNumber),
    )
  )
    return error("Số điện thoại hoặc số GPLX đã thuộc về tài xế khác.", 409);
  if (!id && drivers.length >= 500)
    return error("Danh sách mock đã đạt giới hạn 500 tài xế.", 409);
  if (
    existing?.status === "running" &&
    "status" in parsed.data &&
    parsed.data.status &&
    parsed.data.status !== "running"
  )
    return error("Tài xế đang chạy chuyến, chưa thể đổi trạng thái.", 409);
  if (
    existing?.status !== "running" &&
    "status" in parsed.data &&
    parsed.data.status === "running"
  )
    return error(
      "Trạng thái Đang chạy chỉ được cập nhật khi phân công chuyến.",
      400,
    );
  const next = driverSchema.parse({
    ...existing,
    ...parsed.data,
    id:
      id ??
      `TX-${String(Math.max(0, ...drivers.map((d) => Number(d.id.slice(3)))) + 1).padStart(3, "0")}`,
    joinedAt: existing?.joinedAt ?? new Date().toISOString().slice(0, 10),
    status:
      ("status" in parsed.data ? parsed.data.status : undefined) ??
      existing?.status ??
      "available",
    avatar:
      parsed.data.avatar === null
        ? undefined
        : (parsed.data.avatar ?? existing?.avatar),
    licenseFront:
      parsed.data.licenseFront === null
        ? undefined
        : (parsed.data.licenseFront ?? existing?.licenseFront),
    licenseBack:
      parsed.data.licenseBack === null
        ? undefined
        : (parsed.data.licenseBack ?? existing?.licenseBack),
  });
  try {
    commit(
      existing
        ? drivers.map((d) => (d.id === id ? next : d))
        : [...drivers, next],
    );
  } catch {
    return error("Không lưu được dữ liệu phiên. Vui lòng thử lại.", 503);
  }
  return HttpResponse.json(next, { status: existing ? 200 : 201 });
}
export const operatorDriverHandlers = [
  http.get(endpoint, () => HttpResponse.json(read())),
  http.post(endpoint, ({ request }) => save(request)),
  http.put(`${endpoint}/:id`, ({ request, params }) =>
    save(request, String(params.id)),
  ),
  http.patch(`${endpoint}/:id/status`, async ({ request, params }) => {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return error("Dữ liệu không hợp lệ.", 400);
    }
    const parsed = z
      .object({ status: z.enum(["available", "paused"]) })
      .safeParse(payload);
    if (!parsed.success) return error("Trạng thái không hợp lệ.", 400);
    const drivers = read(),
      item = drivers.find((d) => d.id === params.id);
    if (!item) return error("Không tìm thấy tài xế.", 404);
    if (item.status === "running")
      return error(
        "Tài xế đang chạy chuyến, chưa thể tạm ngưng hoạt động.",
        409,
      );
    const next = { ...item, status: parsed.data.status };
    try {
      commit(drivers.map((d) => (d.id === item.id ? next : d)));
    } catch {
      return error("Không lưu được dữ liệu phiên. Vui lòng thử lại.", 503);
    }
    return HttpResponse.json(next);
  }),
];
