import type {
  AdminBooking,
  AdminPayment,
  AdminRefund,
} from "@/features/admin/types/admin";

export const figmaBookings = [
  {
    id: "BK-260916-018",
    createdAt: "2026-09-16T02:10:00.000Z",
    updatedAt: "2026-09-19T03:36:00.000Z",
    bookingCode: "BK-260916-018",
    organizationId: "ORG-001",
    customerName: "Nguyễn Minh A.",
    routeLabel: "TP.HCM → Đà Lạt",
    passengerCount: 2,
    totalVnd: 640000,
    status: "cancelled",
    audit: {
      organizationName: "BlueLine Co.",
      history: [
        {
          occurredAt: "2026-09-16T02:10:00.000Z",
          description: "Tạo đơn đặt vé • Khách hàng gửi yêu cầu đặt 2 ghế.",
        },
        {
          occurredAt: "2026-09-16T02:12:00.000Z",
          description:
            "Thanh toán thành công • Hệ thống xác nhận tiền thu và phát hành 2 vé.",
        },
        {
          occurredAt: "2026-09-19T02:00:00.000Z",
          description:
            "Khách hàng yêu cầu hủy • Hệ thống hủy vé và tạo khoản hoàn theo chính sách.",
        },
      ],
      collectedVnd: 640000,
      refundedVnd: 0,
      reservationState: "awaiting-refund",
      departureAt: "2026-09-20T04:00:00.000Z",
      seats: ["A01", "A02"],
      ticketState: "cancelled",
      paymentId: "PAY-260916-018",
      paymentState: "awaiting-refund",
      refundId: "RF-260916-018",
      refundState: "processing",
      refundRequestedVnd: 576000,
    },
  },
  {
    id: "BK-260916-019",
    createdAt: "2026-09-16T02:10:00.000Z",
    updatedAt: "2026-09-19T03:36:00.000Z",
    bookingCode: "BK-260916-019",
    organizationId: "ORG-002",
    customerName: "Trần Thu H.",
    routeLabel: "TP.HCM → Đà Lạt",
    passengerCount: 2,
    totalVnd: 420000,
    status: "paid",
    audit: {
      organizationName: "RedLine Express",
      history: [
        {
          occurredAt: "2026-09-16T02:10:00.000Z",
          description: "Tạo đơn đặt vé • Khách hàng gửi yêu cầu đặt 2 ghế.",
        },
        {
          occurredAt: "2026-09-16T02:12:00.000Z",
          description:
            "Thanh toán thành công • Hệ thống xác nhận tiền thu và phát hành 2 vé.",
        },
      ],
      collectedVnd: 420000,
      refundedVnd: 0,
      reservationState: "paid",
      departureAt: "2026-09-20T04:00:00.000Z",
      seats: ["A01", "A02"],
      ticketState: "issued",
      paymentId: "PAY-260916-019",
      paymentState: "success",
      refundRequestedVnd: 0,
    },
  },
  {
    id: "BK-260916-020",
    createdAt: "2026-09-16T02:10:00.000Z",
    updatedAt: "2026-09-19T03:36:00.000Z",
    bookingCode: "BK-260916-020",
    organizationId: "ORG-003",
    customerName: "Phạm Ngọc M.",
    routeLabel: "TP.HCM → Đà Lạt",
    passengerCount: 2,
    totalVnd: 560000,
    status: "cancelled",
    audit: {
      organizationName: "Đà Lạt Travel",
      history: [
        {
          occurredAt: "2026-09-16T02:10:00.000Z",
          description: "Tạo đơn đặt vé • Khách hàng gửi yêu cầu đặt 2 ghế.",
        },
        {
          occurredAt: "2026-09-16T02:12:00.000Z",
          description:
            "Thanh toán thành công • Hệ thống xác nhận tiền thu và phát hành 2 vé.",
        },
        {
          occurredAt: "2026-09-19T02:00:00.000Z",
          description:
            "Khách hàng yêu cầu hủy • Hệ thống hủy vé và tạo khoản hoàn theo chính sách.",
        },
        {
          occurredAt: "2026-09-19T02:05:00.000Z",
          description:
            "Hoàn tiền thành công • Cập nhật trạng thái đơn; vé giữ trạng thái đã hủy.",
        },
      ],
      collectedVnd: 560000,
      refundedVnd: 448000,
      reservationState: "refunded",
      departureAt: "2026-09-19T11:00:00.000Z",
      seats: ["A01", "A02"],
      ticketState: "refunded",
      paymentId: "PAY-260916-020",
      paymentState: "partially-refunded",
      refundId: "RF-260916-020",
      refundState: "completed",
      refundRequestedVnd: 448000,
    },
  },
  {
    id: "BK-260916-021",
    createdAt: "2026-09-19T03:30:00.000Z",
    updatedAt: "2026-09-19T03:36:00.000Z",
    bookingCode: "BK-260916-021",
    organizationId: "ORG-001",
    customerName: "Lê Minh K.",
    routeLabel: "TP.HCM → Đà Lạt",
    passengerCount: 2,
    totalVnd: 320000,
    status: "pending-payment",
    audit: {
      organizationName: "BlueLine Co.",
      history: [
        {
          occurredAt: "2026-09-19T03:30:00.000Z",
          description: "Tạo đơn đặt vé • Khách hàng gửi yêu cầu đặt 2 ghế.",
        },
        {
          occurredAt: "2026-09-19T03:32:00.000Z",
          description:
            "Chờ xác nhận thanh toán • Chưa có kết quả cuối; không kết luận thanh toán thất bại.",
        },
      ],
      collectedVnd: 0,
      refundedVnd: 0,
      reservationState: "pending-payment",
      departureAt: "2026-09-20T04:00:00.000Z",
      seats: ["A01", "A02"],
      ticketState: "not-issued",
      paymentId: "PAY-260916-021",
      paymentState: "pending",
      refundRequestedVnd: 0,
    },
  },
  {
    id: "BK-260916-022",
    createdAt: "2026-09-16T02:10:00.000Z",
    updatedAt: "2026-09-19T03:36:00.000Z",
    bookingCode: "BK-260916-022",
    organizationId: "ORG-004",
    customerName: "Bùi Khánh L.",
    routeLabel: "TP.HCM → Đà Lạt",
    passengerCount: 2,
    totalVnd: 700000,
    status: "cancelled",
    audit: {
      organizationName: "Sài Gòn Express",
      history: [
        {
          occurredAt: "2026-09-16T02:10:00.000Z",
          description: "Tạo đơn đặt vé • Khách hàng gửi yêu cầu đặt 2 ghế.",
        },
        {
          occurredAt: "2026-09-16T02:12:00.000Z",
          description:
            "Thanh toán thành công • Hệ thống xác nhận tiền thu và phát hành 2 vé.",
        },
        {
          occurredAt: "2026-09-19T02:00:00.000Z",
          description:
            "Khách hàng yêu cầu hủy • Hệ thống hủy vé và tạo khoản hoàn theo chính sách.",
        },
      ],
      collectedVnd: 700000,
      refundedVnd: 0,
      reservationState: "awaiting-refund",
      departureAt: "2026-09-19T06:00:00.000Z",
      seats: ["A01", "A02"],
      ticketState: "cancelled",
      paymentId: "PAY-260916-022",
      paymentState: "awaiting-refund",
      refundId: "RF-260916-022",
      refundState: "failed",
      refundRequestedVnd: 490000,
    },
  },
  {
    id: "BK-260916-023",
    createdAt: "2026-09-16T02:10:00.000Z",
    updatedAt: "2026-09-19T03:36:00.000Z",
    bookingCode: "BK-260916-023",
    organizationId: "ORG-006",
    customerName: "Đỗ Minh A.",
    routeLabel: "TP.HCM → Đà Lạt",
    passengerCount: 2,
    totalVnd: 480000,
    status: "cancelled",
    audit: {
      organizationName: "Hải Vân Transport",
      history: [
        {
          occurredAt: "2026-09-16T02:10:00.000Z",
          description: "Tạo đơn đặt vé • Khách hàng gửi yêu cầu đặt 2 ghế.",
        },
        {
          occurredAt: "2026-09-16T02:12:00.000Z",
          description:
            "Thanh toán thành công • Hệ thống xác nhận tiền thu và phát hành 2 vé.",
        },
        {
          occurredAt: "2026-09-19T02:00:00.000Z",
          description:
            "Khách hàng yêu cầu hủy • Hệ thống hủy vé và tạo khoản hoàn theo chính sách.",
        },
        {
          occurredAt: "2026-09-19T02:05:00.000Z",
          description:
            "Hoàn tiền thành công • Cập nhật trạng thái đơn; vé giữ trạng thái đã hủy.",
        },
      ],
      collectedVnd: 480000,
      refundedVnd: 432000,
      reservationState: "refunded",
      departureAt: "2026-09-20T04:00:00.000Z",
      seats: ["A01", "A02"],
      ticketState: "refunded",
      paymentId: "PAY-260916-023",
      paymentState: "partially-refunded",
      refundId: "RF-260916-023",
      refundState: "completed",
      refundRequestedVnd: 432000,
    },
  },
  {
    id: "BK-260916-024",
    createdAt: "2026-09-16T02:10:00.000Z",
    updatedAt: "2026-09-19T03:36:00.000Z",
    bookingCode: "BK-260916-024",
    organizationId: "ORG-007",
    customerName: "Võ Thành Đ.",
    routeLabel: "TP.HCM → Đà Lạt",
    passengerCount: 2,
    totalVnd: 360000,
    status: "pending-payment",
    audit: {
      organizationName: "Mekong Bus",
      history: [
        {
          occurredAt: "2026-09-16T02:10:00.000Z",
          description: "Tạo đơn đặt vé • Khách hàng gửi yêu cầu đặt 2 ghế.",
        },
        {
          occurredAt: "2026-09-16T02:12:00.000Z",
          description:
            "Thanh toán không thành công • VNPay xác nhận thất bại; chưa phát hành vé.",
        },
        {
          occurredAt: "2026-09-16T02:25:00.000Z",
          description:
            "Đơn hết hạn • Hệ thống kết thúc thời gian giữ chỗ, giải phóng ghế.",
        },
      ],
      collectedVnd: 0,
      refundedVnd: 0,
      reservationState: "expired",
      departureAt: "2026-09-20T04:00:00.000Z",
      seats: ["A01", "A02"],
      ticketState: "not-issued",
      paymentId: "PAY-260916-024",
      paymentState: "failed",
      refundRequestedVnd: 0,
    },
  },
  {
    id: "BK-260916-025",
    createdAt: "2026-09-16T02:10:00.000Z",
    updatedAt: "2026-09-19T03:36:00.000Z",
    bookingCode: "BK-260916-025",
    organizationId: "ORG-001",
    customerName: "Hoàng Quốc B.",
    routeLabel: "TP.HCM → Đà Lạt",
    passengerCount: 2,
    totalVnd: 640000,
    status: "cancelled",
    audit: {
      organizationName: "BlueLine Co.",
      history: [
        {
          occurredAt: "2026-09-16T02:10:00.000Z",
          description: "Tạo đơn đặt vé • Khách hàng gửi yêu cầu đặt 2 ghế.",
        },
        {
          occurredAt: "2026-09-16T02:12:00.000Z",
          description:
            "Thanh toán thành công • Hệ thống xác nhận tiền thu và phát hành 2 vé.",
        },
        {
          occurredAt: "2026-09-19T02:00:00.000Z",
          description:
            "Nhà xe hủy chuyến • Hệ thống hủy vé và ghi nhận khoản hoàn toàn bộ.",
        },
      ],
      collectedVnd: 640000,
      refundedVnd: 0,
      reservationState: "awaiting-refund",
      departureAt: "2026-09-20T04:00:00.000Z",
      seats: ["A01", "A02"],
      ticketState: "cancelled",
      paymentId: "PAY-260916-025",
      paymentState: "awaiting-refund",
      refundId: "RF-260916-025",
      refundState: "queued",
      refundRequestedVnd: 640000,
    },
  },
  {
    id: "BK-260916-026",
    createdAt: "2026-09-16T02:10:00.000Z",
    updatedAt: "2026-09-19T03:36:00.000Z",
    bookingCode: "BK-260916-026",
    organizationId: "ORG-002",
    customerName: "Ngô Lan C.",
    routeLabel: "TP.HCM → Đà Lạt",
    passengerCount: 2,
    totalVnd: 840000,
    status: "cancelled",
    audit: {
      organizationName: "RedLine Express",
      history: [
        {
          occurredAt: "2026-09-16T02:10:00.000Z",
          description: "Tạo đơn đặt vé • Khách hàng gửi yêu cầu đặt 2 ghế.",
        },
        {
          occurredAt: "2026-09-16T02:12:00.000Z",
          description:
            "Thanh toán thành công • Hệ thống xác nhận tiền thu và phát hành 2 vé.",
        },
        {
          occurredAt: "2026-09-19T02:00:00.000Z",
          description:
            "Khách hàng yêu cầu hủy • Hệ thống hủy vé và tạo khoản hoàn theo chính sách.",
        },
      ],
      collectedVnd: 840000,
      refundedVnd: 0,
      reservationState: "awaiting-refund",
      departureAt: "2026-09-20T04:00:00.000Z",
      seats: ["A01", "A02"],
      ticketState: "cancelled",
      paymentId: "PAY-260916-026",
      paymentState: "awaiting-refund",
      refundId: "RF-260916-026",
      refundState: "processing",
      refundRequestedVnd: 756000,
    },
  },
  {
    id: "BK-260916-027",
    createdAt: "2026-09-16T02:10:00.000Z",
    updatedAt: "2026-09-19T03:36:00.000Z",
    bookingCode: "BK-260916-027",
    organizationId: "ORG-003",
    customerName: "Nguyễn Hải N.",
    routeLabel: "TP.HCM → Đà Lạt",
    passengerCount: 2,
    totalVnd: 280000,
    status: "paid",
    audit: {
      organizationName: "Đà Lạt Travel",
      history: [
        {
          occurredAt: "2026-09-16T02:10:00.000Z",
          description: "Tạo đơn đặt vé • Khách hàng gửi yêu cầu đặt 2 ghế.",
        },
        {
          occurredAt: "2026-09-16T02:12:00.000Z",
          description:
            "Thanh toán thành công • Hệ thống xác nhận tiền thu và phát hành 2 vé.",
        },
      ],
      collectedVnd: 280000,
      refundedVnd: 0,
      reservationState: "paid",
      departureAt: "2026-09-20T04:00:00.000Z",
      seats: ["A01", "A02"],
      ticketState: "issued",
      paymentId: "PAY-260916-027",
      paymentState: "success",
      refundRequestedVnd: 0,
    },
  },
] satisfies AdminBooking[];

export const figmaPayments = [
  {
    id: "PAY-260916-018",
    createdAt: "2026-09-16T02:10:00.000Z",
    updatedAt: "2026-09-19T03:36:00.000Z",
    bookingId: "BK-260916-018",
    transactionCode: "VNP-9160018",
    amountVnd: 640000,
    status: "success",
    audit: {
      organizationName: "BlueLine Co.",
      history: [
        {
          occurredAt: "2026-09-16T02:10:00.000Z",
          description: "Khởi tạo thanh toán • Nguồn: khách hàng, cổng VNPay.",
        },
        {
          occurredAt: "2026-09-16T02:12:00.000Z",
          description:
            "Thành công • VNPay xác nhận giao dịch; hệ thống ghi nhận tiền đã thu.",
        },
        {
          occurredAt: "2026-09-19T02:00:00.000Z",
          description:
            "Phát sinh khoản hoàn • Liên kết RF-260916-018; không sửa kết quả thu tiền gốc.",
        },
      ],
      collectedVnd: 640000,
      refundedVnd: 0,
      collectionState: "awaiting-refund",
      provider: "VNPay",
      partnerCode: "VNP-9160018",
      requestedBy: "Khách hàng",
      correlationId: "COR-260916-018",
      refundId: "RF-260916-018",
      verification: "verified",
    },
  },
  {
    id: "PAY-260916-019",
    createdAt: "2026-09-16T02:10:00.000Z",
    updatedAt: "2026-09-19T03:36:00.000Z",
    bookingId: "BK-260916-019",
    transactionCode: "VNP-9160019",
    amountVnd: 420000,
    status: "success",
    audit: {
      organizationName: "RedLine Express",
      history: [
        {
          occurredAt: "2026-09-16T02:10:00.000Z",
          description: "Khởi tạo thanh toán • Nguồn: khách hàng, cổng VNPay.",
        },
        {
          occurredAt: "2026-09-16T02:12:00.000Z",
          description:
            "Thành công • VNPay xác nhận giao dịch; hệ thống ghi nhận tiền đã thu.",
        },
      ],
      collectedVnd: 420000,
      refundedVnd: 0,
      collectionState: "success",
      provider: "VNPay",
      partnerCode: "VNP-9160019",
      requestedBy: "Khách hàng",
      correlationId: "COR-260916-019",
      verification: "verified",
    },
  },
  {
    id: "PAY-260916-020",
    createdAt: "2026-09-16T02:10:00.000Z",
    updatedAt: "2026-09-19T03:36:00.000Z",
    bookingId: "BK-260916-020",
    transactionCode: "VNP-9160020",
    amountVnd: 560000,
    status: "success",
    audit: {
      organizationName: "Đà Lạt Travel",
      history: [
        {
          occurredAt: "2026-09-16T02:10:00.000Z",
          description: "Khởi tạo thanh toán • Nguồn: khách hàng, cổng VNPay.",
        },
        {
          occurredAt: "2026-09-16T02:12:00.000Z",
          description:
            "Thành công • VNPay xác nhận giao dịch; hệ thống ghi nhận tiền đã thu.",
        },
        {
          occurredAt: "2026-09-19T02:00:00.000Z",
          description:
            "Phát sinh khoản hoàn • Liên kết RF-260916-020; không sửa kết quả thu tiền gốc.",
        },
        {
          occurredAt: "2026-09-19T02:05:00.000Z",
          description:
            "Hoàn một phần • Hệ thống cập nhật tổng tiền hoàn thành công; phần còn lại là phí hủy.",
        },
      ],
      collectedVnd: 560000,
      refundedVnd: 448000,
      collectionState: "partially-refunded",
      provider: "VNPay",
      partnerCode: "VNP-9160020",
      requestedBy: "Khách hàng",
      correlationId: "COR-260916-020",
      refundId: "RF-260916-020",
      verification: "verified",
    },
  },
  {
    id: "PAY-260916-021",
    createdAt: "2026-09-19T03:30:00.000Z",
    updatedAt: "2026-09-19T03:36:00.000Z",
    bookingId: "BK-260916-021",
    transactionCode: "PAY-260916-021",
    amountVnd: 320000,
    status: "pending",
    audit: {
      organizationName: "BlueLine Co.",
      history: [
        {
          occurredAt: "2026-09-19T03:30:00.000Z",
          description: "Khởi tạo thanh toán • Nguồn: khách hàng, cổng VNPay.",
        },
        {
          occurredAt: "2026-09-19T03:32:00.000Z",
          description:
            "Đang xử lý • Chưa nhận được kết quả cuối từ cổng; không xác nhận đã thu tiền.",
        },
      ],
      collectedVnd: 0,
      refundedVnd: 0,
      collectionState: "pending",
      provider: "VNPay",
      requestedBy: "Khách hàng",
      correlationId: "COR-260916-021",
      verification: "waiting",
    },
  },
  {
    id: "PAY-260916-022",
    createdAt: "2026-09-16T02:10:00.000Z",
    updatedAt: "2026-09-19T03:36:00.000Z",
    bookingId: "BK-260916-022",
    transactionCode: "VNP-9160022",
    amountVnd: 700000,
    status: "success",
    audit: {
      organizationName: "Sài Gòn Express",
      history: [
        {
          occurredAt: "2026-09-16T02:10:00.000Z",
          description: "Khởi tạo thanh toán • Nguồn: khách hàng, cổng VNPay.",
        },
        {
          occurredAt: "2026-09-16T02:12:00.000Z",
          description:
            "Thành công • VNPay xác nhận giao dịch; hệ thống ghi nhận tiền đã thu.",
        },
        {
          occurredAt: "2026-09-19T02:00:00.000Z",
          description:
            "Phát sinh khoản hoàn • Liên kết RF-260916-022; không sửa kết quả thu tiền gốc.",
        },
      ],
      collectedVnd: 700000,
      refundedVnd: 0,
      collectionState: "awaiting-refund",
      provider: "VNPay",
      partnerCode: "VNP-9160022",
      requestedBy: "Khách hàng",
      correlationId: "COR-260916-022",
      refundId: "RF-260916-022",
      verification: "verified",
    },
  },
  {
    id: "PAY-260916-023",
    createdAt: "2026-09-16T02:10:00.000Z",
    updatedAt: "2026-09-19T03:36:00.000Z",
    bookingId: "BK-260916-023",
    transactionCode: "VNP-9160023",
    amountVnd: 480000,
    status: "success",
    audit: {
      organizationName: "Hải Vân Transport",
      history: [
        {
          occurredAt: "2026-09-16T02:10:00.000Z",
          description: "Khởi tạo thanh toán • Nguồn: khách hàng, cổng VNPay.",
        },
        {
          occurredAt: "2026-09-16T02:12:00.000Z",
          description:
            "Thành công • VNPay xác nhận giao dịch; hệ thống ghi nhận tiền đã thu.",
        },
        {
          occurredAt: "2026-09-19T02:00:00.000Z",
          description:
            "Phát sinh khoản hoàn • Liên kết RF-260916-023; không sửa kết quả thu tiền gốc.",
        },
        {
          occurredAt: "2026-09-19T02:05:00.000Z",
          description:
            "Hoàn một phần • Hệ thống cập nhật tổng tiền hoàn thành công; phần còn lại là phí hủy.",
        },
      ],
      collectedVnd: 480000,
      refundedVnd: 432000,
      collectionState: "partially-refunded",
      provider: "VNPay",
      partnerCode: "VNP-9160023",
      requestedBy: "Khách hàng",
      correlationId: "COR-260916-023",
      refundId: "RF-260916-023",
      verification: "verified",
    },
  },
  {
    id: "PAY-260916-024",
    createdAt: "2026-09-16T02:10:00.000Z",
    updatedAt: "2026-09-19T03:36:00.000Z",
    bookingId: "BK-260916-024",
    transactionCode: "PAY-260916-024",
    amountVnd: 360000,
    status: "failed",
    audit: {
      organizationName: "Mekong Bus",
      history: [
        {
          occurredAt: "2026-09-16T02:10:00.000Z",
          description: "Khởi tạo thanh toán • Nguồn: khách hàng, cổng VNPay.",
        },
        {
          occurredAt: "2026-09-16T02:12:00.000Z",
          description:
            "Thất bại • VNPay xác nhận giao dịch không thành công; số tiền đã thu là 0đ.",
        },
      ],
      collectedVnd: 0,
      refundedVnd: 0,
      collectionState: "failed",
      provider: "VNPay",
      requestedBy: "Khách hàng",
      correlationId: "COR-260916-024",
      verification: "failed",
    },
  },
  {
    id: "PAY-260916-025",
    createdAt: "2026-09-16T02:10:00.000Z",
    updatedAt: "2026-09-19T03:36:00.000Z",
    bookingId: "BK-260916-025",
    transactionCode: "VNP-9160025",
    amountVnd: 640000,
    status: "success",
    audit: {
      organizationName: "BlueLine Co.",
      history: [
        {
          occurredAt: "2026-09-16T02:10:00.000Z",
          description: "Khởi tạo thanh toán • Nguồn: khách hàng, cổng VNPay.",
        },
        {
          occurredAt: "2026-09-16T02:12:00.000Z",
          description:
            "Thành công • VNPay xác nhận giao dịch; hệ thống ghi nhận tiền đã thu.",
        },
        {
          occurredAt: "2026-09-19T02:00:00.000Z",
          description:
            "Phát sinh khoản hoàn • Liên kết RF-260916-025; không sửa kết quả thu tiền gốc.",
        },
      ],
      collectedVnd: 640000,
      refundedVnd: 0,
      collectionState: "awaiting-refund",
      provider: "VNPay",
      partnerCode: "VNP-9160025",
      requestedBy: "Khách hàng",
      correlationId: "COR-260916-025",
      refundId: "RF-260916-025",
      verification: "verified",
    },
  },
  {
    id: "PAY-260916-026",
    createdAt: "2026-09-16T02:10:00.000Z",
    updatedAt: "2026-09-19T03:36:00.000Z",
    bookingId: "BK-260916-026",
    transactionCode: "VNP-9160026",
    amountVnd: 840000,
    status: "success",
    audit: {
      organizationName: "RedLine Express",
      history: [
        {
          occurredAt: "2026-09-16T02:10:00.000Z",
          description: "Khởi tạo thanh toán • Nguồn: khách hàng, cổng VNPay.",
        },
        {
          occurredAt: "2026-09-16T02:12:00.000Z",
          description:
            "Thành công • VNPay xác nhận giao dịch; hệ thống ghi nhận tiền đã thu.",
        },
        {
          occurredAt: "2026-09-19T02:00:00.000Z",
          description:
            "Phát sinh khoản hoàn • Liên kết RF-260916-026; không sửa kết quả thu tiền gốc.",
        },
      ],
      collectedVnd: 840000,
      refundedVnd: 0,
      collectionState: "awaiting-refund",
      provider: "VNPay",
      partnerCode: "VNP-9160026",
      requestedBy: "Khách hàng",
      correlationId: "COR-260916-026",
      refundId: "RF-260916-026",
      verification: "verified",
    },
  },
  {
    id: "PAY-260916-027",
    createdAt: "2026-09-16T02:10:00.000Z",
    updatedAt: "2026-09-19T03:36:00.000Z",
    bookingId: "BK-260916-027",
    transactionCode: "VNP-9160027",
    amountVnd: 280000,
    status: "success",
    audit: {
      organizationName: "Đà Lạt Travel",
      history: [
        {
          occurredAt: "2026-09-16T02:10:00.000Z",
          description: "Khởi tạo thanh toán • Nguồn: khách hàng, cổng VNPay.",
        },
        {
          occurredAt: "2026-09-16T02:12:00.000Z",
          description:
            "Thành công • VNPay xác nhận giao dịch; hệ thống ghi nhận tiền đã thu.",
        },
      ],
      collectedVnd: 280000,
      refundedVnd: 0,
      collectionState: "success",
      provider: "VNPay",
      partnerCode: "VNP-9160027",
      requestedBy: "Khách hàng",
      correlationId: "COR-260916-027",
      verification: "verified",
    },
  },
] satisfies AdminPayment[];

export const figmaRefunds = [
  {
    id: "RF-260916-018",
    createdAt: "2026-09-19T02:00:00.000Z",
    updatedAt: "2026-09-19T03:36:00.000Z",
    bookingId: "BK-260916-018",
    paymentId: "PAY-260916-018",
    amountVnd: 576000,
    status: "processing",
    audit: {
      organizationName: "BlueLine Co.",
      history: [
        {
          occurredAt: "2026-09-19T02:00:00.000Z",
          description:
            "Ghi nhận yêu cầu hoàn • Nguồn: luồng khách hủy vé; số tiền tính từ giá và chính sách đã chốt.",
        },
        {
          occurredAt: "2026-09-19T02:01:00.000Z",
          description: "Đang xử lý • Hệ thống gửi khoản hoàn qua VNPay.",
        },
        {
          occurredAt: "2026-09-19T03:36:00.000Z",
          description:
            "Chờ kết quả cuối • Chưa xác nhận hoàn thành; số tiền đã hoàn thành công vẫn là 0đ.",
        },
      ],
      collectedVnd: 640000,
      refundedVnd: 0,
      transferState: "processing",
      reason: "customer-cancellation",
      requestedVia: "Luồng hủy vé",
      correlationId: "COR-260919-RF-018",
      cancelledTicketVnd: 640000,
      cancellationFeeVnd: 64000,
      expectedRefundVnd: 576000,
    },
  },
  {
    id: "RF-260916-020",
    createdAt: "2026-09-19T02:00:00.000Z",
    updatedAt: "2026-09-19T03:36:00.000Z",
    bookingId: "BK-260916-020",
    paymentId: "PAY-260916-020",
    amountVnd: 448000,
    status: "completed",
    audit: {
      organizationName: "Đà Lạt Travel",
      history: [
        {
          occurredAt: "2026-09-19T02:00:00.000Z",
          description:
            "Ghi nhận yêu cầu hoàn • Nguồn: luồng khách hủy vé; số tiền tính từ giá và chính sách đã chốt.",
        },
        {
          occurredAt: "2026-09-19T02:01:00.000Z",
          description: "Đang xử lý • Hệ thống gửi khoản hoàn qua VNPay.",
        },
        {
          occurredAt: "2026-09-19T02:05:00.000Z",
          description:
            "Thành công • VNPay xác nhận đã hoàn tiền; hệ thống ghi nhận số tiền thực hoàn.",
        },
      ],
      collectedVnd: 560000,
      refundedVnd: 448000,
      transferState: "completed",
      reason: "customer-cancellation",
      requestedVia: "Luồng hủy vé",
      correlationId: "COR-260919-RF-020",
      cancelledTicketVnd: 560000,
      cancellationFeeVnd: 112000,
      expectedRefundVnd: 448000,
    },
  },
  {
    id: "RF-260916-022",
    createdAt: "2026-09-19T02:00:00.000Z",
    updatedAt: "2026-09-19T03:36:00.000Z",
    bookingId: "BK-260916-022",
    paymentId: "PAY-260916-022",
    amountVnd: 490000,
    status: "failed",
    audit: {
      organizationName: "Sài Gòn Express",
      history: [
        {
          occurredAt: "2026-09-19T02:00:00.000Z",
          description:
            "Ghi nhận yêu cầu hoàn • Nguồn: luồng khách hủy vé; số tiền tính từ giá và chính sách đã chốt.",
        },
        {
          occurredAt: "2026-09-19T02:01:00.000Z",
          description: "Đang xử lý • Hệ thống gửi khoản hoàn qua VNPay.",
        },
        {
          occurredAt: "2026-09-19T02:05:00.000Z",
          description:
            "Thất bại • VNPay trả kết quả hoàn không thành công; chưa ghi nhận tiền hoàn, không khôi phục vé.",
        },
      ],
      collectedVnd: 700000,
      refundedVnd: 0,
      transferState: "failed",
      reason: "customer-cancellation",
      requestedVia: "Luồng hủy vé",
      correlationId: "COR-260919-RF-022",
      cancelledTicketVnd: 700000,
      cancellationFeeVnd: 210000,
      expectedRefundVnd: 490000,
    },
  },
  {
    id: "RF-260916-023",
    createdAt: "2026-09-19T02:00:00.000Z",
    updatedAt: "2026-09-19T03:36:00.000Z",
    bookingId: "BK-260916-023",
    paymentId: "PAY-260916-023",
    amountVnd: 432000,
    status: "completed",
    audit: {
      organizationName: "Hải Vân Transport",
      history: [
        {
          occurredAt: "2026-09-19T02:00:00.000Z",
          description:
            "Ghi nhận yêu cầu hoàn • Nguồn: luồng khách hủy vé; số tiền tính từ giá và chính sách đã chốt.",
        },
        {
          occurredAt: "2026-09-19T02:01:00.000Z",
          description: "Đang xử lý • Hệ thống gửi khoản hoàn qua VNPay.",
        },
        {
          occurredAt: "2026-09-19T02:05:00.000Z",
          description:
            "Thành công • VNPay xác nhận đã hoàn tiền; hệ thống ghi nhận số tiền thực hoàn.",
        },
      ],
      collectedVnd: 480000,
      refundedVnd: 432000,
      transferState: "completed",
      reason: "customer-cancellation",
      requestedVia: "Luồng hủy vé",
      correlationId: "COR-260919-RF-023",
      cancelledTicketVnd: 480000,
      cancellationFeeVnd: 48000,
      expectedRefundVnd: 432000,
    },
  },
  {
    id: "RF-260916-025",
    createdAt: "2026-09-19T02:00:00.000Z",
    updatedAt: "2026-09-19T03:36:00.000Z",
    bookingId: "BK-260916-025",
    paymentId: "PAY-260916-025",
    amountVnd: 640000,
    status: "processing",
    audit: {
      organizationName: "BlueLine Co.",
      history: [
        {
          occurredAt: "2026-09-19T02:00:00.000Z",
          description:
            "Ghi nhận yêu cầu hoàn • Nguồn: nhà xe hủy chuyến; hoàn toàn bộ, không thu phí hủy.",
        },
        {
          occurredAt: "2026-09-19T03:36:00.000Z",
          description:
            "Chờ xử lý • Chưa có kết quả chuyển hoàn; chưa ghi nhận tiền đã hoàn.",
        },
      ],
      collectedVnd: 640000,
      refundedVnd: 0,
      transferState: "queued",
      reason: "operator-cancellation",
      requestedVia: "Luồng hủy vé",
      correlationId: "COR-260919-RF-025",
      cancelledTicketVnd: 640000,
      cancellationFeeVnd: 0,
      expectedRefundVnd: 640000,
    },
  },
  {
    id: "RF-260916-026",
    createdAt: "2026-09-19T02:00:00.000Z",
    updatedAt: "2026-09-19T03:36:00.000Z",
    bookingId: "BK-260916-026",
    paymentId: "PAY-260916-026",
    amountVnd: 756000,
    status: "processing",
    audit: {
      organizationName: "RedLine Express",
      history: [
        {
          occurredAt: "2026-09-19T02:00:00.000Z",
          description:
            "Ghi nhận yêu cầu hoàn • Nguồn: luồng khách hủy vé; số tiền tính từ giá và chính sách đã chốt.",
        },
        {
          occurredAt: "2026-09-19T02:01:00.000Z",
          description: "Đang xử lý • Hệ thống gửi khoản hoàn qua VNPay.",
        },
        {
          occurredAt: "2026-09-19T03:36:00.000Z",
          description:
            "Chờ kết quả cuối • Chưa xác nhận hoàn thành; số tiền đã hoàn thành công vẫn là 0đ.",
        },
      ],
      collectedVnd: 840000,
      refundedVnd: 0,
      transferState: "processing",
      reason: "customer-cancellation",
      requestedVia: "Luồng hủy vé",
      correlationId: "COR-260919-RF-026",
      cancelledTicketVnd: 840000,
      cancellationFeeVnd: 84000,
      expectedRefundVnd: 756000,
    },
  },
] satisfies AdminRefund[];
