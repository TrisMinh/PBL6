import type {
  AdminBooking,
  AdminPayment,
  AdminRefund,
  Organization,
  Staff,
} from "@/features/admin/types/admin";
import {
  figmaBookings,
  figmaPayments,
  figmaRefunds,
} from "./adminTransactions";

function freezeRecords<T extends object>(items: T[]): readonly Readonly<T>[] {
  return Object.freeze(items.map((item) => Object.freeze(item)));
}

const figmaOrganizationRows = [
  ["ORG-001", "BlueLine Co.", "contact@blueline.vn"],
  ["ORG-002", "RedLine Express", "office@redline.vn"],
  ["ORG-003", "Đà Lạt Travel", "hello@dalattravel.vn"],
  ["ORG-004", "Sài Gòn Express", "hello@saigon.example"],
  ["ORG-005", "Miền Trung Travel", "contact@mientrung.example"],
  ["ORG-006", "Hải Vân Transport", "office@haivan.example"],
  ["ORG-007", "Mekong Bus", "hello@mekong.example"],
  ["ORG-008", "Quy Nhơn Travel", "contact@quynhon.example"],
  ["ORG-009", "An Phú Transit", "office@anphu.example"],
  ["ORG-010", "Bắc Nam Express", "hello@bacnam.example"],
] as const;

const figmaOrganizations: Organization[] = figmaOrganizationRows.map(
  ([id, name, contactEmail]) => ({
    id,
    name,
    contactEmail,
    contactName: "Liên hệ mô phỏng",
    contactPhone: id === "ORG-001" ? "02838224567" : "0000000000",
    status: id === "ORG-003" ? "inactive" : "active",
    createdAt: "2026-08-01T02:00:00.000Z",
    updatedAt: "2026-09-16T01:30:00.000Z",
    ...(id === "ORG-001"
      ? {
          legalName: "Công ty TNHH Vận tải BlueLine",
          taxId: "0312345678",
          address: "12 Nguyễn Huệ, TP. Hồ Chí Minh",
        }
      : {}),
  }),
);

export const adminOrganizations = freezeRecords<Organization>([
  ...figmaOrganizations,
  {
    id: "org-blue-demo",
    name: "BLUE Demo Transit",
    contactName: "Điều phối mô phỏng A",
    contactEmail: "ops-a@blue.example.invalid",
    contactPhone: "0000000101",
    status: "active",
    createdAt: "2026-01-10T02:00:00.000Z",
    updatedAt: "2026-10-01T03:00:00.000Z",
  },
  {
    id: "org-sunrise-demo",
    name: "Sunrise Demo Lines",
    contactName: "Điều phối mô phỏng B",
    contactEmail: "ops-b@sunrise.example.invalid",
    contactPhone: "0000000102",
    status: "active",
    createdAt: "2026-02-11T02:00:00.000Z",
    updatedAt: "2026-10-02T03:00:00.000Z",
  },
  {
    id: "org-river-demo",
    name: "River Demo Coach",
    contactName: "Điều phối mô phỏng C",
    contactEmail: "ops-c@river.example.invalid",
    contactPhone: "0000000103",
    status: "inactive",
    createdAt: "2026-03-12T02:00:00.000Z",
    updatedAt: "2026-10-03T03:00:00.000Z",
  },
]);

const figmaStaffRows = [
  [
    "USR-0018",
    "Nguyễn Hoàng Long",
    "ORG-001",
    "l***@blueline.vn",
    "09** *** 218",
    "OPERATOR_ADMIN",
  ],
  [
    "USR-0019",
    "Trần Thu Hà",
    "ORG-001",
    "h***@blueline.vn",
    "09** *** 820",
    "OPERATOR_SCHEDULER",
  ],
  [
    "USR-0021",
    "Hoàng Nam",
    "ORG-001",
    "n***@blueline.vn",
    "09** *** 456",
    "DRIVER",
  ],
  [
    "USR-0024",
    "Lê Minh Anh",
    "platform-blue",
    "a***@blue.vn",
    "09** *** 762",
    "PLATFORM_SUPPORT",
  ],
  [
    "USR-0031",
    "Phạm Ngọc Mai",
    "ORG-002",
    "m***@redline.vn",
    "09** *** 310",
    "OPERATOR_SCHEDULER",
  ],
  [
    "USR-0032",
    "Lê Minh Khang",
    "ORG-003",
    "k***@dalattravel.vn",
    "09** *** 311",
    "OPERATOR_SCHEDULER",
  ],
  [
    "USR-0033",
    "Võ Thành Đạt",
    "ORG-004",
    "d***@saigon.example",
    "09** *** 312",
    "OPERATOR_SCHEDULER",
  ],
  [
    "USR-0034",
    "Bùi Khánh Linh",
    "ORG-005",
    "l***@mientrung.example",
    "09** *** 313",
    "OPERATOR_SCHEDULER",
  ],
  [
    "USR-0035",
    "Đỗ Minh Anh",
    "ORG-006",
    "a***@haivan.example",
    "09** *** 314",
    "OPERATOR_SCHEDULER",
  ],
  [
    "USR-0036",
    "Hoàng Quốc Bảo",
    "ORG-007",
    "b***@mekong.example",
    "09** *** 315",
    "OPERATOR_SCHEDULER",
  ],
  [
    "USR-0037",
    "Ngô Lan Chi",
    "ORG-008",
    "c***@quynhon.example",
    "09** *** 316",
    "OPERATOR_SCHEDULER",
  ],
] as const;

const figmaStaff: Staff[] = figmaStaffRows.map(
  ([id, fullName, organizationId, displayEmail, displayPhone, role]) => ({
    id,
    fullName,
    organizationId,
    displayEmail,
    displayPhone,
    role,
    email: `test+${id.toLowerCase()}@example.invalid`,
    phone: "0000000000",
    status: id === "USR-0024" ? "inactive" : "active",
    createdAt: "2026-08-01T02:15:00.000Z",
    updatedAt: "2026-08-01T02:15:00.000Z",
    memberSince:
      id === "USR-0019"
        ? "2026-08-02"
        : id === "USR-0021"
          ? "2026-08-04"
          : "2026-08-01",
  }),
);

export const adminStaff = freezeRecords<Staff>([
  ...figmaStaff,
  {
    id: "staff-blue-01",
    organizationId: "org-blue-demo",
    fullName: "Nhân viên mô phỏng A",
    email: "staff-a@blue.example.invalid",
    phone: "0000000201",
    status: "active",
    createdAt: "2026-04-01T02:00:00.000Z",
    updatedAt: "2026-10-04T03:00:00.000Z",
  },
  {
    id: "staff-blue-02",
    organizationId: "org-blue-demo",
    fullName: "Nhân viên mô phỏng B",
    email: "staff-b@blue.example.invalid",
    phone: "0000000202",
    status: "inactive",
    createdAt: "2026-04-02T02:00:00.000Z",
    updatedAt: "2026-10-05T03:00:00.000Z",
  },
  {
    id: "staff-sunrise-01",
    organizationId: "org-sunrise-demo",
    fullName: "Nhân viên mô phỏng C",
    email: "staff-c@sunrise.example.invalid",
    phone: "0000000203",
    status: "active",
    createdAt: "2026-04-03T02:00:00.000Z",
    updatedAt: "2026-10-06T03:00:00.000Z",
  },
  {
    id: "staff-river-01",
    organizationId: "org-river-demo",
    fullName: "Nhân viên mô phỏng D",
    email: "staff-d@river.example.invalid",
    phone: "0000000204",
    status: "inactive",
    createdAt: "2026-04-04T02:00:00.000Z",
    updatedAt: "2026-10-07T03:00:00.000Z",
  },
]);

export const adminBookings = freezeRecords<AdminBooking>([
  ...figmaBookings,
  {
    id: "admin-booking-01",
    bookingCode: "BLUE-DEMO-001",
    organizationId: "org-blue-demo",
    customerName: "Khách mô phỏng 01",
    routeLabel: "TP. Hồ Chí Minh → Đà Lạt",
    passengerCount: 2,
    totalVnd: 600_000,
    status: "paid",
    createdAt: "2026-10-10T01:00:00.000Z",
    updatedAt: "2026-10-10T01:05:00.000Z",
  },
  {
    id: "admin-booking-02",
    bookingCode: "BLUE-DEMO-002",
    organizationId: "org-blue-demo",
    customerName: "Khách mô phỏng 02",
    routeLabel: "TP. Hồ Chí Minh → Đà Lạt",
    passengerCount: 1,
    totalVnd: 300_000,
    status: "pending-payment",
    createdAt: "2026-10-11T01:00:00.000Z",
    updatedAt: "2026-10-11T01:00:00.000Z",
  },
  {
    id: "admin-booking-03",
    bookingCode: "SUN-DEMO-001",
    organizationId: "org-sunrise-demo",
    customerName: "Khách mô phỏng 03",
    routeLabel: "Đà Nẵng → Hà Nội",
    passengerCount: 3,
    totalVnd: 1_350_000,
    status: "paid",
    createdAt: "2026-10-12T01:00:00.000Z",
    updatedAt: "2026-10-12T01:06:00.000Z",
  },
  {
    id: "admin-booking-04",
    bookingCode: "SUN-DEMO-002",
    organizationId: "org-sunrise-demo",
    customerName: "Khách mô phỏng 04",
    routeLabel: "Đà Nẵng → Hà Nội",
    passengerCount: 1,
    totalVnd: 450_000,
    status: "cancelled",
    createdAt: "2026-10-13T01:00:00.000Z",
    updatedAt: "2026-10-13T02:00:00.000Z",
  },
  {
    id: "admin-booking-05",
    bookingCode: "RIVER-DEMO-001",
    organizationId: "org-river-demo",
    customerName: "Khách mô phỏng 05",
    routeLabel: "Huế → Đà Nẵng",
    passengerCount: 2,
    totalVnd: 500_000,
    status: "paid",
    createdAt: "2026-10-14T01:00:00.000Z",
    updatedAt: "2026-10-14T01:04:00.000Z",
  },
]);

export const adminPayments = freezeRecords<AdminPayment>([
  ...figmaPayments,
  {
    id: "admin-payment-01",
    bookingId: "admin-booking-01",
    transactionCode: "VNP-DEMO-001",
    amountVnd: 600_000,
    status: "success",
    createdAt: "2026-10-10T01:01:00.000Z",
    updatedAt: "2026-10-10T01:05:00.000Z",
  },
  {
    id: "admin-payment-02",
    bookingId: "admin-booking-02",
    transactionCode: "VNP-DEMO-002",
    amountVnd: 300_000,
    status: "pending",
    createdAt: "2026-10-11T01:01:00.000Z",
    updatedAt: "2026-10-11T01:01:00.000Z",
  },
  {
    id: "admin-payment-03",
    bookingId: "admin-booking-03",
    transactionCode: "VNP-DEMO-003",
    amountVnd: 1_350_000,
    status: "success",
    createdAt: "2026-10-12T01:01:00.000Z",
    updatedAt: "2026-10-12T01:06:00.000Z",
  },
  {
    id: "admin-payment-04",
    bookingId: "admin-booking-04",
    transactionCode: "VNP-DEMO-004",
    amountVnd: 450_000,
    status: "cancelled",
    createdAt: "2026-10-13T01:01:00.000Z",
    updatedAt: "2026-10-13T02:00:00.000Z",
  },
  {
    id: "admin-payment-05",
    bookingId: "admin-booking-05",
    transactionCode: "VNP-DEMO-005",
    amountVnd: 500_000,
    status: "failed",
    createdAt: "2026-10-14T01:01:00.000Z",
    updatedAt: "2026-10-14T01:04:00.000Z",
  },
]);

export const adminRefunds = freezeRecords<AdminRefund>([
  ...figmaRefunds,
  {
    id: "admin-refund-01",
    bookingId: "admin-booking-04",
    paymentId: "admin-payment-04",
    amountVnd: 450_000,
    status: "processing",
    createdAt: "2026-10-13T02:00:00.000Z",
    updatedAt: "2026-10-13T02:00:00.000Z",
  },
  {
    id: "admin-refund-02",
    bookingId: "admin-booking-01",
    paymentId: "admin-payment-01",
    amountVnd: 300_000,
    status: "completed",
    createdAt: "2026-10-15T02:00:00.000Z",
    updatedAt: "2026-10-16T02:00:00.000Z",
  },
]);
