import { isMockApi } from "@/shared/api/config";
import {
  catalogueRoutes,
  useLiveCatalogue,
} from "@/features/explore/liveCatalogue";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { Link } from "react-router";
import { CaretLeft } from "@phosphor-icons/react/dist/csr/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/dist/csr/CaretRight";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { useTrips } from "@/features/trips/hooks/useTrips";
import { ExploreImage, type Artwork } from "@/features/explore/ExploreImage";
import { getVietnamTodayDate } from "@/shared/lib/getVietnamTodayDate";
import { formatCurrencyVnd } from "@/shared/lib/formatCurrencyVnd";
import { homeSearchPath, rememberSearch } from "../../lib/recentSearches";

const ROUTES = [
  {
    originId: "loc-hcm",
    destinationId: "loc-dalat",
    title: "TP. Hồ Chí Minh → Đà Lạt",
    art: ["travel", 0],
  },
  {
    originId: "loc-hanoi",
    destinationId: "loc-danang",
    title: "Hà Nội → Đà Nẵng",
    art: ["travel", 1],
  },
  {
    originId: "loc-dalat",
    destinationId: "loc-danang",
    title: "Đà Lạt → Đà Nẵng",
    art: ["travel", 2],
  },
  {
    originId: "loc-hcm",
    destinationId: "loc-hanoi",
    title: "TP. Hồ Chí Minh → Hà Nội",
    art: ["travel", 3],
  },
] satisfies {
  originId: string;
  destinationId: string;
  title: string;
  art: Artwork;
}[];
function RouteCard({
  route,
  departureDate,
}: {
  route: {
    originId: string;
    destinationId: string;
    title: string;
    art: Artwork;
  };
  departureDate: string;
}): ReactElement {
  const search = {
    originId: route.originId,
    destinationId: route.destinationId,
    departureDate,
    passengerCount: 1,
    sort: "relevance" as const,
  };
  const query = useTrips(search);
  const first = query.data?.[0];
  const art = <ExploreImage art={route.art} />;
  const copy = (
    <div className="popular-routes__card-copy">
      <h3>{route.title}</h3>
      {first ? (
        <p>
          Từ{" "}
          {formatCurrencyVnd(
            Math.min(...(query.data ?? []).map((trip) => trip.fareVnd)),
          )}{" "}
          · {query.data?.length} chuyến
          <ArrowRight size={16} aria-hidden="true" />
        </p>
      ) : query.isPending ? (
        <p role="status">Đang tải lịch chạy…</p>
      ) : query.isError ? (
        <button type="button" onClick={() => void query.refetch()}>
          Tải lại lịch chạy
        </button>
      ) : (
        <p>Chưa có chuyến ngày này</p>
      )}
    </div>
  );
  return (
    <article className="popular-routes__card" aria-label={route.title}>
      {first ? (
        <Link
          aria-label={`Tìm chuyến ${route.title}`}
          to={homeSearchPath(search)}
          onClick={() =>
            rememberSearch({
              search,
              originLabel: first.origin.displayName,
              destinationLabel: first.destination.displayName,
            })
          }
        >
          {art}
          {copy}
        </Link>
      ) : (
        <>
          {art}
          {copy}
        </>
      )}
    </article>
  );
}
export function MockPopularRoutes(): ReactElement {
  const catalogue = useLiveCatalogue(!isMockApi);
  const rail = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const tomorrow = new Date(getVietnamTodayDate() + "T00:00:00Z");
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const departureDate = tomorrow.toISOString().slice(0, 10);
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const update = (): void =>
      setEdges({
        start: el.scrollLeft < 2,
        end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [catalogue.data]);
  return (
    <section className="popular-routes" aria-labelledby="popular-routes-title">
      <header className="popular-routes__header">
        <div>
          <h2 id="popular-routes-title">Tuyến đường phổ biến</h2>
          <p>Lịch chạy ngày {departureDate.split("-").reverse().join("/")}</p>
        </div>
        <div className="popular-routes__arrows">
          <button
            type="button"
            aria-label="Tuyến trước"
            disabled={edges.start}
            onClick={() =>
              rail.current?.scrollBy({ left: -650, behavior: "smooth" })
            }
          >
            <CaretLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Tuyến tiếp theo"
            disabled={edges.end}
            onClick={() =>
              rail.current?.scrollBy({ left: 650, behavior: "smooth" })
            }
          >
            <CaretRight size={18} aria-hidden="true" />
          </button>
        </div>
      </header>
      <div
        ref={rail}
        className="popular-routes__scroller"
        aria-label="Danh sách tuyến đường phổ biến"
        role="region"
        tabIndex={0}
      >
        {(isMockApi
          ? ROUTES
          : catalogueRoutes(catalogue.data ?? [], departureDate).slice(
              0,
              ROUTES.length,
            )
        ).map((route) => (
          <RouteCard
            key={route.originId + route.destinationId}
            route={route}
            departureDate={departureDate}
          />
        ))}
      </div>
    </section>
  );
}
