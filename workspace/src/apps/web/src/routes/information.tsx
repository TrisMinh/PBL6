import { InformationPage } from "@/features/support/InformationPage";
import { createMeta } from "@/shared/config/seo";
export function meta(): ReturnType<typeof createMeta> {
  return createMeta({
    title: "Thông tin & hỗ trợ",
    description: "Hướng dẫn dịch vụ và hỗ trợ hành trình trên BLUE.",
  });
}
export default InformationPage;
