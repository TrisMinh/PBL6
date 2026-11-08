import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";
import { TripReviewPage } from "@/features/operator/review/TripReviewPage";
import { createMeta } from "@/shared/config/seo";
export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Operator — Kiểm tra và phát hành chuyến",
    description:
      "Kiểm tra bản nháp, xác nhận phát hành và theo dõi trạng thái mở bán.",
    noIndex: true,
  });
}
export default function TripReviewRoute(): ReactElement {
  return <TripReviewPage />;
}
