import { field } from "@/shared/api/fields";
import type { ReactElement } from "react";
import { Link } from "react-router";
import { LiveOrganizationCreate, LiveOrganizationMembers, LiveUserActions } from "./LiveAdminActions";
import { LivePayoutCreate } from "./LivePayoutCreate";
import { LiveRefundCreate } from "./LiveRefundCreate";
import {
  ResourcePage,
  ResourceDetailPage,
  type ApiColumn,
} from "@/shared/api/ResourcePage";

export function BackendAdminPage({
  resource,
}: {
  resource: string;
}): ReactElement {
  const columns: Record<string, ApiColumn[]> = {
    organizations: [
      { key: "name", label: "Tên tổ chức" },
      { key: "code", label: "Mã" },
      { key: "contactEmail", label: "Email" },
      { key: "contactPhone", label: "Điện thoại" },
      { key: "status", label: "Trạng thái" },
    ],
    users: [
      { key: "fullName", label: "Họ tên" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Điện thoại" },
      { key: "roles", label: "Vai trò" },
      { key: "status", label: "Trạng thái" },
    ],
    bookings: [
      { key: "code", label: "Mã đơn" },
      { key: "status", label: "Trạng thái" },
      { key: "total", label: "Tổng tiền (VND)" },
      { key: "paymentChannel", label: "Kênh thanh toán" },
    ],
    payments: [
      { key: "provider", label: "Cổng thanh toán" },
      { key: "amount", label: "Số tiền (VND)" },
      { key: "status", label: "Trạng thái" },
    ],
    refunds: [
      { key: "refundReference", label: "Mã hoàn tiền" },
      { key: "amount", label: "Số tiền (VND)" },
      { key: "reason", label: "Lý do" },
      { key: "status", label: "Trạng thái" },
    ],
    settlements: [
      { key: "bookingId", label: "Mã đặt vé" },
      { key: "organizationId", label: "Nhà xe" },
      { key: "grossAmount", label: "Doanh thu (VND)" },
      { key: "commissionAmount", label: "Hoa hồng (VND)" },
      { key: "operatorNet", label: "Nhà xe nhận (VND)" },
      { key: "collectionStatus", label: "Trạng thái thu" },
    ],
  };
  const first = columns[resource][0];
  // Settlements have no detail endpoint, so their rows are not linked.
  if (resource !== "settlements")
    columns[resource][0] = {
      ...first,
      render: (row) => (
        <Link
          to={`/admin/${resource === "users" ? "staff" : resource}/${row.id}`}
        >
          {field(row, first.key)}
        </Link>
      ),
    };
  return (
    <ResourcePage
      title={
        {
          organizations: "Tổ chức",
          users: "Người dùng",
          bookings: "Đặt vé",
          payments: "Thanh toán",
          refunds: "Hoàn tiền",
          settlements: "Đối soát nhà xe",
        }[resource] ?? resource
      }
      endpoint={`/api/v1/admin/${resource}`}
      columns={columns[resource]}
    >
      {resource === "organizations" && <LiveOrganizationCreate />}
      {resource === "payments" && (
        <Link to="/admin/payments?view=settlements">Xem đối soát nhà xe</Link>
      )}
      {resource === "settlements" && (
        <>
          <Link to="/admin/payments">Quay lại thanh toán</Link>
          <LivePayoutCreate />
        </>
      )}
    </ResourcePage>
  );
}

export function BackendAdminDetailPage({
  resource,
  id,
}: {
  resource: string;
  id: string;
}): ReactElement {
  const endpoints: Record<string, string> = {
    users: "admin/users",
    organizations: "admin/organizations",
    bookings: "bookings",
    payments: "payments",
    refunds: "refunds",
  };
  const columns: Record<string, ApiColumn[]> = {
    users: [
      { key: "fullName", label: "Họ tên" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Điện thoại" },
      { key: "roles", label: "Vai trò" },
      { key: "status", label: "Trạng thái" },
    ],
    organizations: [
      { key: "name", label: "Tổ chức" },
      { key: "code", label: "Mã" },
      { key: "contactEmail", label: "Email" },
      { key: "contactPhone", label: "Điện thoại" },
      { key: "status", label: "Trạng thái" },
    ],
    bookings: [
      { key: "code", label: "Mã đơn" },
      { key: "contact.fullName", label: "Người liên hệ" },
      { key: "total", label: "Tổng tiền (VND)" },
      { key: "status", label: "Trạng thái" },
    ],
    payments: [
      { key: "provider", label: "Cổng thanh toán" },
      { key: "amount", label: "Số tiền (VND)" },
      { key: "status", label: "Trạng thái" },
    ],
    refunds: [
      { key: "refundReference", label: "Mã hoàn tiền" },
      { key: "reason", label: "Lý do" },
      { key: "amount", label: "Số tiền (VND)" },
      { key: "status", label: "Trạng thái" },
    ],
  };
  return (
    <>
      <ResourceDetailPage
        title="Chi tiết"
        endpoint={`/api/v1/${endpoints[resource]}/${encodeURIComponent(id)}`}
        columns={columns[resource]}
      />
      {resource === "users" && <LiveUserActions userId={id} />}
      {resource === "organizations" && <LiveOrganizationMembers organizationId={id} />}
      {resource === "payments" && <LiveRefundCreate paymentId={id} />}
    </>
  );
}
