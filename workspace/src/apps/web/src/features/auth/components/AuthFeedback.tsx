import { isMockApi } from "@/shared/api/config";
import type { ReactElement } from "react";
import { Link } from "react-router";

import type { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import { ROUTES } from "@/shared/config/routes";

export function AuthError({
  error,
}: {
  error: BookingRepositoryError | null;
}): ReactElement | null {
  if (!error || error.code === "ABORTED") return null;
  const text =
    error.code === "INVALID_CREDENTIALS"
      ? "Email hoặc mật khẩu mô phỏng chưa đúng. Kiểm tra và thử lại."
      : error.code === "STORAGE_UNAVAILABLE"
        ? "Trình duyệt chưa cho lưu phiên. Cho phép lưu trữ rồi thử lại."
        : "Chưa thể tiếp tục. Kiểm tra kết nối và thử lại.";
  return (
    <p className="auth-page__error" role="alert">
      {!isMockApi ? error.message : text}
    </p>
  );
}
export function NeutralSuccess({
  reset = false,
}: {
  reset?: boolean;
}): ReactElement {
  if (!isMockApi)
    return (
      <div className="auth-page__success">
        <p role="status">
          Yêu cầu đã được tiếp nhận. Vui lòng kiểm tra email để thực hiện bước
          tiếp theo.
        </p>
        <Link to={reset ? "/reset-password" : "/verify-email"}>
          {reset ? "Đặt lại mật khẩu" : "Xác minh email"}
        </Link>
        <Link to={ROUTES.login}>Quay lại đăng nhập</Link>
      </div>
    );
  return (
    <div className="auth-page__success">
      <p role="status">Yêu cầu mô phỏng đã được tiếp nhận.</p>
      <p>
        Không gửi email hoặc tạo tài khoản thật. Phản hồi này giống nhau cho mọi
        email hợp lệ.
      </p>
      <Link to={ROUTES.login}>Quay lại đăng nhập</Link>
    </div>
  );
}
