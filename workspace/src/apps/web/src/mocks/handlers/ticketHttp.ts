import { HttpResponse } from "msw";

const PROBLEMS = {
  NOT_FOUND: {
    status: 404,
    title: "Không tìm thấy vé",
    detail: "Kiểm tra mã đặt vé và thông tin xác thực rồi tra cứu lại.",
  },
  ACCESS_REQUIRED: {
    status: 401,
    title: "Cần xác thực để xem vé",
    detail: "Tra cứu vé bằng thông tin đã đặt để tiếp tục.",
  },
  LOOKUP_EXPIRED: {
    status: 410,
    title: "Phiên tra cứu đã hết hạn",
    detail: "Tra cứu lại để tiếp tục xem vé.",
  },
  VALIDATION_ERROR: {
    status: 400,
    title: "Thông tin tra cứu chưa hợp lệ",
    detail: "Kiểm tra các trường và thử lại.",
  },
  SERVICE_UNAVAILABLE: {
    status: 503,
    title: "Chưa thể tra cứu vé",
    detail: "Vui lòng thử lại sau ít phút.",
  },
};
export function ticketProblem(
  code: keyof typeof PROBLEMS,
  instance: string,
): Response {
  return HttpResponse.json(
    {
      type: "about:blank",
      ...PROBLEMS[code],
      code,
      instance,
      traceId: crypto.randomUUID(),
    },
    {
      status: PROBLEMS[code].status,
      headers: {
        "Content-Type": "application/problem+json",
        "Cache-Control": "no-store",
      },
    },
  );
}
