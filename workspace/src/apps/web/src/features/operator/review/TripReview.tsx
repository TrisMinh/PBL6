import { useRef, type ReactElement } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router";
import { z } from "zod";
import { liveApiJson, liveQueryKey } from "@/shared/api/liveRequest";
import { Button } from "@/shared/ui/Button/Button";
import { formatCurrencyVnd } from "@/shared/lib/formatCurrencyVnd";
import {
  busLabel,
  canPublishTrip,
  displayDate,
  driverLabel,
  getPublicTrip,
  rememberedDriver,
  rememberedTripId,
  resourceIssues,
  useOperatorTrip,
  useTripResources,
  vietnamLocal,
} from "../tripWorkflow";
import {
  CancellationPolicy,
  PublicTripLink,
  TripFact,
  TripStops,
  TripWorkflowShell,
  WorkflowError,
} from "../TripWorkflowUI";

export function TripReviewPage(): ReactElement {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tripId = params.get("tripId") ?? rememberedTripId();
  const query = useOperatorTrip(tripId),
    resources = useTripResources();
  const client = useQueryClient();
  const lock = useRef(false);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!canPublishTrip())
        throw Error("Bạn không có quyền phát hành chuyến này.");
      const [routes, buses, drivers] = await Promise.all([
        resources.routes.refetch(),
        resources.buses.refetch(),
        resources.drivers.refetch(),
      ]);
      const error = routes.error ?? buses.error ?? drivers.error;
      if (error) throw error;
      const issues = resourceIssues(
        buses.data?.find((b) => b.id === query.data?.busId),
        drivers.data?.find(
          (d) => d.id === (query.data?.driverId ?? rememberedDriver(tripId)),
        ),
        query.data?.arrivalAt ?? "",
        routes.data?.find((r) => r.id === query.data?.routeId),
      );
      if (issues.length) throw Error(issues.join(" "));
      return liveApiJson(
        `/api/v1/operator/trips/${tripId}/publish`,
        z.unknown(),
        {
          method: "POST",
          idempotent: true,
          body: { expectedVersion: query.data?.rowVersion },
        },
      );
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["live-api"] });
      void navigate(
        `/operator/trips?${new URLSearchParams({
          highlight: tripId,
          date: vietnamLocal(query.data?.departureAt ?? "").slice(0, 10),
        })}`,
        { replace: true, state: { publishedTripId: tripId } },
      );
    },
    onSettled: () => {
      lock.current = false;
    },
    retry: false,
  });
  const closed =
    !!query.data &&
    ["CANCELLED", "COMPLETED", "DEPARTED"].includes(query.data.status);
  const published = !!query.data && query.data.status !== "DRAFT";
  const inventory = useQuery({
    queryKey: liveQueryKey("published-trip-inventory", tripId),
    queryFn: ({ signal }) => getPublicTrip(tripId, signal),
    enabled: !!tripId && published && !closed,
    refetchInterval: (q) =>
      q.state.data?.sellable || q.state.error || q.state.dataUpdateCount >= 30
        ? false
        : 2000,
    retry: false,
  });
  const trip = inventory.data ?? query.data;
  const route = resources.routes.data?.find(
    (r) => r.id === query.data?.routeId,
  );
  const bus = resources.buses.data?.find((b) => b.id === query.data?.busId);
  const driver = resources.drivers.data?.find(
    (d) => d.id === (query.data?.driverId ?? rememberedDriver(tripId)),
  );
  const issues = query.data
    ? resourceIssues(bus, driver, query.data.arrivalAt, route)
    : [];
  const ready = trip?.sellable === true;
  const error = query.error ?? resources.error;
  const retry = (): void => {
    void query.refetch();
    void resources.buses.refetch();
    void resources.drivers.refetch();
    void resources.routes.refetch();
  };
  if (closed)
    return (
      <TripWorkflowShell
        title="Thông tin chuyến"
        status="Chuyến không còn mở bán"
        review
      >
        <section className="operator-create__panel">
          <h2>Chuyến không thể phát hành</h2>
          <p>
            Chuyến đã hủy, khởi hành hoặc hoàn tất. Vui lòng trở lại lịch
            chuyến.
          </p>
          <Link to="/operator/trips">Về lịch chuyến</Link>
        </section>
      </TripWorkflowShell>
    );
  return (
    <TripWorkflowShell
      title="Kiểm tra & phát hành chuyến"
      status={
        published
          ? ready
            ? "Chuyến đã mở bán"
            : "Đang chuẩn bị ghế"
          : "Bản nháp đã lưu"
      }
      review
    >
      {!tripId ? (
        <div className="operator-create__panel">
          <h2>Chưa chọn bản nháp</h2>
          <p>Tạo hoặc mở bản nháp từ lịch chuyến để kiểm tra.</p>
          <Link to="/operator/trips/new">Tạo chuyến mới</Link>
        </div>
      ) : error ? (
        <WorkflowError error={error} retry={retry} />
      ) : query.isPending || resources.pending ? (
        <div className="operator-create__panel" role="status">
          Đang tải thông tin chuyến…
        </div>
      ) : (
        trip && (
          <>
            <WorkflowError error={mutation.error} retry={retry} />
            <div className="operator-create__columns">
              <div>
                <section className="operator-create__panel operator-review__route">
                  <div className="operator-trip-workflow__panel-title">
                    <h2>Tuyến &amp; thời gian</h2>
                    {!published && (
                      <Link to={`/operator/trips/draft/edit?tripId=${tripId}`}>
                        Chỉnh sửa
                      </Link>
                    )}
                  </div>
                  <p>Kiểm tra hành trình và thời gian trước khi mở bán.</p>
                  <div className="operator-create__two">
                    <TripFact label="Điểm đi">{trip.origin}</TripFact>
                    <TripFact label="Điểm đến">{trip.destination}</TripFact>
                  </div>
                  <div className="operator-create__two">
                    <TripFact label="Khởi hành">
                      {displayDate(trip.departureAt)}
                    </TripFact>
                    <TripFact label="Đến nơi">
                      {displayDate(trip.arrivalAt)}
                    </TripFact>
                  </div>
                  <TripStops trip={trip} />
                </section>
                <section className="operator-create__panel operator-review__crew">
                  <h2>Xe &amp; nhân sự</h2>
                  <p>Thông tin phân công cho chuyến đi.</p>
                  <div className="operator-create__two">
                    <TripFact label="Phương tiện">
                      {bus?.plateNumber ?? "Chưa xác định"}
                    </TripFact>
                    <TripFact label="Tài xế">
                      {driver
                        ? driverLabel(driver)
                        : "Chưa xác định — chọn lại trong bản nháp"}
                    </TripFact>
                  </div>
                  <div className="operator-create__three">
                    <TripFact label="Loại xe">{busLabel(bus)}</TripFact>
                    <TripFact label="Sức chứa">
                      {bus ? `${bus.seats.length} chỗ` : "Chưa xác định"}
                    </TripFact>
                    <TripFact label="GPLX có hiệu lực đến">
                      {driver
                        ? driver.licenseExpiresOn.split("-").reverse().join("/")
                        : "Chưa xác định"}
                    </TripFact>
                  </div>
                </section>
                {published && (
                  <section
                    className="operator-trip-workflow__success"
                    role="status"
                  >
                    <h2>
                      {ready
                        ? "Chuyến đã mở bán"
                        : "Đã phát hành, đang chuẩn bị ghế"}
                    </h2>
                    <p>
                      {ready
                        ? "Hành trình đã sẵn sàng để khách hàng tìm kiếm và đặt vé."
                        : "Chuyến sẽ được mở bán sau khi hệ thống chuẩn bị xong sơ đồ ghế."}
                    </p>
                    {ready && <PublicTripLink trip={trip} />}
                    {!ready && !inventory.isFetching && (
                      <Button
                        variant="secondary"
                        onClick={() => void inventory.refetch()}
                      >
                        Kiểm tra lại trạng thái ghế
                      </Button>
                    )}
                    <WorkflowError
                      error={inventory.error}
                      retry={() => void inventory.refetch()}
                    />
                  </section>
                )}
              </div>
              <aside>
                <section className="operator-create__panel operator-review__fare">
                  <h2>Giá vé &amp; chính sách hủy</h2>
                  <p>Áp dụng cho chuyến đang kiểm tra.</p>
                  <TripFact label="Giá vé mỗi ghế">
                    {formatCurrencyVnd(trip.fare.amount)}
                  </TripFact>
                  <CancellationPolicy />
                </section>
                <section className="operator-create__panel operator-review__validation">
                  <h2>
                    {published ? "Trạng thái mở bán" : "Kiểm tra nguồn lực"}
                  </h2>
                  {published ? (
                    <p>
                      {ready
                        ? "Ghế đã sẵn sàng, chuyến được phép bán."
                        : "Đang chờ hệ thống chuẩn bị ghế."}
                    </p>
                  ) : (
                    <>
                      <ul className="operator-trip-workflow__checks">
                        {issues.length ? (
                          issues.map((issue) => (
                            <li
                              className="operator-trip-workflow__invalid"
                              key={issue}
                            >
                              {issue}
                            </li>
                          ))
                        ) : (
                          <>
                            <li>Xe và tài xế đang hoạt động.</li>
                            <li>GPLX còn hạn đến ngày kết thúc chuyến.</li>
                            <li>Xe có sơ đồ ghế được phép bán.</li>
                          </>
                        )}
                      </ul>
                      <p>
                        Xung đột lịch được kiểm tra khi bạn xác nhận phát hành.
                      </p>
                    </>
                  )}
                </section>
              </aside>
            </div>
            <footer className="operator-create__actions">
              {published ? (
                <Link className="button button--primary" to="/operator/trips">
                  Về lịch chuyến
                </Link>
              ) : (
                <>
                  <Link to={`/operator/trips/draft/edit?tripId=${tripId}`}>
                    Quay lại chỉnh sửa
                  </Link>
                  <button
                    type="button"
                    className="button button--primary"
                    disabled={
                      !canPublishTrip() ||
                      issues.length > 0 ||
                      mutation.isPending
                    }
                    aria-busy={mutation.isPending || undefined}
                    onClick={() => {
                      if (lock.current) return;
                      lock.current = true;
                      mutation.mutate();
                    }}
                  >
                    {mutation.isPending && (
                      <span
                        className="operator-trip-workflow__publish-spinner"
                        aria-hidden="true"
                      />
                    )}
                    {mutation.isPending
                      ? "Đang phát hành…"
                      : "Phát hành chuyến"}
                  </button>
                </>
              )}
            </footer>
            {!published && !canPublishTrip() && (
              <p className="operator-trip-workflow__warning" role="alert">
                Bạn không có quyền phát hành chuyến này.
              </p>
            )}
          </>
        )
      )}
    </TripWorkflowShell>
  );
}
