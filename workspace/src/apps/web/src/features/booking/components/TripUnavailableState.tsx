import type { ReactElement } from "react";
import { Link } from "react-router";
import { PageState } from "@/shared/ui/PageState/PageState";

export function TripUnavailableState(): ReactElement {
  return (
    <PageState
      title="Chuyến đã ngừng bán"
      description="Chuyến này không còn nhận đặt vé. Vui lòng tìm chuyến khác để tiếp tục hành trình."
      action={<Link to="/">Tìm chuyến khác</Link>}
    />
  );
}
