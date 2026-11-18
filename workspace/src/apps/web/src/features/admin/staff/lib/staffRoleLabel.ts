import type { StaffRole } from "@/features/admin/types/admin";

const ROLE_LABELS: Record<StaffRole, string> = {
  OPERATOR_ADMIN: "Quản trị nhà xe",
  OPERATOR_SCHEDULER: "Lập lịch",
  DRIVER: "Tài xế",
  PLATFORM_SUPPORT: "Hỗ trợ nền tảng",
};

export function staffRoleLabel(role?: StaffRole): string {
  return role ? (ROLE_LABELS[role] ?? "Chưa gán vai trò") : "Chưa gán vai trò";
}
