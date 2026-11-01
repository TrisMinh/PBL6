import type { ReactElement } from "react";
import { Link } from "react-router";

import { bookingReviewPath } from "@/shared/config/routes";

import "./BookingLockedFeedback.css";

export function BookingLockedFeedback({
  sessionId,
}: {
  sessionId: string;
}): ReactElement {
  return (
    <div className="booking-locked-feedback" role="alert">
      <p>
        Đặt vé đã được xác nhận. Thông tin được giữ nguyên và không thể chỉnh
        sửa. Xem lại đặt vé để tiếp tục.
      </p>
      <Link to={bookingReviewPath(sessionId)}>Xem lại đặt vé</Link>
    </div>
  );
}
