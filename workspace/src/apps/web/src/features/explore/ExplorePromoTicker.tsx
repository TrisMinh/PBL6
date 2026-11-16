import { useState, type ReactElement } from "react";
import { Link } from "react-router";
import { Megaphone } from "@phosphor-icons/react/dist/csr/Megaphone";
import { MapPin } from "@phosphor-icons/react/dist/csr/MapPin";
import { Ticket } from "@phosphor-icons/react/dist/csr/Ticket";
import { QrCode } from "@phosphor-icons/react/dist/csr/QrCode";
import { Bus } from "@phosphor-icons/react/dist/csr/Bus";
import { Pause } from "@phosphor-icons/react/dist/csr/Pause";
import { Play } from "@phosphor-icons/react/dist/csr/Play";
import { getVietnamTodayDate } from "@/shared/lib/getVietnamTodayDate";
import { isMockApi } from "@/shared/api/config";
import { catalogueRoutes, useLiveCatalogue } from "./liveCatalogue";
import "./ExplorePromoTicker.css";

export function ExplorePromoTicker(): ReactElement {
  const [paused, setPaused] = useState(false);
  const catalogue = useLiveCatalogue(!isMockApi);
  const date = new Date(getVietnamTodayDate() + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + 1);
  const route = (
    originId: string,
    destinationId: string,
    departureDate = date.toISOString().slice(0, 10),
  ): string =>
    "/trips?" +
    new URLSearchParams({
      originId,
      destinationId,
      departureDate,
      passengerCount: "1",
    });
  const popular = catalogueRoutes(
    (catalogue.data ?? []).filter(
      (trip) => trip.sellable && trip.availableSeatCount > 0,
    ),
  );
  const suggestion = (
    index: number,
    demoTitle: string,
    originId: string,
    destinationId: string,
  ): { title: string; to: string } => {
    if (isMockApi)
      return { title: demoTitle, to: route(originId, destinationId) };
    const trip = popular[index];
    if (!trip)
      return {
        title: index === 0 ? "Tìm chuyến đang mở bán" : "Xem lịch chạy",
        to: "/trips",
      };
    return {
      title: trip.title,
      to: route(trip.originId, trip.destinationId, trip.departureDate),
    };
  };
  const items = [
    {
      ...suggestion(0, "TP. Hồ Chí Minh → Đà Lạt", "loc-hcm", "loc-dalat"),
      tag: "Chọn chuyến",
      Icon: MapPin,
      tone: "blue",
    },
    {
      title: "Ưu đãi chuyến đi",
      tag: "Khám phá ngay",
      to: "/offers",
      Icon: Ticket,
      tone: "orange",
    },
    {
      title: "Thanh toán qua SePay",
      tag: isMockApi ? "QR · ATM · Thẻ" : "Xem phương thức",
      to: "/offers#thanh-toan",
      Icon: QrCode,
      tone: "purple",
    },
    {
      ...suggestion(1, "Hà Nội → Đà Nẵng", "loc-hanoi", "loc-danang"),
      tag: "Lên kế hoạch",
      Icon: MapPin,
      tone: "teal",
    },
    {
      title: "Tra cứu vé điện tử",
      tag: "Mở vé của bạn",
      to: "/tickets/lookup",
      Icon: Ticket,
      tone: "blue",
    },
    {
      title: "Đồng hành cùng BLUE",
      tag: "Dành cho nhà xe",
      to: "/partners",
      Icon: Bus,
      tone: "teal",
    },
  ];
  return (
    <section
      className="explore-promos"
      aria-label="Gợi ý và ưu đãi BLUE"
      data-paused={paused || undefined}
    >
      <div className="explore-promos__label">
        <Megaphone size={18} weight="duotone" aria-hidden="true" />
        <span>BLUE gợi ý</span>
      </div>
      <div className="explore-promos__viewport">
        <div className="explore-promos__track">
          {[false, true].map((copy) => (
            <div
              className="explore-promos__group"
              key={String(copy)}
              aria-hidden={copy || undefined}
            >
              {items.map(({ title, tag, to, Icon, tone }) => (
                <Link
                  className={`explore-promos__item explore-promos__item--${tone}`}
                  to={to}
                  key={title}
                  tabIndex={copy ? -1 : undefined}
                >
                  <span className="explore-promos__icon">
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <strong>{title}</strong>
                  <span className="explore-promos__tag">{tag}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="explore-promos__toggle"
        aria-label={paused ? "Chạy dải quảng bá" : "Tạm dừng dải quảng bá"}
        aria-pressed={paused}
        onClick={() => setPaused((value) => !value)}
      >
        {paused ? (
          <Play size={17} weight="fill" aria-hidden="true" />
        ) : (
          <Pause size={17} weight="fill" aria-hidden="true" />
        )}
      </button>
    </section>
  );
}
