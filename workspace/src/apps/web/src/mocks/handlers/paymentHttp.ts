import { HttpResponse } from "msw";

const PROBLEMS = {
  PAYMENT_IN_PROGRESS: {
    status: 409,
    title: "Giao dịch đang chờ xác nhận",
    detail: "Kiểm tra lại giao dịch hiện tại trước khi thử thanh toán.",
  },
  PAYMENT_NOT_ALLOWED: {
    status: 409,
    title: "Chưa thể thanh toán đặt vé",
    detail: "Kiểm tra đặt vé hoặc tìm lại chuyến.",
  },
  IDEMPOTENCY_CONFLICT: {
    status: 409,
    title: "Yêu cầu thanh toán không khớp",
    detail: "Kiểm tra giao dịch hiện tại trước khi thử lại.",
  },
};
export function paymentProblem(
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
      headers: { "Content-Type": "application/problem+json" },
    },
  );
}
