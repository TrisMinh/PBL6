import type { ReactElement } from "react";
import { Link, type MetaDescriptor } from "react-router";

import { createMeta } from "@/shared/config/seo";
import { ROUTES } from "@/shared/config/routes";
import { PageState } from "@/shared/ui/PageState/PageState";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Không tìm thấy trang",
    description: "Trang bạn tìm không tồn tại. Về trang chủ BLUE để tiếp tục.",
    noIndex: true,
  });
}

export default function NotFound(): ReactElement {
  return (
    <PageState
      title="Không tìm thấy trang"
      description="Đường dẫn có thể đã thay đổi hoặc không còn tồn tại."
      action={<Link to={ROUTES.home}>Về trang chủ</Link>}
    />
  );
}
