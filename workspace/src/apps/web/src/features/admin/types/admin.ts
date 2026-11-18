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
  | AdminRefundStatus
  | "awaiting-refund"
  | "refunded"
  | "expired"
  | "confirmed"
  | "completed"
  | "partially-refunded"
  | "queued";

export interface LiveTransactionDetails {
  state: string;
  label: string;
  rawStatus: string;
  organizationId?: string;
  organizationName?: string;
  provider?: string;
  partnerCode?: string;
  bookingCode?: string;
  paymentCode?: string;
  paymentCodes?: Record<string, string>;
  refundCodes?: Record<string, string>;
  reason?: string;
  departureAt?: string;
  seats?: string[];
  ticketState?: string;
  paymentIds?: string[];
  refundIds?: string[];
  collectedVnd?: number;
  refundedVnd?: number;
  cancellationFee?: number;
  expectedRefundVnd?: number;
  history: { occurredAt: string; description: string }[];
}

export interface Organization {
  id: string;
  code?: string;
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
  memberships?: Membership[];
  accountStatus?: string;
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
  live?: LiveTransactionDetails;
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
  live?: LiveTransactionDetails;
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
  live?: LiveTransactionDetails;
  audit?: RefundAudit;
  id: string;
  refundReference?: string;
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
