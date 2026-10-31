export const stateLabels: Record<string, string> = {
  wifi: "Wi-Fi",
  charging: "Cổng sạc",
  restroom: "Nhà vệ sinh",
  DRAFT: "Bản nháp",
  SCHEDULED: "Đã lên lịch",
  BOARDING: "Đang đón khách",
  DEPARTED: "Đã xuất bến",
  IN_TRANSIT: "Đang di chuyển",
  ARRIVED: "Đã đến nơi",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Ngừng hoạt động",
  SUSPENDED: "Tạm ngưng",
  DISABLED: "Đã vô hiệu hóa",
  LOCKED: "Đã khóa",
  PENDING_VERIFICATION: "Chưa xác minh",
  EXPIRED: "Đã hết hạn",
  ENDED: "Đã kết thúc",
  MAINTENANCE: "Đang bảo trì",
  PENDING: "Đang chờ",
  PROCESSING: "Đang xử lý",
  SUCCEEDED: "Thành công",
  FAILED: "Thất bại",
  REFUND_PENDING: "Chờ hoàn tiền",
  PARTIALLY_REFUNDED: "Đã hoàn một phần",
  REFUNDED: "Đã hoàn tiền",
  REQUESTED: "Đã tiếp nhận",
  SENT: "Đã chuyển",
  PENDING_PAYMENT: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  CONFIRMED: "Đã xác nhận",
  ISSUED: "Có hiệu lực",
  CHECKED_IN: "Đã lên xe",
  USED: "Đã sử dụng",
  COLLECTED: "Đã thu",
  UNCOLLECTED: "Chưa thu",
  NOSHOW_WRITTEN_OFF: "Khách không đến",
  PREPAID: "Thanh toán trước",
  PAY_LATER: "Thanh toán sau",
  STANDARD: "Ghế tiêu chuẩn",
  VIP: "Ghế VIP",
  SLEEPER: "Giường nằm",
  SLEEPER_34: "Giường nằm",
  CABIN_22: "Cabin",
  SEAT: "Ghế ngồi",
};
export function stateLabel(value: string): string {
  return stateLabels[value] ?? value;
}
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();
}
export function shortId(value: string): string {
  return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)
    ? `#${value.slice(-8).toUpperCase()}`
    : value;
}
