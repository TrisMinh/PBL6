import type { ReactElement } from "react";
import { Link } from "react-router";
export function UnavailablePage(): ReactElement {
  return (
    <section className="live-api">
      <h1>Chức năng chưa khả dụng</h1>
      <p>Bạn có thể tìm chuyến và quản lý vé trong tài khoản.</p>
      <nav>
        <Link to="/">Tìm chuyến</Link>
        <Link to="/account/tickets">Vé của tôi</Link>
      </nav>
    </section>
  );
}
