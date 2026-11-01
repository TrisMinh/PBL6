import type { ReactElement } from "react";
import { Link } from "react-router";

import { bookingReviewPath } from "@/shared/config/routes";
import { PageState } from "@/shared/ui/PageState/PageState";

export function BookedSessionState({
  sessionId,
}: {
  sessionId: string;
}): ReactElement {
  return (
    <PageState
      title="Đặt vé đã được xác nhận"
      description="Ghế và thông tin hành khách đã được khóa. Xem lại đặt vé hiện tại để tiếp tục thanh toán."
      action={<Link to={bookingReviewPath(sessionId)}>Xem lại đặt vé</Link>}
    />
  );
}
