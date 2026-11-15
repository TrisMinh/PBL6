import { SettlementsPage } from "@/features/operator/organization/SettlementsPage";
import { createMeta } from "@/shared/config/seo";
export function meta(): ReturnType<typeof createMeta> {
  return createMeta({
    title: "Đối soát nhà xe",
    description: "Theo dõi doanh thu và khoản đối soát nhà xe.",
    noIndex: true,
  });
}
export default SettlementsPage;
