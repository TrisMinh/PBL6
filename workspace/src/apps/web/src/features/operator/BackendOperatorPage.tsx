import {
  LiveBookingRefunds,
  LiveRefundPaymentLookup,
} from "./LiveRefundPaymentLookup";
import type { ReactElement } from "react";
import { field } from "@/shared/api/fields";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getLiveRows, liveQueryKey } from "@/shared/api/liveRequest";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { z } from "zod";
import { apiJson } from "@/shared/api/client";
import {
  ApiFailure,
  ResourcePage,
  ResourceDetailPage,
  type ApiColumn,
  type ApiRow,
} from "@/shared/api/ResourcePage";
import { Button } from "@/shared/ui/Button/Button";
import { getVietnamTodayDate } from "@/shared/lib/getVietnamTodayDate";
import {
  LiveCancelTrip,
  LiveDeactivate,
  LiveTripTransition,
  LiveVehicleSeats,
} from "./LiveOperatorForms";
import { LiveTicketCheckIn } from "./LiveTicketCheckIn";

function PublishTrip({ row }: { row: ApiRow }): ReactElement {
  const client = useQueryClient();
  const [key] = useState(() => crypto.randomUUID());
  const mutation = useMutation({
    mutationFn: () =>
      apiJson(`/api/v1/operator/trips/${row.id}/publish`, z.unknown(), {
        method: "POST",
        idempotencyKey: key,
        body: { expectedVersion: row.rowVersion },
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["live-api"] });
    },
    retry: false,
  });
  return (
    <>
      {row.status === "DRAFT" && (
        <Button
          isLoading={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Công bố chuyến
        </Button>
      )}
      {mutation.isError && <ApiFailure error={mutation.error} />}
    </>
  );
}
const configs: Record<
  string,
  { title: string; endpoint: string; columns: ApiColumn[] }
> = {
  trips: {
    title: "Lịch chuyến",
    endpoint: "/api/v1/operator/trips",
    columns: [
      {
        key: "origin",
        label: "Điểm đi",
        render: (row) => (
          <Link to={`/operator/trips/${row.id}`}>{field(row, "origin")}</Link>
        ),
      },
      { key: "destination", label: "Điểm đến" },
      {
        key: "departureAt",
        label: "Khởi hành",
        render: (r) =>
          new Date(String(r.departureAt)).toLocaleString("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh",
          }),
      },
      { key: "status", label: "Trạng thái" },
      {
        key: "transition",
        label: "Vận hành",
        render: (r) => <LiveTripTransition trip={r} />,
      },
      {
        key: "cancel",
        label: "Hủy chuyến",
        render: (r) => <LiveCancelTrip trip={r} />,
      },
      {
        key: "edit",
        label: "Sửa nháp",
        render: (r) =>
          r.status === "DRAFT" ? (
            <Link
              to={`/operator/trips/draft/edit?tripId=${encodeURIComponent(String(r.id))}`}
            >
              Sửa
            </Link>
          ) : (
            "—"
          ),
      },
      { key: "availableSeatCount", label: "Ghế trống" },
      {
        key: "manifest",
        label: "Hành khách",
        render: (r) => (
          <Link to={`/operator/bookings/trips/${r.id}/passengers`}>
            Danh sách
          </Link>
        ),
      },
      {
        key: "publish",
        label: "Thao tác",
        render: (r) => <PublishTrip row={r} />,
      },
    ],
  },
  vehicles: {
    title: "Xe của nhà xe",
    endpoint: "/api/v1/operator/buses",
    columns: [
      { key: "plateNumber", label: "Biển số" },
      { key: "type", label: "Loại xe" },
      { key: "amenities", label: "Tiện ích" },
      { key: "status", label: "Trạng thái" },
      {
        key: "edit",
        label: "Sửa",
        render: (r) => (
          <Link
            to={`/operator/vehicles?edit=${encodeURIComponent(String(r.id))}`}
          >
            Chỉnh sửa
          </Link>
        ),
      },
      {
        key: "deactivate",
        label: "Vô hiệu hóa",
        render: (r) =>
          r.status === "ACTIVE" ? (
            <LiveDeactivate
              endpoint={`/api/v1/operator/buses/${encodeURIComponent(String(r.id))}/deactivate`}
              label="xe"
            />
          ) : (
            "—"
          ),
      },
      {
        key: "seats",
        label: "Số ghế",
        render: (r) => (
          <details>
            <summary>
              {Array.isArray(r.seats)
                ? `${r.seats.length} ghế · Quản lý`
                : "Quản lý ghế"}
            </summary>
            <LiveVehicleSeats bus={r} />
          </details>
        ),
      },
    ],
  },
  drivers: {
    title: "Tài xế",
    endpoint: "/api/v1/operator/drivers",
    columns: [
      { key: "licenseNumber", label: "Số GPLX" },
      { key: "licenseExpiresOn", label: "Hạn GPLX" },
      { key: "status", label: "Trạng thái" },
      {
        key: "edit",
        label: "Sửa",
        render: (r) => (
          <Link
            to={`/operator/drivers/${encodeURIComponent(String(r.id))}/edit`}
          >
            Chỉnh sửa
          </Link>
        ),
      },
      {
        key: "deactivate",
        label: "Vô hiệu hóa",
        render: (r) =>
          r.status !== "INACTIVE" ? (
            <LiveDeactivate
              endpoint={`/api/v1/operator/drivers/${encodeURIComponent(String(r.id))}/deactivate`}
              label="tài xế"
            />
          ) : (
            "—"
          ),
      },
    ],
  },
  routes: {
    title: "Tuyến xe",
    endpoint: "/api/v1/operator/routes",
    columns: [
      { key: "name", label: "Tên tuyến" },
      { key: "origin", label: "Điểm đi" },
      { key: "destination", label: "Điểm đến" },
      { key: "distanceKm", label: "Khoảng cách (km)" },
      { key: "durationMinutes", label: "Thời gian (phút)" },
      { key: "status", label: "Trạng thái" },
      {
        key: "edit",
        label: "Sửa",
        render: (r) => (
          <Link
            to={`/operator/routes/${encodeURIComponent(String(r.id))}/edit`}
          >
            Chỉnh sửa
          </Link>
        ),
      },
      {
        key: "stops",
        label: "Điểm dừng",
        render: (r) => (
          <Link
            to={`/operator/routes?stops=${encodeURIComponent(String(r.id))}`}
          >
            Quản lý
          </Link>
        ),
      },
      {
        key: "deactivate",
        label: "Vô hiệu hóa",
        render: (r) =>
          r.status === "ACTIVE" ? (
            <LiveDeactivate
              endpoint={`/api/v1/operator/routes/${encodeURIComponent(String(r.id))}/deactivate`}
              label="tuyến"
            />
          ) : (
            "—"
          ),
      },
    ],
  },
  bookings: {
    title: "Đặt chỗ của nhà xe",
    endpoint: "/api/v1/operator/bookings",
    columns: [
      {
        key: "refund",
        label: "Thanh toán / hoàn tiền",
        render: (r) => (
          <Link
            to={`/operator/bookings?refundBooking=${encodeURIComponent(String(r.id))}`}
          >
            Xem giao dịch
          </Link>
        ),
      },
      { key: "code", label: "Mã đặt chỗ" },
      { key: "contact.fullName", label: "Người đặt" },
      { key: "status", label: "Trạng thái" },
      { key: "paymentChannel", label: "Thanh toán" },
      { key: "total", label: "Tổng tiền (VND)" },
    ],
  },
  refunds: {
    title: "Hủy vé và hoàn tiền của nhà xe",
    endpoint: "/api/v1/operator/refunds",
    columns: [
      {
        key: "refundReference",
        label: "Mã hoàn tiền",
        render: (r) => (
          <Link
            to={`/operator/refund-requests/${encodeURIComponent(String(r.id))}`}
          >
            {field(r, "refundReference")}
          </Link>
        ),
      },
      { key: "amount", label: "Số tiền (VND)" },
      { key: "reason", label: "Lý do" },
      { key: "status", label: "Trạng thái" },
    ],
  },
  settlements: {
    title: "Đối soát",
    endpoint: "/api/v1/operator/settlements",
    columns: [
      { key: "paymentChannel", label: "Kênh thanh toán" },
      { key: "grossAmount", label: "Tổng tiền" },
      { key: "commissionAmount", label: "Hoa hồng" },
      { key: "operatorNet", label: "Nhà xe nhận" },
      { key: "collectionStatus", label: "Trạng thái" },
    ],
  },
};
export function BackendOperatorPage({
  resource,
}: {
  resource: string;
}): ReactElement {
  const [search] = useSearchParams();
  const refundBookingId = z
    .string()
    .uuid()
    .safeParse(search.get("refundBooking"));
  const config =
    resource === "passengerTrips"
      ? {
          ...configs.trips,
          title: "Danh sách hành khách theo chuyến",
          columns: configs.trips.columns.filter((column) =>
            [
              "origin",
              "destination",
              "departureAt",
              "status",
              "manifest",
            ].includes(column.key),
          ),
        }
      : configs[resource];
  if (!config)
    return (
      <section className="live-api">
        <h1>Chức năng chưa hỗ trợ</h1>
        <p>
          Chức năng này chưa được kết nối. Bạn có thể xem dữ liệu tại các danh
          sách hiện có.
        </p>
        <Link to="/operator/trips">Lịch chuyến</Link>
      </section>
    );
  const createLinks: Record<string, [string, string]> = {
    trips: ["/operator/trips/new", "Tạo chuyến"],
    vehicles: ["/operator/vehicles?new=1", "Thêm xe"],
    drivers: ["/operator/drivers/new", "Thêm tài xế"],
    routes: ["/operator/routes/new", "Tạo tuyến"],
  };
  return (
    <ResourcePage {...config} operator>
      {resource === "bookings" && refundBookingId.success && (
        <LiveBookingRefunds
          key={refundBookingId.data}
          bookingId={refundBookingId.data}
        />
      )}
      {resource === "refunds" && <LiveRefundPaymentLookup />}
      {createLinks[resource] && (
        <Link to={createLinks[resource][0]}>{createLinks[resource][1]}</Link>
      )}
    </ResourcePage>
  );
}
export function BackendManifestPage(): ReactElement {
  const { tripId = "" } = useParams();
  return (
    <ResourcePage
      title="Danh sách hành khách"
      endpoint={`/api/v1/operator/trips/${encodeURIComponent(tripId)}/manifest`}
      operator
      columns={[
        { key: "passengerName", label: "Hành khách" },
        { key: "seatCode", label: "Ghế" },
        { key: "pickupStopName", label: "Điểm đón" },
        { key: "status", label: "Trạng thái vé" },
      ]}
    >
      <LiveTicketCheckIn tripId={tripId} />
    </ResourcePage>
  );
}
/** The route keeps its old :bookingCode parameter for the mock UI; live URLs use a refund UUID. */
export function BackendOperatorRefundDetailPage(): ReactElement {
  const { bookingCode = "" } = useParams();
  if (!z.string().uuid().safeParse(bookingCode).success)
    return (
      <section className="live-api">
        <h1>Chi tiết hoàn tiền</h1>
        <p>Mã yêu cầu không hợp lệ. Hãy chọn từ danh sách.</p>
        <Link to="/operator/refund-requests">Quay lại yêu cầu hoàn tiền</Link>
      </section>
    );
  return (
    <section className="live-api">
      <Link to="/operator/refund-requests">← Danh sách yêu cầu</Link>
      <ResourceDetailPage
        title="Chi tiết hoàn tiền"
        endpoint={`/api/v1/refunds/${encodeURIComponent(bookingCode)}`}
        columns={[
          { key: "refundReference", label: "Mã hoàn tiền" },
          { key: "bookingId", label: "Đơn đặt vé" },
          { key: "paymentId", label: "Thanh toán" },
          { key: "amount", label: "Số tiền (VND)" },
          { key: "currency", label: "Tiền tệ" },
          { key: "reason", label: "Lý do" },
          { key: "status", label: "Trạng thái" },
        ]}
      />
    </section>
  );
}
export function BackendTripDetailPage(): ReactElement {
  const { tripId = "" } = useParams();
  const trips = useQuery({
    queryKey: liveQueryKey("operator-schedule"),
    queryFn: ({ signal }) => getLiveRows("/api/v1/operator/trips", signal),
    retry: false,
  });
  const trip = trips.data?.find((row) => row.id === tripId);
  return (
    <>
      <section className="live-api">
        <header>
          <div>
            <Link to="/operator/trips">← Lịch chuyến</Link>
            <h1>Quản lý chuyến đi</h1>
            <p>Theo dõi hành trình và cập nhật vận hành chuyến.</p>
          </div>
          <Link
            to={`/operator/bookings/trips/${encodeURIComponent(tripId)}/passengers`}
          >
            Danh sách hành khách →
          </Link>
        </header>
        {trips.isError && (
          <ApiFailure error={trips.error} retry={() => void trips.refetch()} />
        )}
        {trip && (
          <div className="live-api__tools">
            <PublishTrip row={trip} />
            <LiveTripTransition trip={trip} />
            {trip.status === "DRAFT" && (
              <Link
                to={`/operator/trips/draft/edit?tripId=${encodeURIComponent(tripId)}`}
              >
                Chỉnh sửa bản nháp
              </Link>
            )}
            <LiveCancelTrip trip={trip} />
          </div>
        )}
      </section>
      <ResourceDetailPage
        title="Chi tiết chuyến"
        endpoint={`/api/v1/trips/${encodeURIComponent(tripId)}`}
        columns={[
          { key: "origin", label: "Điểm đi" },
          { key: "destination", label: "Điểm đến" },
          { key: "operatorName", label: "Nhà xe" },
          { key: "departureAt", label: "Khởi hành" },
          { key: "arrivalAt", label: "Đến nơi" },
          { key: "fare.amount", label: "Giá vé (VND)" },
          { key: "status", label: "Trạng thái" },
        ]}
      />
    </>
  );
}
export function BackendReportsPage({
  initial = "revenue",
}: {
  initial?: "revenue" | "bookings" | "occupancy";
}): ReactElement {
  const today = getVietnamTodayDate();
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [metric, setMetric] = useState(initial);
  const fields = {
    revenue: [
      ["periodDate", "Kỳ"],
      ["grossRevenue", "Doanh thu gộp"],
      ["refundAmount", "Đã hoàn"],
      ["netRevenue", "Doanh thu ròng"],
    ],
    bookings: [
      ["bookingCode", "Mã đơn"],
      ["status", "Trạng thái"],
      ["grossAmount", "Tổng tiền"],
      ["bookedAt", "Ngày đặt"],
    ],
    occupancy: [
      ["routeName", "Tuyến"],
      ["departureAt", "Khởi hành"],
      ["bookedCount", "Ghế đã đặt"],
      ["capacity", "Sức chứa"],
    ],
  };
  const params = new URLSearchParams({
    from: `${from}T00:00:00+07:00`,
    to: `${to}T23:59:59+07:00`,
    timezone: "Asia/Ho_Chi_Minh",
  });
  return (
    <ResourcePage
      title="Báo cáo nhà xe"
      endpoint={`/api/v1/reports/${metric}?${params}`}
      operator
      columns={[
        ...fields[metric].map(([key, label]) => ({
          key,
          label,
          render: (row: ApiRow) =>
            field(row, key in row ? key : key.toLowerCase()),
        })),
      ]}
    >
      <form onSubmit={(e) => e.preventDefault()}>
        <label>
          Báo cáo
          <select
            value={metric}
            onChange={(e) => {
              const value = e.target.value;
              if (
                value === "revenue" ||
                value === "bookings" ||
                value === "occupancy"
              )
                setMetric(value);
            }}
          >
            <option value="revenue">Doanh thu</option>
            <option value="bookings">Đặt vé</option>
            <option value="occupancy">Lấp đầy ghế</option>
          </select>
        </label>
        <label>
          Từ ngày
          <input
            type="date"
            required
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value || from)}
          />
        </label>
        <label>
          Đến ngày
          <input
            type="date"
            required
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value || to)}
          />
        </label>
      </form>
    </ResourcePage>
  );
}

/** Use the same organization-scoped payment query as the list; never expose other operators' refunds. */
export function BackendRefundDetailPage(): ReactElement {
  const { bookingCode = "" } = useParams();
  return (
    <ResourceDetailPage
      title="Chi tiết hoàn tiền"
      endpoint={`/api/v1/operator/refunds/${encodeURIComponent(bookingCode)}`}
      columns={[
        { key: "refundReference", label: "Mã hoàn tiền" },
        { key: "bookingId", label: "Đơn đặt vé" },
        { key: "amount", label: "Số tiền (VND)" },
        { key: "currency", label: "Tiền tệ" },
        { key: "reason", label: "Lý do" },
        { key: "status", label: "Trạng thái" },
      ]}
    />
  );
}
