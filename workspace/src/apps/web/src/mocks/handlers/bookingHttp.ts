import { HttpResponse } from "msw";
import { z } from "zod";

import { bookingPassengerCountSchema } from "@/features/booking/schemas/passengerCount.schema";

const PROBLEMS = {
  BOOKING_LOCKED: {
    status: 409,
    title: "Đặt vé đã được xác nhận",
    detail:
      "Tiếp tục với đặt vé hiện tại hoặc tìm chuyến để bắt đầu phiên mới.",
  },
  IDEMPOTENCY_CONFLICT: {
    status: 409,
    title: "Yêu cầu đặt vé không khớp",
    detail: "Quay lại kiểm tra đặt vé hiện tại trước khi thử lại.",
  },
  VALIDATION_ERROR: {
    status: 400,
    title: "Thông tin đặt vé chưa hợp lệ",
    detail: "Kiểm tra thông tin và thử lại.",
  },
  NOT_FOUND: {
    status: 404,
    title: "Không tìm thấy dữ liệu",
    detail: "Vui lòng tìm lại chuyến hoặc bắt đầu phiên đặt vé mới.",
  },
  SELECTION_LIMIT_EXCEEDED: {
    status: 409,
    title: "Chỉ được chọn tối đa 6 ghế",
    detail: "Bỏ bớt ghế để tiếp tục đặt vé.",
  },
  SEAT_CONFLICT: {
    status: 409,
    title: "Ghế không còn khả dụng",
    detail: "Kiểm tra lại sơ đồ ghế và chọn ghế khác.",
  },
  HOLD_EXPIRED: {
    status: 410,
    title: "Phiên giữ chỗ đã hết hạn",
    detail: "Vui lòng tìm lại chuyến và bắt đầu đặt vé mới.",
  },
};

export function bookingProblem(
  code: keyof typeof PROBLEMS,
  instance: string,
  extras: {
    errors?: Record<string, string[]>;
    conflictingSeatIds?: string[];
  } = {},
): Response {
  return HttpResponse.json(
    {
      type: "about:blank",
      ...PROBLEMS[code],
      instance,
      code,
      traceId: crypto.randomUUID(),
      ...extras,
    },
    {
      status: PROBLEMS[code].status,
      headers: { "Content-Type": "application/problem+json" },
    },
  );
}

export const bookingIdSchema = z.string().trim().min(1).max(128);
export const createSessionSchema = z
  .object({
    tripId: bookingIdSchema,
    passengerCount: bookingPassengerCountSchema,
  })
  .strict();
export const replaceSeatsSchema = z
  .object({ seatIds: z.array(bookingIdSchema) })
  .strict();
export const replacePassengersSchema = z
  .object({
    contact: z
      .object({ fullName: z.string(), email: z.string(), phone: z.string() })
      .strict(),
    passengers: z.array(
      z
        .object({
          seatId: bookingIdSchema,
          fullName: z.string(),
          phone: z.string().optional(),
        })
        .strict(),
    ),
  })
  .strict();

export async function readBookingBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  instance: string,
  field: string,
): Promise<{ data: T } | { error: Response }> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    value = undefined;
  }
  const parsed = schema.safeParse(value);
  return parsed.success
    ? { data: parsed.data }
    : {
        error: bookingProblem("VALIDATION_ERROR", instance, {
          errors: { [field]: ["Kiểm tra thông tin và thử lại."] },
        }),
      };
}
