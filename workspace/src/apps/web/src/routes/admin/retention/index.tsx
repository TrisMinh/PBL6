import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";
import { RetentionPage } from "@/features/admin/retention/RetentionPage";
import { createMeta } from "@/shared/config/seo";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Lưu trữ dữ liệu",
    description:
      "Lưu trữ hồ sơ đã đóng và theo dõi dung lượng PostgreSQL trên BLUE.",
    noIndex: true,
  });
}

export default function Route(): ReactElement {
  return <RetentionPage />;
}
