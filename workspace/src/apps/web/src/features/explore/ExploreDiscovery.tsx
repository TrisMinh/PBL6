import { useEffect, useRef, useState, type ReactElement } from "react";
import { Link } from "react-router";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { CaretLeft } from "@phosphor-icons/react/dist/csr/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/dist/csr/CaretRight";
import { demoTrips } from "@/mocks/fixtures/demoTrips";
import { exploreProvincePath, ROUTES } from "@/shared/config/routes";
import { formatCurrencyVnd } from "@/shared/lib/formatCurrencyVnd";
import { getVietnamTodayDate } from "@/shared/lib/getVietnamTodayDate";
import { exploreStations } from "./exploreStations";
import { ExploreImage, type Artwork } from "./ExploreImage";
import "./ExploreDiscovery.css";

const featuredRoutes = [
  ["loc-hcm", "loc-dalat", ["travel", 0]],
  ["loc-hanoi", "loc-danang", ["travel", 1]],
  ["loc-dalat", "loc-danang", ["travel", 2]],
  ["loc-hcm", "loc-hanoi", ["travel", 3]],
  ["loc-dalat", "loc-hcm", ["extra", 0]],
  ["loc-hanoi", "loc-hcm", ["extra", 1]],
] as const;

interface EditorialItem {
  image: Artwork;
  title: string;
  copy: string;
  to: string;
  headline?: string;
}

const offers: EditorialItem[] = [
  {
    image: ["editorial", 0, 3],
    headline: "Đi giữa tuần",
    title: "So sánh giá vé theo ngày",
    copy: "Linh hoạt ngày đi để tìm mức giá phù hợp.",
    to: "/offers#di-giua-tuan",
  },
  {
    image: ["editorial", 1, 3],
    headline: "Đặt sớm, chọn ghế",
    title: "Giữ chỗ cho chuyến đi sắp tới",
    copy: "Xem lịch chạy và chỗ trống trước khi lên đường.",
    to: "/offers#dat-som",
  },
  {
    image: ["compare", 0, 1],
    headline: "Tìm giá phù hợp",
    title: "So sánh giá giữa các nhà xe",
    copy: "Lọc theo giờ đi, điểm đón hoặc loại xe.",
    to: "/offers#so-sanh-tuyen",
  },
];

const payments: EditorialItem[] = [
  {
    image: ["editorial", 2, 3],
    headline: "Thanh toán VNPay",
    title: "Hướng dẫn thanh toán VNPay",
    copy: "Xem các bước kiểm tra đơn và thanh toán mô phỏng.",
    to: "/offers#thanh-toan",
  },
  {
    image: ["extra", 2],
    headline: "Vé điện tử",
    title: "Mở lại vé sau khi thanh toán",
    copy: "Dùng mã đặt vé để tra cứu thông tin chuyến.",
    to: ROUTES.ticketLookup,
  },
  {
    image: ["extra", 3],
    headline: "Kiểm tra giao dịch",
    title: "Khi giao dịch chưa có kết quả",
    copy: "Xem hướng dẫn trước khi thử thanh toán lại.",
    to: "/support#thanh-toan",
  },
];

const guides: EditorialItem[] = [
  {
    image: ["editorial", 3, 3],
    title: "Chuẩn bị trước giờ xe chạy",
    copy: "Kiểm tra giờ khởi hành và tên bến trước khi ra điểm đón.",
    to: "#ben-xe",
  },
  {
    image: ["editorial", 4, 3],
    title: "Tìm lại vé đã đặt",
    copy: "Tra cứu vé theo mã đặt vé hoặc mở vé trong tài khoản.",
    to: ROUTES.ticketLookup,
  },
  {
    image: ["editorial", 5, 3],
    title: "Khi cần đổi kế hoạch",
    copy: "Xem điều kiện hủy và theo dõi trạng thái hoàn tiền.",
    to: "/support#huy-ve",
  },
];

export function FeaturedRoutes(): ReactElement {
  const rail = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const tomorrow = new Date(getVietnamTodayDate() + "T00:00:00Z");
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const departureDate = tomorrow.toISOString().slice(0, 10);

  useEffect(() => {
    const track = rail.current;
    if (!track) return;
    const update = (): void => {
      const start = track.scrollLeft < 2;
      const end = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
      setEdges((previous) =>
        previous.start === start && previous.end === end
          ? previous
          : { start, end },
      );
    };
    window.addEventListener("resize", update);
    track.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      window.removeEventListener("resize", update);
      track.removeEventListener("scroll", update);
    };
  }, []);

  function move(direction: number): void {
    const track = rail.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth });
  }

  return (
    <section
      id="tuyen-pho-bien"
      className="explore-discovery"
      aria-labelledby="featured-route-title"
    >
      <header className="explore-discovery__row-heading">
        <div>
          <h2 id="featured-route-title">Tuyến đường phổ biến</h2>
          <p>Giá vé và lịch chạy mẫu cho ngày mai</p>
        </div>
        <div className="explore-discovery__arrows">
          <button
            type="button"
            aria-label="Xem tuyến trước"
            disabled={edges.start}
            onClick={() => move(-1)}
          >
            <CaretLeft aria-hidden size={19} />
          </button>
          <button
            type="button"
            aria-label="Xem tuyến tiếp theo"
            disabled={edges.end}
            onClick={() => move(1)}
          >
            <CaretRight aria-hidden size={19} />
          </button>
        </div>
      </header>
      <div ref={rail} className="explore-discovery__rail">
        {featuredRoutes.map(([originId, destinationId, photo]) => {
          const trips = demoTrips.filter(
            (trip) =>
              trip.origin.id === originId &&
              trip.destination.id === destinationId &&
              trip.id.startsWith("demo-" + departureDate + "-"),
          );
          const first = trips[0];
          if (!first) return null;
          const search = new URLSearchParams({
            originId,
            destinationId,
            departureDate,
            passengerCount: "1",
          });
          return (
            <Link
              className="explore-discovery__card explore-discovery__route"
              to={ROUTES.trips + "?" + search}
              key={originId + "-" + destinationId}
            >
              <ExploreImage art={photo} />
              <div className="explore-discovery__route-caption">
                <div>
                  <h3>
                    {first.origin.displayName} → {first.destination.displayName}
                  </h3>
                  <p>
                    Từ{" "}
                    <strong>
                      {formatCurrencyVnd(
                        Math.min(...trips.map((trip) => trip.fareVnd)),
                      )}
                    </strong>
                  </p>
                </div>
                <ArrowRight aria-hidden size={18} />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function EditorialRow({
  id,
  title,
  items,
}: {
  id: string;
  title: string;
  items: EditorialItem[];
}): ReactElement {
  return (
    <section
      id={id}
      className="explore-discovery"
      aria-labelledby={id + "-title"}
    >
      <header>
        <h2 id={id + "-title"}>{title}</h2>
      </header>
      <div className="explore-discovery__grid">
        {items.map(({ title: caption, copy, to, image, headline }) => (
          <article
            className="explore-discovery__card explore-discovery__editorial"
            key={caption}
          >
            <Link to={to}>
              <div
                className={
                  "explore-discovery__cover" +
                  (headline ? " explore-discovery__cover--campaign" : "")
                }
              >
                <ExploreImage art={image} />
                {headline && <span aria-hidden>{headline}</span>}
              </div>
              <div className="explore-discovery__caption">
                <h3>{caption}</h3>
                <p>{copy}</p>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ExploreOffers(): ReactElement {
  return (
    <EditorialRow id="uu-dai" title="Ưu đãi và mẹo săn vé" items={offers} />
  );
}

export function ExplorePayments(): ReactElement {
  return (
    <EditorialRow
      id="thanh-toan-online"
      title="Thanh toán online"
      items={payments}
    />
  );
}

export function ExploreGuides(): ReactElement {
  return <EditorialRow id="cam-nang" title="Cẩm nang đi xe" items={guides} />;
}

export function ExploreStations(): ReactElement {
  return (
    <section
      id="ben-xe"
      className="explore-discovery"
      aria-labelledby="explore-station-title"
    >
      <header>
        <h2 id="explore-station-title">Bến xe khách</h2>
        <p>Danh mục bến xe mô phỏng · Hình ảnh minh họa</p>
      </header>
      <div className="explore-discovery__grid">
        {exploreStations.map((station) => (
          <Link
            className="explore-discovery__card explore-discovery__station"
            key={station.id}
            to={
              exploreProvincePath(station.provinceSlug) + "#ben-xe-dia-phuong"
            }
          >
            <ExploreImage art={["stations", station.imageIndex]} />
            <div className="explore-discovery__station-caption">
              <h3>{station.name}</h3>
              <p>{station.displayName}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
