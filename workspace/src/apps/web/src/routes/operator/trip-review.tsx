import { isMockApi } from "@/shared/api/config";
import { LiveTripReview } from "@/features/operator/LiveOperatorForms";
import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";
import { TripReviewPage } from "@/features/operator/review/TripReviewPage";
import { createMeta } from "@/shared/config/seo";
export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Operator — Kiểm tra và phát hành chuyến",
    description: "Kiểm tra bản nháp trước khi phát hành chuyến mô phỏng.",
    noIndex: true,
  });
}
export default function TripReviewRoute(): ReactElement {
  return isMockApi ? (
    <TripReviewPage />
  ) : (
    <LiveTripReview />
  );
}
