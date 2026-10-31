import type { ReactElement } from "react";

import heroBus from "@/assets/home/hero-bus.png";

import "./TrustJourney.css";

const TRUST_STEPS = [
  ["01", "Giá rõ ràng", "Đúng giá, không phí ẩn."],
  ["02", "Giữ ghế 10 phút", "Cơ chế rõ ràng."],
  ["03", "Xác nhận thanh toán", "Xuất vé nhanh chóng."],
] as const;

export function TrustJourney(): ReactElement {
  return (
    <section className="trust-journey" aria-labelledby="trust-journey-title">
      <div className="trust-journey__visual">
        <img
          src={heroBus}
          alt="Xe BLUE trên cung đường núi"
          width={1536}
          height={1024}
          loading="lazy"
        />
      </div>
      <div className="trust-journey__content">
        <p className="trust-journey__eyebrow">Rõ ràng từng bước</p>
        <h2 id="trust-journey-title">An tâm trên từng chặng đường</h2>
        <p className="trust-journey__description">
          Đặt vé nhanh chóng, thanh toán tiện lợi
        </p>
        <ol className="trust-journey__steps">
          {TRUST_STEPS.map(([index, title, description]) => (
            <li key={index}>
              <span className="trust-journey__index">{index}</span>
              <strong>{title}</strong>
              <span>{description}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
