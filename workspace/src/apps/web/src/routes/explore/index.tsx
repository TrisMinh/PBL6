import { isMockApi } from "@/shared/api/config";
import { BackendExploreIndex } from "@/features/explore/BackendExplorePage";
import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";
import { createMeta } from "@/shared/config/seo";
import { ExplorePage } from "@/features/explore/ExplorePages";
export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Khám phá tỉnh thành",
    description:
      "Khám phá danh mục mô phỏng tỉnh thành và điểm đón trả cùng BLUE.",
  });
}
export default function ExploreRoute(): ReactElement {
  return isMockApi ? <ExplorePage /> : <BackendExploreIndex />;
}
