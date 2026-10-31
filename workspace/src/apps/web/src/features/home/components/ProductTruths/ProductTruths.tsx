import type { ReactElement } from "react";

import "./ProductTruths.css";

const PRODUCT_TRUTHS = [
  { index: "01", title: "Giá rõ ràng", description: "Không phí ẩn" },
  {
    index: "02",
    title: "Giữ ghế 10 phút",
    description: "Luôn chờ đợi bạn",
  },
  {
    index: "03",
    title: "Vé xe trong tài khoản",
    description: "Có mã dự phòng",
  },
] as const;

export function ProductTruths(): ReactElement {
  return (
    <section className="product-truths" aria-label="Cam kết dịch vụ">
      <ol className="product-truths__list">
        {PRODUCT_TRUTHS.map((truth) => (
          <li className="product-truths__item" key={truth.index}>
            <span className="product-truths__index">{truth.index}</span>
            <span className="product-truths__copy">
              <strong>{truth.title}</strong>
              <span>{truth.description}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
