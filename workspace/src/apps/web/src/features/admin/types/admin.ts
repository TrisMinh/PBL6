import type {
  BookingAudit,
  PaymentAudit,
  RefundAudit,
} from "@/features/admin/transactions/transactionAudit.schema";

export type OrganizationStatus = "active" | "inactive";

export type StaffStatus = "active" | "inactive";

export type AdminBookingStatus = "pending-payment" | "paid" | "cancelled";

export type AdminPaymentStatus = "pending" | "success" | "failed" | "cancelled";

export type AdminRefundStatus = "processing" | "completed" | "failed";

/** Plain number whose runtime boundary must enforce an integer VND value. */
export type VndAmount = number;

/** Plain string whose runtime boundary must enforce an ISO-8601 timestamp. */
export type IsoTimestamp = string;

export type AdminListStatus =
  | OrganizationStatus
  | StaffStatus
  | AdminBookingStatus
  | AdminPaymentStatus
  | AdminRefundStatus;

export interface Organization {
  id: string;
  name: string;
  contactName?: string;
  contactEmail: string;
  contactPhone: string;
  status: OrganizationStatus;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  legalName?: string;
  taxId?: string;
  address?: string;
}

export type StaffRole =
  "OPERATOR_ADMIN" | "OPERATOR_SCHEDULER" | "DRIVER" | "PLATFORM_SUPPORT";

export interface Membership {
  staffId: string;
  organizationId: string;
  role: Exclude<StaffRole, "PLATFORM_SUPPORT">;
  status: StaffStatus;
  reason: string;
  memberSince: string;
}

export type MembershipInput = Omit<Membership, "memberSince">;

export interface Staff {
  id: string;
  organizationId: string;
  fullName: string;
  email: string;
  phone: string;
  status: StaffStatus;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  displayEmail?: string;
  displayPhone?: string;
  role?: StaffRole;
  memberSince?: string;
  membershipReason?: string;
}

export interface AdminBooking {
  audit?: BookingAudit;
  id: string;
  bookingCode: string;
  organizationId: string;
  customerName: string;
  routeLabel: string;
  passengerCount: number;
  totalVnd: VndAmount;
  status: AdminBookingStatus;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface AdminPayment {
  audit?: PaymentAudit;
  id: string;
  bookingId: string;
  transactionCode: string;
  amountVnd: VndAmount;
  status: AdminPaymentStatus;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface AdminRefund {
  audit?: RefundAudit;
  id: string;
  bookingId: string;
  paymentId: string;
  amountVnd: VndAmount;
  status: AdminRefundStatus;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export type OrganizationInput = Pick<
  Organization,
  | "name"
  | "contactName"
  | "contactEmail"
  | "contactPhone"
  | "status"
  | "legalName"
  | "taxId"
  | "address"
>;

export type StaffInput = Pick<
  Staff,
  | "organizationId"
  | "fullName"
  | "email"
  | "phone"
  | "status"
  | "role"
  | "membershipReason"
>;
