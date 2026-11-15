import type { ReactElement } from "react";
import { Link } from "react-router";
import { FacebookLogo } from "@phosphor-icons/react/dist/csr/FacebookLogo";
import { InstagramLogo } from "@phosphor-icons/react/dist/csr/InstagramLogo";
import { LinkedinLogo } from "@phosphor-icons/react/dist/csr/LinkedinLogo";

import { BOOKING_SEARCH_PATH, ROUTES } from "@/shared/config/routes";
import { BrandLogo } from "@/shared/ui/BrandLogo/BrandLogo";

import "./HomeFooter.css";

const SOCIAL_LINKS = [
  {
    id: "instagram",
    label: "Instagram",
    href: "https://www.instagram.com/",
    Icon: InstagramLogo,
  },
  {
    id: "facebook",
    label: "Facebook",
    href: "https://www.facebook.com/",
    Icon: FacebookLogo,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    href: "https://www.linkedin.com/",
    Icon: LinkedinLogo,
  },
] as const;

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
  const pages: Record<string, string> = {
    "Đặt vé": BOOKING_SEARCH_PATH,
    "Trung tâm hỗ trợ": "/support",
    "Liên hệ": "/contact",
    "Điều khoản": "/terms",
    "Chính sách bảo mật": "/privacy",
    "Câu chuyện": "/about",
    "Ưu đãi": "/offers",
    "Đối tác vận chuyển": ROUTES.partners,
    "Điểm đến": "/explore",
  };
  if (pages[label]) return pages[label];
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
        <ul className="home-footer__socials" aria-label="Mạng xã hội">
          {SOCIAL_LINKS.map(({ id, label, href, Icon }) => (
            <li key={id}>
              <a
                className={`home-footer__social home-footer__social--${id}`}
                href={href}
                aria-label={label}
                title={label}
              >
                <Icon size={18} weight="fill" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
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
        <p>
          <Link to="/privacy">Chính sách bảo mật</Link> ·{" "}
          <Link to="/terms">Điều khoản dịch vụ</Link> ·{" "}
          <Link to="/privacy">Dữ liệu trên thiết bị</Link>
        </p>
      </div>
    </footer>
  );
}
