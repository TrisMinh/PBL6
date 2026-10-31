import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";
import { MapPin } from "@phosphor-icons/react/dist/csr/MapPin";
import { normalizeSearch } from "@/shared/api/livePresentation";
import "./ExplorePages.css";
import { Link, useParams } from "react-router";
import { z } from "zod";
import { apiJson } from "@/shared/api/client";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { getVietnamTodayDate } from "@/shared/lib/getVietnamTodayDate";

const routeSchema = z.object({
  origin: z.string(),
  destination: z.string(),
  tripCount: z.number(),
  operatorCount: z.number(),
});
const routesSchema = z.array(routeSchema);
function useLiveRoutes(): UseQueryResult<z.infer<typeof routesSchema>, Error> {
  return useQuery({
    queryKey: ["live-api", "explore-routes"],
    queryFn: ({ signal }) =>
      apiJson("/api/v1/explore/routes", routesSchema, { signal, auth: false }),
    retry: false,
  });
}
function searchUrl(origin: string, destination: string, date: string): string {
  return `/trips?${new URLSearchParams({
    originId: origin,
    destinationId: destination,
    departureDate: date,
    passengerCount: "1",
  }).toString()}`;
}
export function BackendExploreIndex(): ReactElement {
  const query = useLiveRoutes();
  const [search, setSearch] = useState("");
  const origins = [
    ...new Set(query.data?.map((route) => route.origin) ?? []),
  ].filter((origin) =>
    normalizeSearch(origin).includes(normalizeSearch(search)),
  );
  return (
    <section className="explore">
      <header className="explore__intro">
        <p className="explore__eyebrow">CÙNG BLUE KHÁM PHÁ</p>
        <h1>Hành trình bắt đầu từ đây</h1>
        <p>
          Chọn điểm xuất phát và khám phá các tuyến xe đang mở bán cho chuyến đi
          của bạn.
        </p>
      </header>
      <div className="explore__search">
        <label htmlFor="live-explore-search">Bạn muốn xuất phát từ đâu?</label>
        <div>
          <input
            id="live-explore-search"
            type="search"
            placeholder="Tìm tỉnh hoặc thành phố…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>
      <div className="explore__section-heading">
        <h2>Điểm xuất phát</h2>
        <p>{origins.length} điểm đi</p>
      </div>
      {query.isPending ? (
        <p role="status">Đang tải các tuyến…</p>
      ) : query.isError ? (
        <ApiFailure error={query.error} retry={() => void query.refetch()} />
      ) : origins.length ? (
        <div className="explore__province-grid">
          {origins.map((origin) => {
            const routes = query.data.filter(
              (route) => route.origin === origin,
            );
            return (
              <Link
                className="explore__province-card"
                key={origin}
                to={`/explore/${encodeURIComponent(origin)}`}
              >
                <div className="explore__card-top">
                  <span className="explore__region">ĐIỂM XUẤT PHÁT</span>
                  <MapPin aria-hidden size={28} weight="duotone" />
                </div>
                <h2>{origin}</h2>
                <p>Khám phá các hành trình và tìm chuyến xe phù hợp.</p>
                <dl className="explore__card-counts">
                  <div>
                    <dt>Hướng đi</dt>
                    <dd>{routes.length}</dd>
                  </div>
                  <div>
                    <dt>Chuyến đang mở</dt>
                    <dd>
                      {routes.reduce((sum, route) => sum + route.tripCount, 0)}
                    </dd>
                  </div>
                </dl>
                <span className="explore__card-action">
                  Khám phá hành trình →
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="explore__state">
          <h2>Chưa có điểm đi phù hợp</h2>
          <p>Thử tìm bằng tên tỉnh hoặc thành phố khác.</p>
        </div>
      )}
    </section>
  );
}
export function BackendExploreDetail(): ReactElement {
  const { provinceSlug = "" } = useParams();
  const query = useLiveRoutes();
  const [date, setDate] = useState(getVietnamTodayDate());
  const routes =
    query.data?.filter((route) => route.origin === provinceSlug) ?? [];
  return (
    <section className="explore">
      <Link className="explore__back" to="/explore">
        ← Tất cả điểm đi
      </Link>
      <header className="explore__intro">
        <p className="explore__eyebrow">KHÁM PHÁ HÀNH TRÌNH</p>
        <h1>Xuất phát từ {provinceSlug}</h1>
        <p>Lựa chọn điểm đến và ngày đi để xem các chuyến xe phù hợp.</p>
      </header>
      <div className="explore__search">
        <label htmlFor="explore-departure">Ngày khởi hành</label>
        <div>
          <input
            id="explore-departure"
            type="date"
            min={getVietnamTodayDate()}
            required
            value={date}
            onChange={(event) =>
              setDate(event.target.value || getVietnamTodayDate())
            }
          />
        </div>
      </div>
      {query.isPending ? (
        <p role="status">Đang tải các tuyến…</p>
      ) : query.isError ? (
        <ApiFailure error={query.error} retry={() => void query.refetch()} />
      ) : routes.length ? (
        <div className="explore__province-grid">
          {routes.map((route) => (
            <Link
              className="explore__province-card"
              key={route.destination}
              to={searchUrl(route.origin, route.destination, date)}
            >
              <div className="explore__card-top">
                <span className="explore__region">TUYẾN ĐANG MỞ BÁN</span>
                <MapPin aria-hidden size={28} weight="duotone" />
              </div>
              <h2>
                {route.origin} → {route.destination}
              </h2>
              <dl className="explore__card-counts">
                <div>
                  <dt>Chuyến xe</dt>
                  <dd>{route.tripCount}</dd>
                </div>
                <div>
                  <dt>Nhà xe</dt>
                  <dd>{route.operatorCount}</dd>
                </div>
              </dl>
              <span className="explore__card-action">
                Tìm chuyến ngày{" "}
                {new Date(date + "T00:00:00+07:00").toLocaleDateString("vi-VN")}{" "}
                →
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="explore__state">
          <h2>Chưa có tuyến đang mở bán</h2>
          <p>Chọn điểm xuất phát khác để khám phá thêm hành trình.</p>
        </div>
      )}
    </section>
  );
}
