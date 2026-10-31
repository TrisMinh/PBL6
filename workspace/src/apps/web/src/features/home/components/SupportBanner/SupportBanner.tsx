import type { ReactElement } from "react";
import { Link } from "react-router";

import { ROUTES } from "@/shared/config/routes";

import "./SupportBanner.css";

export function SupportBanner(): ReactElement {
  return (
    <section className="support-banner" aria-labelledby="support-banner-title">
      <div className="support-banner__copy">
        <p className="support-banner__eyebrow">LUÔN CHỦ ĐỘNG</p>
        <h2 id="support-banner-title">
          Kế hoạch thay đổi?
          <br /> Bạn vẫn kiểm soát hành trình.
        </h2>
        <p>
          Theo dõi yêu cầu hủy vé, tiến trình hoàn tiền và trao đổi với hỗ trợ
          trong cùng một nơi.
        </p>
        <Link className="support-banner__cta" to={ROUTES.ticketLookup}>
          Mở trung tâm hỗ trợ
        </Link>
      </div>
      <aside className="support-banner__availability" aria-label="Hỗ trợ 24/7">
        <strong>24/7</strong>
        <h3>Hỗ trợ xuyên suốt hành trình</h3>
        <p>
          Hủy vé và hoàn tiền là quy trình riêng, có trạng thái và thời gian dự
          kiến rõ ràng.
        </p>
      </aside>
    </section>
  );
}
