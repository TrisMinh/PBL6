import type { ReactElement } from "react";
import { Link } from "react-router";

import { ROUTES } from "@/shared/config/routes";
import { BrandLogo } from "@/shared/ui/BrandLogo/BrandLogo";

import "./HomeFooter.css";

const FOOTER_GROUPS = [
  {
    title: "KHÁM PHÁ",
    links: ["Điểm đến", "Tuyến phổ biến", "Câu chuyện", "Ưu đãi"],
  },
  {
    title: "DỊCH VỤ",
    links: ["Đặt vé", "Hành trình của tôi", "Vé điện tử", "Đối tác vận chuyển"],
  },
  {
    title: "HỖ TRỢ",
    links: ["Trung tâm hỗ trợ", "Liên hệ", "Điều khoản", "Chính sách bảo mật"],
  },
] as const;

function footerDestination(label: string): string {
  if (label === "Hành trình của tôi") return ROUTES.accountTickets;
  if (label === "Vé điện tử" || label === "Trung tâm hỗ trợ")
    return ROUTES.ticketLookup;
  return ROUTES.trips;
}

export function HomeFooter(): ReactElement {
  return (
    <footer
      className="home-footer"
      aria-label="Thông tin BLUE"
      role="contentinfo"
    >
      <div className="home-footer__brand">
        <BrandLogo placement="footer" />
        <p>
          Kết nối những hành trình đáng nhớ bằng trải nghiệm đặt vé tinh tế,
          thuận tiện và đáng tin cậy.
        </p>
        <strong>KẾT NỐI</strong>
        <p className="home-footer__socials">Instagram Facebook LinkedIn</p>
      </div>
      <nav className="home-footer__navigation" aria-label="Liên kết cuối trang">
        {FOOTER_GROUPS.map((group) => (
          <section key={group.title}>
            <h2>{group.title}</h2>
            <ul>
              {group.links.map((label) => (
                <li key={label}>
                  <Link to={footerDestination(label)}>{label}</Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
      <div className="home-footer__legal">
        <p>© 2026 BLUE. All rights reserved.</p>
        <p>Chính sách bảo mật · Điều khoản dịch vụ · Cài đặt cookie</p>
      </div>
    </footer>
  );
}
