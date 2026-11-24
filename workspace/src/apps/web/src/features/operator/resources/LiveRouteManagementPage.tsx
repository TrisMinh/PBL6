import { OperatorStatusBadge } from "../components/OperatorStatusBadge";
import { useState, type ReactElement } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/shared/ui/Button/Button";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { liveApiJson, liveQueryKey } from "@/shared/api/liveRequest";
import { normalizeSearch, shortId } from "@/shared/api/livePresentation";
import {
  getLiveRoutes,
  routeDuration,
  routeStatus,
  stopKind,
} from "./liveRoutes";
import "./RouteManagementPage.css";
import "./LiveRoutes.css";

export function LiveRouteManagementPage(): ReactElement {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [filter, setFilter] = useState({ search: "", status: "" });
  const client = useQueryClient();
  const query = useQuery({
    queryKey: liveQueryKey("operator-routes"),
    queryFn: ({ signal }) => getLiveRoutes(signal),
  });
  const rows =
    query.data?.filter(
      (route) =>
        (!filter.status || route.status === filter.status) &&
        normalizeSearch(
          `${route.name} ${route.origin} ${route.destination} ${route.id}`,
        ).includes(normalizeSearch(filter.search)),
    ) ?? [];
  const selected =
    rows.find((route) => route.id === params.get("route")) ?? rows[0];
  const deactivate = useMutation({
    mutationFn: (id: string) =>
      liveApiJson(`/api/v1/operator/routes/${id}/deactivate`, z.unknown(), {
        method: "POST",
        idempotent: true,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["live-api"] }),
    retry: false,
  });
  return (
    <div className="operator-routes live-routes">
      <header className="live-routes__heading">
        <h1>Tuyến & điểm dừng</h1>
        <Link className="live-routes__primary" to="/operator/routes/new">
          + Tạo tuyến mới
        </Link>
      </header>
      <form
        className="operator-routes__toolbar live-routes__toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          setFilter({ search, status });
        }}
      >
        <label>
          <span>TÌM KIẾM</span>
          <input
            aria-label="Tìm tuyến"
            placeholder="Tên tuyến, điểm đầu hoặc điểm cuối"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          <span>TRẠNG THÁI</span>
          <select
            aria-label="Lọc trạng thái"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang khai thác</option>
            <option value="INACTIVE">Tạm ngừng</option>
          </select>
        </label>
        <Button type="submit">Lọc tuyến</Button>
      </form>
      {query.isPending ? (
        <p role="status">Đang tải danh sách tuyến…</p>
      ) : query.isError ? (
        <ApiFailure error={query.error} />
      ) : (
        <div className="operator-routes__columns">
          <section className="operator-routes__list">
            <h2>Danh sách tuyến</h2>
            {rows.map((route) => (
              <button
                key={route.id}
                className="operator-routes__card"
                type="button"
                aria-pressed={selected?.id === route.id}
                onClick={() =>
                  setParams({ route: route.id }, { replace: true })
                }
              >
                <small>{shortId(route.id)}</small>
                <strong>{route.name}</strong>
                <span>
                  {route.stops.length} điểm dừng · {route.distanceKm ?? "—"} km
                </span>
                <OperatorStatusBadge state={route.status}>
                  {routeStatus(route.status)}
                </OperatorStatusBadge>
              </button>
            ))}
            {!rows.length && <p>Không tìm thấy tuyến phù hợp.</p>}
            <p>Chọn một tuyến để xem và quản lý điểm dừng.</p>
          </section>
          {selected && (
            <section className="operator-routes__detail">
              <header className="operator-routes__route-header">
                <small>{shortId(selected.id)}</small>
                <h2>{selected.name}</h2>
                <p>
                  {selected.origin} → {selected.destination}
                </p>
                <OperatorStatusBadge state={selected.status}>
                  {routeStatus(selected.status)}
                </OperatorStatusBadge>
                <Link
                  className="live-routes__edit"
                  to={`/operator/routes/${selected.id}/edit`}
                >
                  Chỉnh sửa tuyến
                </Link>
              </header>
              <div className="operator-routes__metrics">
                <div>
                  <span>KHOẢNG CÁCH</span>
                  <strong>{selected.distanceKm ?? "—"} km</strong>
                </div>
                <div>
                  <span>THỜI GIAN DỰ KIẾN</span>
                  <strong>{routeDuration(selected.durationMinutes)}</strong>
                </div>
                <div>
                  <span>ĐIỂM DỪNG</span>
                  <strong>{selected.stops.length} điểm</strong>
                </div>
              </div>
              <div className="operator-routes__stops-heading">
                <div>
                  <h3>Các điểm đón/trả</h3>
                  <p>Sắp xếp theo hành trình và loại phục vụ</p>
                </div>
                <Link
                  className="live-routes__outline"
                  to={`/operator/routes/${selected.id}/edit?addStop=1`}
                >
                  + Thêm điểm đón/trả
                </Link>
              </div>
              <ol className="operator-routes__stops">
                {[...selected.stops]
                  .sort((a, b) => a.sequence - b.sequence)
                  .map((stop, index) => (
                    <li key={stop.id ?? index}>
                      <span className="operator-routes__number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <strong>{stop.name}</strong>
                        <small>{stop.address || "Chưa có địa chỉ"}</small>
                      </div>
                      <span className="operator-routes__kind">
                        {stopKind(stop)}
                      </span>
                      <small>{stop.offsetMinutes} phút</small>
                      <Link
                        className="live-routes__stop-edit"
                        aria-label={`Sửa ${stop.name}`}
                        to={`/operator/routes/${selected.id}/edit`}
                      >
                        •••
                      </Link>
                    </li>
                  ))}
              </ol>
              <footer className="operator-routes__footer">
                {selected.status === "ACTIVE" && (
                  <Button
                    variant="secondary"
                    className="operator-routes__disable"
                    isLoading={deactivate.isPending}
                    onClick={() => {
                      if (window.confirm("Tạm ngừng khai thác tuyến này?"))
                        deactivate.mutate(selected.id);
                    }}
                  >
                    Tạm ngừng tuyến
                  </Button>
                )}
              </footer>
              {deactivate.isError && (
                <ApiFailure error={deactivate.error} popup />
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
