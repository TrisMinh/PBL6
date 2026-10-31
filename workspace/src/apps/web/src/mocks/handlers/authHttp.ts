import { HttpResponse } from "msw";

export function authProblem(
  code:
    | "INVALID_CREDENTIALS"
    | "VALIDATION_ERROR"
    | "SERVICE_UNAVAILABLE"
    | "ACCESS_REQUIRED"
    | "FORBIDDEN",
): Response {
  const status = {
    INVALID_CREDENTIALS: 401,
    VALIDATION_ERROR: 400,
    SERVICE_UNAVAILABLE: 503,
    ACCESS_REQUIRED: 401,
    FORBIDDEN: 403,
  }[code];
  return HttpResponse.json(
    {
      type: "about:blank",
      title: "Chưa thể tiếp tục",
      status,
      code,
      traceId: crypto.randomUUID(),
      instance: "/api/v1/auth",
      detail:
        code === "INVALID_CREDENTIALS"
          ? "Email hoặc mật khẩu mô phỏng chưa đúng. Kiểm tra và thử lại."
          : "Kiểm tra thông tin, đăng nhập lại hoặc thử lại sau.",
    },
    {
      status,
      headers: {
        "Content-Type": "application/problem+json",
        "Cache-Control": "no-store",
      },
    },
  );
}
