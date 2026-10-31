import type { AdminListParams } from "@/features/admin/schemas/adminListParams.schema";
import type {
  AdminBooking,
  AdminPayment,
  AdminRefund,
  Organization,
  OrganizationInput,
  Staff,
  StaffInput,
} from "@/features/admin/types/admin";
import type { PagedResult } from "@/features/admin/types/pagination";

export interface AdminAccess {
  sessionToken: string;
}

export interface AdminRepository {
  listOrganizations(
    params: AdminListParams,
    signal?: AbortSignal,
  ): Promise<PagedResult<Organization>>;
  getOrganization(id: string, signal?: AbortSignal): Promise<Organization>;
  createOrganization(
    input: OrganizationInput,
    signal?: AbortSignal,
  ): Promise<Organization>;
  updateOrganization(
    id: string,
    input: OrganizationInput,
    signal?: AbortSignal,
  ): Promise<Organization>;
  listStaff(
    params: AdminListParams,
    signal?: AbortSignal,
  ): Promise<PagedResult<Staff>>;
  getStaff(id: string, signal?: AbortSignal): Promise<Staff>;
  createStaff(input: StaffInput, signal?: AbortSignal): Promise<Staff>;
  updateStaff(
    id: string,
    input: StaffInput,
    signal?: AbortSignal,
  ): Promise<Staff>;
  listBookings(
    params: AdminListParams,
    signal?: AbortSignal,
  ): Promise<PagedResult<AdminBooking>>;
  getBooking(id: string, signal?: AbortSignal): Promise<AdminBooking>;
  listPayments(
    params: AdminListParams,
    signal?: AbortSignal,
  ): Promise<PagedResult<AdminPayment>>;
  getPayment(id: string, signal?: AbortSignal): Promise<AdminPayment>;
  listRefunds(
    params: AdminListParams,
    signal?: AbortSignal,
  ): Promise<PagedResult<AdminRefund>>;
  getRefund(id: string, signal?: AbortSignal): Promise<AdminRefund>;
}
