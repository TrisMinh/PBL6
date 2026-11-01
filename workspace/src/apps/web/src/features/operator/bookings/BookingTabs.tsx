import type { ReactElement } from "react";
import { NavLink } from "react-router";
export function BookingTabs(): ReactElement {
  return (
    <nav className="operator-bookings__tabs" aria-label="Phân hệ đặt chỗ">
      <NavLink to="/operator/bookings" end>
        Đặt chỗ gần đây
      </NavLink>
      <NavLink to="/operator/bookings/trips">Danh sách theo chuyến</NavLink>
    </nav>
  );
}
