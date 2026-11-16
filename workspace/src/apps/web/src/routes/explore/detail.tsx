import type { ReactElement } from "react";
import { useParams, type MetaDescriptor } from "react-router";
import { createMeta } from "@/shared/config/seo";
import { ProvincePage } from "@/features/explore/ExplorePages";
export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Điểm đón và điểm trả",
    description: "Danh mục điểm đón trả và nhà xe theo tỉnh thành.",
  });
}
export default function ProvinceRoute(): ReactElement {
  const { provinceSlug } = useParams();
  return <ProvincePage slug={provinceSlug ?? ""} />;
}
