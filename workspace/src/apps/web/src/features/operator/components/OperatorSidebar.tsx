import activeVehicles from "@/assets/operator/vehicles/imgFrame3.svg";
import activeRoutes from "@/assets/operator/routes/activeRoutes.svg";
import inactiveTrips from "@/assets/operator/bookings/trips.svg";
import activeBookings from "@/assets/operator/bookings/bookings.svg";
import "./OperatorSidebar.css";
import { useState, type ReactElement } from "react";
import { useNavigate, useLocation } from "react-router";
import { clearMockSession } from "@/features/auth/lib/sessionStorage";
import { BrandLogo } from "@/shared/ui/BrandLogo/BrandLogo";
import tripsIcon from "@/assets/operator/schedule/imgFrame1.svg";
import bookingsIcon from "@/assets/operator/schedule/imgFrame2.svg";
import routesIcon from "@/assets/operator/schedule/imgFrame3.svg";
import seatsIcon from "@/assets/operator/schedule/imgFrame4.svg";
import driversIcon from "@/assets/operator/schedule/imgFrame5.svg";
import reportsIcon from "@/assets/operator/schedule/imgFrame6.svg";
import membersIcon from "@/assets/operator/schedule/imgFrame7.svg";
import cancellationsIcon from "@/assets/operator/schedule/imgFrame8.svg";
import { useOperatorWorkspace } from "@/shared/layouts/OperatorWorkspaceContext";
const GROUPS = [
  {
    title: "VẬN HÀNH",
    links: [
      ["Chuyến đi", tripsIcon],
      ["Đặt chỗ & giao dịch", bookingsIcon],
      ["Hủy vé & hoàn tiền", cancellationsIcon],
    ],
  },
  {
    title: "TÀI NGUYÊN",
    links: [
      ["Tuyến & điểm dừng", routesIcon],
      ["Xe & sơ đồ ghế", seatsIcon],
      ["Tài xế", driversIcon],
    ],
  },
  {
    title: "QUẢN TRỊ",
    links: [
      ["Báo cáo", reportsIcon],
      ["Đối soát", bookingsIcon],
      ["Tổ chức & thành viên", membersIcon],
    ],
  },
];
export function OperatorSidebar({
  routesIconOverride,
  iconsOverride,
}: {
  routesIconOverride?: string;
  iconsOverride?: Record<string, string>;
} = {}): ReactElement | null {
  const embedded = useOperatorWorkspace();
  const navigate = useNavigate();
  const pathname = useLocation().pathname;
  const isRefunds = pathname.startsWith("/operator/refund-requests");
  const isDrivers = pathname.startsWith("/operator/drivers");
  const isReports = pathname.startsWith("/operator/reports");
  const isBookings = pathname.startsWith("/operator/bookings");
  const isVehicles = pathname.startsWith("/operator/vehicles");
  const isRoutes = pathname.startsWith("/operator/routes");
  const [menuOpen, setMenuOpen] = useState(false);
  const isOrganization = pathname.startsWith("/operator/organization");
  const isSettlements = pathname.startsWith("/operator/settlements");
  if (embedded) return null;
  return (
    <>
      <aside
        className="operator-schedule__sidebar"
        aria-label="Điều hướng Operator"
      >
        <div className="operator-schedule__brand">
          <BrandLogo placement="header" />
        </div>
        <button
          type="button"
          className="operator-sidebar__menu"
          aria-expanded={menuOpen}
          aria-controls="operator-sidebar-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          Điều hướng nhà xe {menuOpen ? "−" : "+"}
        </button>
        <nav id="operator-sidebar-navigation" data-open={menuOpen}>
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h2>{group.title}</h2>
              {group.links.map(([label, icon]) => (
                <button
                  type="button"
                  key={label}
                  aria-current={
                    label ===
                    (isOrganization
                      ? "Tổ chức & thành viên"
                      : isSettlements
                        ? "Đối soát"
                        : isRefunds
                          ? "Hủy vé & hoàn tiền"
                          : isDrivers
                            ? "Tài xế"
                            : isReports
                              ? "Báo cáo"
                              : isVehicles
                                ? "Xe & sơ đồ ghế"
                                : isRoutes
                                  ? "Tuyến & điểm dừng"
                                  : isBookings
                                    ? "Đặt chỗ & giao dịch"
                                    : "Chuyến đi")
                      ? "page"
                      : undefined
                  }
                  onClick={() =>
                    label === "Chuyến đi"
                      ? navigate("/operator/trips")
                      : label === "Đặt chỗ & giao dịch"
                        ? navigate("/operator/bookings")
                        : label === "Tuyến & điểm dừng"
                          ? navigate("/operator/routes")
                          : label === "Xe & sơ đồ ghế"
                            ? navigate("/operator/vehicles")
                            : label === "Báo cáo"
                              ? navigate("/operator/reports")
                              : label === "Tài xế"
                                ? navigate("/operator/drivers")
                                : label === "Hủy vé & hoàn tiền"
                                  ? navigate("/operator/refund-requests")
                                  : label === "Đối soát"
                                    ? navigate("/operator/settlements")
                                    : navigate("/operator/organization")
                  }
                >
                  <img
                    src={
                      iconsOverride?.[label ?? ""] ??
                      ((isBookings ||
                        isRoutes ||
                        isVehicles ||
                        isReports ||
                        isDrivers ||
                        isRefunds) &&
                      label === "Chuyến đi"
                        ? inactiveTrips
                        : isBookings && label === "Đặt chỗ & giao dịch"
                          ? activeBookings
                          : isRoutes && label === "Tuyến & điểm dừng"
                            ? activeRoutes
                            : isVehicles && label === "Xe & sơ đồ ghế"
                              ? activeVehicles
                              : label === "Tuyến & điểm dừng" &&
                                  routesIconOverride
                                ? routesIconOverride
                                : icon)
                    }
                    width={16}
                    height={16}
                    alt=""
                  />
                  {isRefunds && label === "Hủy vé & hoàn tiền"
                    ? "Hủy vé và hoàn tiền"
                    : label}
                </button>
              ))}
            </section>
          ))}
        </nav>
        <div className="operator-schedule__account">
          <span>OP</span>
          <div>
            <strong>Nhân viên</strong>
            <small>BlueLine Co.</small>
          </div>
        </div>
        <button
          type="button"
          className="operator-sidebar__logout"
          onClick={() => {
            clearMockSession();
            void navigate("/login", { replace: true });
          }}
        >
          Đăng xuất
        </button>
      </aside>
    </>
  );
}
