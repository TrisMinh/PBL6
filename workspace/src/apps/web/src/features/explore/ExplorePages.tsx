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
import type {
  ExplorePoint,
  ProvinceDetail,
  ProvinceSummary,
} from "@/features/explore/explore.schema";
import "@/features/explore/ExplorePages.css";

function MockNotice(): ReactElement {
  return (
    <p className="explore__notice">
      <strong>Dữ liệu mô phỏng.</strong> Tên điểm, khu vực địa chỉ và phạm vi
      phục vụ chỉ để trải nghiệm giao diện; hãy xác nhận với nhà xe trước hành
      trình.
    </p>
  );
}
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
          ? "Tỉnh, thành này chưa có trong danh mục mô phỏng."
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
      <div className="explore__card-top">
        <span className="explore__region">{province.region}</span>
        <MapPin aria-hidden size={28} weight="duotone" />
      </div>
      <h2>{province.name}</h2>
      <p>{province.description}</p>
      <dl className="explore__card-counts">
        <div>
          <dt>Điểm đón</dt>
          <dd>{province.pickupCount}</dd>
        </div>
        <div>
          <dt>Điểm trả</dt>
          <dd>{province.dropoffCount}</dd>
        </div>
        <div>
          <dt>Nhà xe</dt>
          <dd>{province.operatorCount}</dd>
        </div>
      </dl>
      <span className="explore__card-action">
        Xem điểm đón, trả <ArrowRight aria-hidden size={20} />
      </span>
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
      <div className="explore__section-heading">
        <h2>Tỉnh, thành trong danh mục</h2>
        <p role="status">{filtered.length} tỉnh, thành · dữ liệu mẫu</p>
      </div>
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
              : "Danh mục mô phỏng sẽ xuất hiện tại đây khi có dữ liệu."}
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
    <div className="explore">
      <header className="explore__intro">
        <p className="explore__eyebrow">KHÁM PHÁ CÙNG BLUE</p>
        <h1>
          Mỗi hành trình bắt đầu
          <br />
          từ một điểm hẹn.
        </h1>
        <p>
          Tìm tỉnh, thành và xem điểm đón, trả của các nhà xe trong danh mục mô
          phỏng.
        </p>
      </header>
      <MockNotice />
      {result.isPending ? (
        <p className="explore__state" role="status">
          Đang tải danh mục tỉnh, thành…
        </p>
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
    </div>
  );
}
function PointCard({
  point,
  province,
}: {
  point: ExplorePoint;
  province: ProvinceDetail;
}): ReactElement {
  return (
    <article className="explore__point-card">
      <MapPin aria-hidden size={24} />
      <div>
        <h3>{point.name}</h3>
        <p className="explore__address">{point.address}</p>
        <p className="explore__operators">
          Nhà xe:{" "}
          {province.operators
            .filter((operator) => point.operatorIds.includes(operator.id))
            .map((operator) => operator.name)
            .join(" · ")}
        </p>
        <span className="explore__point-note">Địa chỉ khu vực mô phỏng</span>
      </div>
    </article>
  );
}
function ProvinceLocations({
  province,
}: {
  province: ProvinceDetail;
}): ReactElement {
  return (
    <>
      <header className="explore__province-intro">
        <p className="explore__eyebrow">
          {province.region} · {province.operatorCount} nhà xe mô phỏng
        </p>
        <h1>{province.name}</h1>
        <p>{province.description}</p>
      </header>
      <MockNotice />
      <p className="explore__coordinates">
        Chưa có tọa độ được xác minh cho các điểm mẫu. Không dùng danh mục này
        để chỉ đường.
      </p>
      <div className="explore__locations-grid">
        {(["pickup", "dropoff"] as const).map((service) => {
          const title = service === "pickup" ? "Điểm đón" : "Điểm trả";
          const points = province.points.filter((point) =>
            point.services.includes(service),
          );
          return (
            <section
              key={service}
              aria-label={title}
              className="explore__location-section"
            >
              <div className="explore__location-heading">
                <h2>{title}</h2>
                <span>{points.length} điểm</span>
              </div>
              <p>
                {service === "pickup"
                  ? "Nơi bắt đầu hành trình"
                  : "Nơi kết thúc hành trình"}
              </p>
              {points.length ? (
                points.map((point) => (
                  <PointCard key={point.id} point={point} province={province} />
                ))
              ) : (
                <p>Chưa có {title.toLocaleLowerCase("vi")} trong danh mục.</p>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
export function ProvincePage({ slug }: { slug: string }): ReactElement {
  const result = useExploreProvince(slug);
  return (
    <div className="explore">
      <nav aria-label="Đường dẫn trang" className="explore__breadcrumb">
        <Link to={ROUTES.explore}>Tất cả tỉnh, thành</Link>
        <span aria-hidden> / </span>
        <span aria-current="page">
          {result.data?.name ?? "Chi tiết điểm đón, trả"}
        </span>
      </nav>
      {!result.data && <h1>Điểm đón và điểm trả</h1>}
      {result.isPending ? (
        <p role="status" className="explore__state">
          Đang tải điểm đón, trả…
        </p>
      ) : result.isError ? (
        <ExploreFailure
          error={result.error}
          retry={() => {
            void result.refetch();
          }}
        />
      ) : (
        <ProvinceLocations province={result.data} />
      )}
    </div>
  );
}
