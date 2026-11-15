import { OrganizationPage } from "@/features/operator/organization/OrganizationPage";
import { createMeta } from "@/shared/config/seo";
export function meta(): ReturnType<typeof createMeta> {
  return createMeta({
    title: "Tổ chức & thành viên",
    description: "Quản lý hồ sơ nhà xe và thành viên.",
    noIndex: true,
  });
}
export default OrganizationPage;
