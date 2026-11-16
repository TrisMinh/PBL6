import type { ReactElement } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowDownLeft } from "@phosphor-icons/react/dist/csr/ArrowDownLeft";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowUpRight } from "@phosphor-icons/react/dist/csr/ArrowUpRight";
import { Bus } from "@phosphor-icons/react/dist/csr/Bus";
import { Info } from "@phosphor-icons/react/dist/csr/Info";
import { MapPin } from "@phosphor-icons/react/dist/csr/MapPin";
import { ROUTES } from "@/shared/config/routes";
import type { ExplorePoint, ProvinceDetail } from "./explore.schema";
import { ExploreImage } from "./ExploreImage";
import { exploreStations } from "./exploreStations";
import "./ProvinceLocationDirectory.css";

const cityImages: Record<string, number> = {
  "ho-chi-minh": 0,
  "tp-ho-chi-minh": 0,
  "da-lat": 1,
  "lam-dong": 1,
  "da-nang": 2,
  "ha-noi": 3,
};

const serviceOptions = [
  { key: "all", label: "Tất cả" },
  { key: "pickup", label: "Điểm đón" },
  { key: "dropoff", label: "Điểm trả" },
] as const;

function PointCard({
  point,
  province,
}: {
  point: ExplorePoint;
  province: ProvinceDetail;
}): ReactElement {
  const names = province.operators
    .filter(({ id }) => point.operatorIds.includes(id))
    .map(({ name }) => name);
  return (
    <article className="province-directory__point">
      <span className="province-directory__pin">
        <MapPin size={23} weight="duotone" aria-hidden />
      </span>
      <div className="province-directory__point-copy">
        <h3>{point.name}</h3>
        <p>{point.address}</p>
        <p className="province-directory__point-operators">
          <Bus size={16} aria-hidden /> <span>{names.join(" · ")}</span>
        </p>
      </div>
      <div className="province-directory__badges" aria-label="Dịch vụ">
        {point.services.includes("pickup") && (
          <span className="province-directory__pickup">
            <ArrowUpRight aria-hidden /> Đón khách
          </span>
        )}
        {point.services.includes("dropoff") && (
          <span className="province-directory__dropoff">
            <ArrowDownLeft aria-hidden /> Trả khách
          </span>
        )}
      </div>
    </article>
  );
}

export function ProvinceLocationDirectory({
  province,
}: {
  province: ProvinceDetail;
}): ReactElement {
  const [params, setParams] = useSearchParams();
  const requested = params.get("service");
  const service =
    requested === "pickup" || requested === "dropoff" ? requested : "all";
  const points = province.points.filter(
    (point) => service === "all" || point.services.includes(service),
  );
  const station = province.isMock
    ? exploreStations.find(
        (location) => location.provinceSlug === province.slug,
      )
    : province.points[0]
      ? {
          ...province.points[0],
          displayName: province.name,
          imageIndex: cityImages[province.slug] ?? 0,
        }
      : undefined;
  const image = cityImages[province.slug];

  return (
    <div className="province-directory">
      <header className="province-directory__hero">
        {image !== undefined && (
          <div className="province-directory__hero-photo">
            <ExploreImage art={["cities", image]} eager />
          </div>
        )}
        <div className="province-directory__hero-copy">
          <p className="province-directory__region">
            <MapPin size={17} aria-hidden /> {province.region}
          </p>
          <h1>{province.name}</h1>
          <p>{province.description}</p>
          <ul
            className="province-directory__stats"
            aria-label="Thông tin khu vực"
          >
            <li>
              <strong>{province.pickupCount}</strong> điểm đón
            </li>
            <li>
              <strong>{province.dropoffCount}</strong> điểm trả
            </li>
            <li>
              <strong>{province.operatorCount}</strong> nhà xe
            </li>
          </ul>
        </div>
        {image !== undefined && (
          <span className="province-directory__photo-note">
            Ảnh minh họa khu vực
          </span>
        )}
      </header>

      <div className="province-directory__body">
        <section
          className="province-directory__locations"
          aria-labelledby="province-directory-title"
        >
          <h2 id="province-directory-title">Điểm đón và điểm trả</h2>
          <div
            className="province-directory__filters"
            role="group"
            aria-label="Lọc theo dịch vụ"
          >
            {serviceOptions.map(({ key, label }) => (
              <button
                type="button"
                key={key}
                aria-pressed={service === key}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  if (key === "all") next.delete("service");
                  else next.set("service", key);
                  setParams(next, { preventScrollReset: true });
                }}
              >
                {label}{" "}
                <span>
                  {key === "all"
                    ? province.points.length
                    : key === "pickup"
                      ? province.pickupCount
                      : province.dropoffCount}
                </span>
              </button>
            ))}
          </div>
          <p className="province-directory__count" role="status">
            {points.length} điểm phù hợp
          </p>
          <div className="province-directory__point-list">
            {points.map((point) => (
              <PointCard key={point.id} point={point} province={province} />
            ))}
            {!points.length && (
              <p className="explore__state">
                Chưa có điểm phục vụ loại dịch vụ này.
              </p>
            )}
          </div>
          <p className="province-directory__notice">
            <Info size={19} aria-hidden />{" "}
            <span>
              <strong>Dữ liệu mô phỏng.</strong> Chưa có tọa độ được xác minh.
              Hãy kiểm tra điểm đón, trả trên vé trước khi đi.
            </span>
          </p>
        </section>

        {station && (
          <section
            className="province-directory__station"
            id="ben-xe-dia-phuong"
            aria-labelledby="province-station-title"
          >
            <div className="province-directory__station-photo">
              <ExploreImage art={["stations", station.imageIndex]} />
              <span className="province-directory__photo-note">
                Ảnh minh họa
              </span>
            </div>
            <div className="province-directory__station-copy">
              <p>
                <Bus size={17} aria-hidden /> Bến xe trong khu vực
              </p>
              <h2 id="province-station-title">{station.name}</h2>
              <p>
                {station.displayName} ·{" "}
                {province.isMock ? "Bến xe mô phỏng" : "Điểm đón, trả"}
              </p>
              <Link to={`${ROUTES.explore}#tuyen-pho-bien`}>
                Xem tuyến phổ biến <ArrowRight size={17} aria-hidden />
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
