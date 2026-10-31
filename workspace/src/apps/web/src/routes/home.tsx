import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";

import { createMeta } from "@/shared/config/seo";
import { HomePage } from "@/features/home/pages/HomePage";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Đặt vé xe online nhanh chóng",
    description: "Tìm chuyến, chọn ghế và đặt vé xe trực tuyến cùng BLUE.",
  });
}

export default function HomeRoute(): ReactElement {
  return <HomePage />;
}
