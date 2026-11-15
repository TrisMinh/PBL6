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
import "./ExplorePromoTicker.css";

export function ExplorePromoTicker(): ReactElement {
  const [paused, setPaused] = useState(false);
  const date = new Date(getVietnamTodayDate() + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + 1);
  const route = (originId: string, destinationId: string): string =>
    "/trips?" +
    new URLSearchParams({
      originId,
      destinationId,
      departureDate: date.toISOString().slice(0, 10),
      passengerCount: "1",
    });
  const items = [
    {
      title: "TP. Hồ Chí Minh → Đà Lạt",
      tag: "Chọn chuyến",
      to: route("loc-hcm", "loc-dalat"),
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
      title: "Thanh toán qua VNPay",
      tag: "QR · ATM · Thẻ",
      to: "/offers#thanh-toan",
      Icon: QrCode,
      tone: "purple",
    },
    {
      title: "Hà Nội → Đà Nẵng",
      tag: "Lên kế hoạch",
      to: route("loc-hanoi", "loc-danang"),
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
