import { tripSearchSchema } from "@/features/trips/schemas/search.schema";
import { getVietnamTodayDate } from "@/shared/lib/getVietnamTodayDate";
import { homeSearchPath } from "@/features/home/lib/recentSearches";

export interface AssistantReply {
  text: string;
  actions?: { label: string; to: string }[];
}
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
}
const cities = [
  {
    id: "loc-hcm",
    name: "TP. Hồ Chí Minh",
    aliases: ["ho chi minh", "sai gon", "tphcm", "tp.hcm", "tp hcm", "hcm"],
  },
  { id: "loc-dalat", name: "Đà Lạt", aliases: ["da lat", "lam dong"] },
  { id: "loc-hanoi", name: "Hà Nội", aliases: ["ha noi"] },
  { id: "loc-danang", name: "Đà Nẵng", aliases: ["da nang"] },
];
export function getAssistantReply(
  message: string,
  mock = true,
): AssistantReply {
  const value = normalize(message);
  if (/huy|hoan tien/.test(value))
    return {
      text: "Bạn mở Vé của tôi, chọn vé cần xử lý và xem điều kiện hủy trước khi xác nhận. Mức hoàn phụ thuộc chính sách của chuyến.",
      actions: [
        { label: "Vé của tôi", to: "/account/tickets" },
        { label: "Hướng dẫn hủy vé", to: "/support#huy-ve" },
      ],
    };
  if (/tra cuu|ma ve|ve cua toi|ve dien tu/.test(value))
    return {
      text: "Bạn dùng mã đặt vé và email hoặc số điện thoại đã đặt để tra cứu. Nếu đặt bằng tài khoản, mở Vé của tôi để xem các chuyến đã đặt.",
      actions: [
        { label: "Tra cứu vé", to: "/tickets/lookup" },
        { label: "Vé của tôi", to: "/account/tickets" },
      ],
    };
  if (/thanh toan|vnpay|ngan hang/.test(value))
    return {
      text: "Ở bước thanh toán, bạn có thể chọn VNPay QR, ATM/ngân hàng hoặc thẻ quốc tế. Vé chỉ được phát hành khi giao dịch được xác nhận. Bản trải nghiệm hiện không thu tiền thật.",
      actions: [{ label: "Hướng dẫn thanh toán", to: "/offers#thanh-toan" }],
    };
  if (/cach dat|huong dan|dat ve nhu/.test(value))
    return {
      text: "Bạn chọn điểm đi, điểm đến và ngày đi → chọn chuyến → chọn ghế → nhập hành khách → kiểm tra đơn → thanh toán. Bạn được xem giá và thông tin chuyến trước khi đặt.",
      actions: [{ label: "Bắt đầu tìm chuyến", to: "/trips" }],
    };
  const mentioned = cities
    .map((city) => ({
      ...city,
      index: Math.min(
        ...city.aliases
          .map((alias) => value.indexOf(alias))
          .filter((index) => index >= 0),
      ),
    }))
    .filter((city) => Number.isFinite(city.index))
    .sort((a, b) => a.index - b.index);
  if (mock && mentioned.length >= 2) {
    const date = new Date(getVietnamTodayDate() + "T00:00:00Z");
    if (!/hom nay/.test(value)) date.setUTCDate(date.getUTCDate() + 1);
    let departureDate = date.toISOString().slice(0, 10);
    const explicit = value.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    const localDate = value.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
    if (explicit) departureDate = explicit[1];
    else if (localDate)
      departureDate = `${localDate[3]}-${localDate[2].padStart(2, "0")}-${localDate[1].padStart(2, "0")}`;
    const count = Number(
      value.match(/(\d+)\s*(nguoi|hanh khach|ve|ghe)/)?.[1] ?? "1",
    );
    const parsed = tripSearchSchema.safeParse({
      originId: mentioned[0].id,
      destinationId: mentioned[1].id,
      departureDate,
      passengerCount: count,
      sort: "relevance",
    });
    if (!parsed.success)
      return {
        text: "Bạn kiểm tra lại ngày đi và số người nhé: ngày phải từ hôm nay trở đi, mỗi đơn từ 1 đến 6 người. Ví dụ: Sài Gòn đi Đà Lạt ngày mai, 2 người.",
      };
    return {
      text: `Mình đã chuẩn bị tìm kiếm ${mentioned[0].name} → ${mentioned[1].name}, ngày ${departureDate.split("-").reverse().join("/")} cho ${count} người. Bạn mở kết quả để xem giá, lọc và chọn chuyến; mình chưa đặt hoặc giữ ghế.`,
      actions: [
        { label: "Xem chuyến phù hợp", to: homeSearchPath(parsed.data) },
      ],
    };
  }
  if (/tim chuyen|dat ve|di |chuyen xe/.test(value))
    return {
      text: "Bạn muốn đi từ tỉnh/thành nào đến đâu, ngày nào và bao nhiêu người? Ví dụ: Sài Gòn đi Đà Lạt ngày mai, 2 người.",
      actions: [{ label: "Tự tìm chuyến", to: "/trips" }],
    };
  return {
    text: "Mình có thể hướng dẫn tìm chuyến, đặt vé, tra cứu vé, thanh toán và hủy vé. Đây là bản hỗ trợ mẫu, chưa kết nối AI thật. Bạn chọn một chủ đề hoặc mô tả điều cần hỗ trợ nhé.",
    actions: [{ label: "Trung tâm hỗ trợ", to: "/support" }],
  };
}
