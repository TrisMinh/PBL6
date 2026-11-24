import { BrandLoading } from "@/shared/ui/BrandLogo/BrandLoading";
import { MapPin } from "@phosphor-icons/react/dist/csr/MapPin";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import type { ReactElement } from "react";
import { Link, useSearchParams } from "react-router";
import { ROUTES, exploreProvincePath } from "@/shared/config/routes";
import { Button } from "@/shared/ui/Button/Button";
import { ExploreRepositoryError } from "@/features/explore/exploreRepository";
import {
  useExploreProvince,
  useExploreProvinces,
} from "@/features/explore/useExplore";
import type { ProvinceSummary } from "@/features/explore/explore.schema";
import {
  ExploreGuides,
  ExploreOffers,
  ExplorePayments,
  FeaturedRoutes,
} from "./ExploreDiscovery";
import { ExplorePromoTicker } from "./ExplorePromoTicker";
import { ProvinceLocationDirectory } from "./ProvinceLocationDirectory";
import "@/features/explore/ExplorePages.css";

function ExploreFailure({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}): ReactElement {
  const terminal = error instanceof ExploreRepositoryError && !error.canRetry;
  return (
    <section className="explore__state" aria-labelledby="explore-error-title">
      <h2 id="explore-error-title">
        {terminal ? "Không tìm thấy tỉnh, thành" : "Chưa tải được dữ liệu"}
      </h2>
      <p>
        {terminal
          ? "Tỉnh, thành này chưa có trong danh mục."
          : "Vui lòng thử lại để xem danh mục điểm đón, trả."}
      </p>
      {terminal ? (
        <Link className="explore__back" to={ROUTES.explore}>
          Về Khám phá
        </Link>
      ) : (
        <Button onClick={retry} type="button">
          Thử lại
        </Button>
      )}
    </section>
  );
}
function ProvinceCard({
  province,
}: {
  province: ProvinceSummary;
}): ReactElement {
  return (
    <Link
      className="explore__province-card"
      to={exploreProvincePath(province.slug)}
    >
      {province.region !== province.name && (
        <div className="explore__province-card-region">
          <MapPin size={18} weight="duotone" aria-hidden /> {province.region}
        </div>
      )}
      <div>
        <h3>{province.name}</h3>
        <p>
          {province.pickupCount} điểm đón · {province.dropoffCount} điểm trả
        </p>
        <span className="explore__card-action">
          Xem điểm đón, trả <ArrowRight aria-hidden size={16} />
        </span>
      </div>
    </Link>
  );
}
function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLocaleLowerCase("vi");
}
function ProvinceCatalog({
  provinces,
}: {
  provinces: ProvinceSummary[];
}): ReactElement {
  const [params, setParams] = useSearchParams();
  const query = (params.get("q") ?? "").slice(0, 100).trim();
  const filtered = provinces.filter((province) =>
    normalizeSearch(`${province.name} ${province.region}`).includes(
      normalizeSearch(query),
    ),
  );
  const clear = (): void => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete("q");
      return next;
    });
  };
  return (
    <>
      <form
        role="search"
        className="explore__search"
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get("q");
          setParams((previous) => {
            const next = new URLSearchParams(previous);
            next.delete("q");
            if (typeof value === "string" && value.trim())
              next.set("q", value.trim().slice(0, 100));
            return next;
          });
        }}
      >
        <label htmlFor="province-search">Tìm tỉnh, thành</label>
        <div>
          <input
            key={query}
            defaultValue={query}
            id="province-search"
            name="q"
            type="search"
            maxLength={100}
            placeholder="Ví dụ: Lâm Đồng, Đà Nẵng…"
          />
          <Button type="submit">Tìm kiếm</Button>
        </div>
      </form>
      <p className="explore__result-count" role="status">
        {filtered.length} tỉnh, thành
      </p>
      {filtered.length ? (
        <div className="explore__province-grid">
          {filtered.map((province) => (
            <ProvinceCard province={province} key={province.slug} />
          ))}
        </div>
      ) : (
        <section className="explore__state">
          <h2>
            {provinces.length
              ? "Không tìm thấy tỉnh, thành phù hợp"
              : "Chưa có tỉnh, thành để hiển thị"}
          </h2>
          <p>
            {provinces.length
              ? "Thử tên khác hoặc xóa tìm kiếm để xem toàn bộ danh mục."
              : "Danh mục sẽ xuất hiện tại đây khi có dữ liệu."}
          </p>
          {query && (
            <Button onClick={clear} type="button" variant="secondary">
              Xóa tìm kiếm
            </Button>
          )}
        </section>
      )}
    </>
  );
}
export function ExplorePage(): ReactElement {
  const result = useExploreProvinces();
  return (
    <div className="explore-landing">
      <header className="explore__intro">
        <h1>Khám phá điểm đến</h1>
        <a className="explore__intro-link" href="#tinh-thanh">
          <MapPin aria-hidden size={18} /> Tra cứu điểm đón, trả
        </a>
      </header>
      <ExplorePromoTicker />
      <FeaturedRoutes />
      <ExploreOffers />
      <ExplorePayments />
      <ExploreGuides />
      <section
        id="tinh-thanh"
        className="explore explore--catalog"
        aria-labelledby="ben-xe"
      >
        <h2 id="ben-xe" className="explore__catalog-title">
          Bến xe khách
        </h2>
        {result.isPending ? (
          <BrandLoading compact title="Đang tải danh mục tỉnh, thành…" />
        ) : result.isError ? (
          <ExploreFailure
            error={result.error}
            retry={() => {
              void result.refetch();
            }}
          />
        ) : (
          <ProvinceCatalog provinces={result.data} />
        )}
      </section>
    </div>
  );
}
export function ProvincePage({ slug }: { slug: string }): ReactElement {
  const result = useExploreProvince(slug);
  return (
    <div className="explore explore--province">
      <nav aria-label="Đường dẫn trang" className="explore__breadcrumb">
        <Link to={ROUTES.explore}>Tất cả tỉnh, thành</Link>
        <span aria-hidden> / </span>
        <span aria-current="page">
          {result.data?.name ?? "Chi tiết điểm đón, trả"}
        </span>
      </nav>
      {!result.data && <h1>Điểm đón và điểm trả</h1>}
      {result.isPending ? (
        <BrandLoading compact title="Đang tải điểm đón, trả…" />
      ) : result.isError ? (
        <ExploreFailure
          error={result.error}
          retry={() => {
            void result.refetch();
          }}
        />
      ) : (
        <ProvinceLocationDirectory province={result.data} />
      )}
    </div>
  );
}
