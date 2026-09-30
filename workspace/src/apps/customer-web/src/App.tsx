import {
  ArrowLeftRight,
  Armchair,
  Bell,
  Bus,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Droplets,
  LogOut,
  MapPin,
  Menu,
  QrCode,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Snowflake,
  Ticket as TicketIcon,
  Timer,
  Toilet,
  Usb,
  UserRound,
  Users,
  Wifi,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ApiError } from "@busticket/api-client";
import type { Booking, Seat, SeatHold, Ticket, Trip, TripPage } from "@busticket/api-client";
import { SessionProvider, useSession } from "./session";

const SEED_ORIGIN = "Seed Origin Station";
const SEED_DESTINATION = "Seed Destination Station";
const SEED_DATE = "2026-12-01";
const MAILPIT = "http://localhost:8025";

function money(amount: number, currency = "VND") {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency }).format(amount);
}

function errorText(error: unknown) {
  if (error instanceof ApiError) {
    const detail = typeof error.details?.detail === "string" ? ` ${error.details.detail}` : "";
    return `${error.code}: ${error.message}${detail}`;
  }
  return "Không thực hiện được. Thử lại.";
}

function bookingStatusLabel(status: string) {
  return (
    {
      PENDING_PAYMENT: "Chờ thanh toán",
      CONFIRMED: "Đã xác nhận",
      PAID: "Đã thanh toán",
      CANCELLED: "Đã hủy",
      EXPIRED: "Hết hạn",
      REFUND_PENDING: "Đang hoàn tiền",
    } as Record<string, string>
  )[status] ?? status;
}

function ticketStatusLabel(status: string) {
  return (
    {
      ISSUED: "Còn hiệu lực",
      CHECKED_IN: "Đã check-in",
      USED: "Đã sử dụng",
      CANCELLED: "Đã hủy",
      REFUNDED: "Đã hoàn tiền",
    } as Record<string, string>
  )[status] ?? status;
}

function channelLabel(channel: string) {
  return channel === "PAY_LATER" ? "Trả khi lên xe" : "Thanh toán trước";
}

function when(value: string) {
  return new Date(value).toLocaleString("vi-VN");
}

function clock(value: string) {
  return new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function durationLabel(from: string, to: string) {
  const minutes = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h${rest ? ` ${rest}p` : ""}` : `${rest}p`;
}

function coverFor(id: string) {
  const covers = [
    "/images/coach-side.jpg",
    "/images/coach-cabin.jpg",
    "/images/hero-highway.jpg",
    "/images/coach-night.jpg",
    "/images/coach-seats.jpg",
  ];
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return covers[hash % covers.length];
}

function IconBus() {
  return <Bus size={20} strokeWidth={2.4} aria-hidden="true" />;
}

function Shell({ children }: { children: ReactNode }) {
  const { session, api } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const home = location.pathname === "/";
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);
  return (
    <div className="app-root">
      <header className="app">
        <Link className="brand" to="/">
          <span className="brand-mark">
            <IconBus />
          </span>
          BusTicket
        </Link>
        <button
          type="button"
          className="menu-btn"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav className={menuOpen ? "open" : undefined}>
          <Link to="/trips">Chuyến xe</Link>
          {session ? (
            <>
              <Link to="/tickets">
                <TicketIcon size={16} /> Vé của tôi
              </Link>
              <Link to="/notifications">
                <Bell size={16} /> Thông báo
              </Link>
              <Link to="/profile">
                <UserRound size={16} /> Hồ sơ
              </Link>
              <button
                className="ghost"
                onClick={async () => {
                  await api.logout();
                  navigate("/");
                }}
              >
                <LogOut size={16} /> Đăng xuất
              </button>
            </>
          ) : (
            <>
              <Link to="/auth/login">Đăng nhập</Link>
              <Link className="nav-cta" to="/auth/register">
                Đăng ký
              </Link>
            </>
          )}
        </nav>
      </header>
      {menuOpen ? (
        <button type="button" className="nav-overlay" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />
      ) : null}
      <div className="app-body">{home ? children : <div className="page">{children}</div>}</div>
      <footer className="app-foot">
        <div className="foot-inner">
          <strong>BusTicket</strong>
          <p>Vé điện tử · giữ ghế 10 phút · QR khi lên xe</p>
        </div>
      </footer>
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const location = useLocation();
  if (!session) return <Navigate to="/auth/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

function SearchForm({ defaults, docked = false }: { defaults?: URLSearchParams; docked?: boolean }) {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState(defaults?.get("origin") || SEED_ORIGIN);
  const [destination, setDestination] = useState(defaults?.get("destination") || SEED_DESTINATION);
  useEffect(() => {
    if (!defaults) return;
    setOrigin(defaults.get("origin") || SEED_ORIGIN);
    setDestination(defaults.get("destination") || SEED_DESTINATION);
  }, [defaults]);
  const departureDate = defaults?.get("departureDate") || SEED_DATE;
  const passengerCount = defaults?.get("passengerCount") || "1";
  return (
    <form
      className={docked ? "search-card search-dock" : "search-card"}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const next = new URLSearchParams(defaults ?? undefined);
        next.set("origin", String(data.get("origin") ?? origin));
        next.set("destination", String(data.get("destination") ?? destination));
        next.set("departureDate", String(data.get("departureDate") ?? departureDate));
        next.set("passengerCount", String(data.get("passengerCount") ?? "1"));
        next.delete("page");
        navigate(`/trips?${next}`);
      }}
    >
      <div className="search-grid">
        <label className="field-origin">
          Điểm đi
          <span className="field-control">
            <MapPin size={16} />
            <input name="origin" required value={origin} onChange={(event) => setOrigin(event.target.value)} />
          </span>
        </label>
        <button
          type="button"
          className="swap"
          aria-label="Đổi điểm đi và điểm đến"
          onClick={() => {
            setOrigin(destination);
            setDestination(origin);
          }}
        >
          <ArrowLeftRight size={18} />
        </button>
        <label className="field-dest">
          Điểm đến
          <span className="field-control">
            <MapPin size={16} />
            <input name="destination" required value={destination} onChange={(event) => setDestination(event.target.value)} />
          </span>
        </label>
        <label className="field-date">
          Ngày đi
          <span className="field-control">
            <CalendarDays size={16} />
            <input name="departureDate" type="date" defaultValue={departureDate} required />
          </span>
        </label>
        <label className="field-pax">
          Số khách
          <span className="field-control">
            <Users size={16} />
            <input name="passengerCount" type="number" min={1} max={10} defaultValue={passengerCount} />
          </span>
        </label>
        <button className="search-submit" type="submit">
          <Search size={18} /> Tìm vé
        </button>
      </div>
    </form>
  );
}

function HomePage() {
  return (
    <>
      <section className="hero">
        <img className="hero-photo" src="/images/hero-highway.jpg" alt="" />
        <div className="hero-mask" />
        <div className="hero-inner">
          <p className="eyebrow">Vé xe khách toàn quốc</p>
          <h1>Giữ ghế 10 phút, lên xe đưa QR</h1>
          <p className="hero-lead">Tìm chuyến, chọn chỗ, nhận vé điện tử trên điện thoại.</p>
        </div>
      </section>
      <SearchForm docked />
      <section className="trust">
        <article className="lift">
          <Timer size={22} />
          <div>
            <strong>Giữ chỗ thật</strong>
            <p>Ghế khóa 10 phút khi bạn đang điền thông tin hành khách.</p>
          </div>
        </article>
        <article className="lift">
          <QrCode size={22} />
          <div>
            <strong>Vé QR</strong>
            <p>Tài xế quét mã trên điện thoại, không cần in giấy.</p>
          </div>
        </article>
        <article className="lift">
          <ShieldCheck size={22} />
          <div>
            <strong>Trả sau</strong>
            <p>Nhà xe bật sẵn thì thanh toán khi lên xe.</p>
          </div>
        </article>
      </section>
      <section className="popular">
        <h2>Tuyến đang mở bán</h2>
        <Link
          className="card route-card lift"
          to={`/trips?origin=${encodeURIComponent(SEED_ORIGIN)}&destination=${encodeURIComponent(SEED_DESTINATION)}&departureDate=${SEED_DATE}&passengerCount=1`}
        >
          <img src="/images/coach-cabin.jpg" alt="" />
          <div>
            <strong>
              {SEED_ORIGIN} → {SEED_DESTINATION}
            </strong>
            <p className="muted">Ngày {SEED_DATE} · còn ghế seed để thử đặt</p>
          </div>
        </Link>
      </section>
      <p className="dev-hint">
        Dev local: {SEED_ORIGIN} → {SEED_DESTINATION}, {SEED_DATE}. Tài khoản{" "}
        <code>seed.customer@example.test</code> / <code>CustomerPass1</code>.
      </p>
    </>
  );
}

const AMENITY_FILTERS = [
  { id: "WIFI", label: "Wifi" },
  { id: "AC", label: "Điều hòa" },
  { id: "WATER", label: "Nước uống" },
  { id: "USB", label: "Sạc USB" },
  { id: "WC", label: "Nhà vệ sinh" },
];
const TIME_SLOTS = [
  { id: "morning", label: "Sáng 00–12h", from: "00:00:00", to: "11:59:59" },
  { id: "afternoon", label: "Chiều 12–18h", from: "12:00:00", to: "17:59:59" },
  { id: "evening", label: "Tối 18–24h", from: "18:00:00", to: "23:59:59" },
];
const SORT_OPTIONS = [
  { id: "DEPARTURE_ASC", label: "Giờ đi sớm" },
  { id: "DEPARTURE_DESC", label: "Giờ đi muộn" },
  { id: "PRICE_ASC", label: "Giá thấp" },
  { id: "PRICE_DESC", label: "Giá cao" },
  { id: "DURATION_ASC", label: "Nhanh nhất" },
  { id: "DURATION_DESC", label: "Lâu nhất" },
];

function amenityLabel(code: string) {
  return AMENITY_FILTERS.find((item) => item.id === code)?.label ?? code;
}

function AmenityIcon({ code }: { code: string }) {
  const icons = { WIFI: Wifi, AC: Snowflake, WATER: Droplets, USB: Usb, WC: Toilet } as const;
  const Icon = icons[code as keyof typeof icons];
  return Icon ? <Icon size={14} /> : null;
}

function statusPill(label: string) {
  if (label === "Còn hiệu lực" || label === "Đã xác nhận" || label === "Đã thanh toán") return "pill pill-ok";
  if (label === "Chờ thanh toán" || label === "Đang hoàn tiền") return "pill pill-warn";
  return "pill pill-muted";
}

function EmptyState({ title, body, to, action }: { title: string; body: string; to?: string; action?: string }) {
  return (
    <div className="empty-state">
      <TicketIcon size={36} />
      <h2>{title}</h2>
      <p>{body}</p>
      {to ? (
        <Link className="btn" to={to}>
          {action}
        </Link>
      ) : null}
    </div>
  );
}

function patchSearch(query: URLSearchParams, patch: Record<string, string | null>) {
  const next = new URLSearchParams(query);
  for (const [key, value] of Object.entries(patch)) {
    if (!value) next.delete(key);
    else next.set(key, value);
  }
  next.delete("page");
  return next;
}

function TripsPage() {
  const { api } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const query = useMemo(() => {
    const next = new URLSearchParams(params);
    if (!next.get("origin")) next.set("origin", SEED_ORIGIN);
    if (!next.get("destination")) next.set("destination", SEED_DESTINATION);
    if (!next.get("departureDate")) next.set("departureDate", SEED_DATE);
    if (!next.get("passengerCount")) next.set("passengerCount", "1");
    return next;
  }, [params]);
  const [result, setResult] = useState<TripPage | "loading" | string>("loading");
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    setResult("loading");
    api
      .searchTrips(query)
      .then(setResult)
      .catch((error) => setResult(errorText(error)));
  }, [api, query]);
  const apply = (patch: Record<string, string | null>) => navigate(`/trips?${patchSearch(query, patch)}`);
  const selectedAmenities = (query.get("amenities") ?? "").split(",").filter(Boolean);
  const trips = typeof result === "object" ? result.items : [];
  const operators = [...new Map(trips.map((trip) => [trip.organizationId, trip.operatorName])).entries()];
  const busTypes = [...new Set(trips.map((trip) => trip.busType).filter(Boolean))];
  const stopOptions = [...new Map(trips.flatMap((trip) => trip.stops.map((stop) => [stop.id, stop] as const))).values()];
  const activeSlot = TIME_SLOTS.find((slot) => slot.from === query.get("departureTimeFrom") && slot.to === query.get("departureTimeTo"));
  return (
    <>
      <h1 className="page-title">
        {query.get("origin")} → {query.get("destination")}
      </h1>
      <p className="muted page-sub">Ngày {query.get("departureDate")} · {query.get("passengerCount")} khách</p>
      <SearchForm defaults={query} />
      {typeof result === "string" && result !== "loading" ? <p className="error">{result}</p> : null}
      <div className="results-layout">
        <div className="filter-col">
        <button type="button" className="secondary filter-toggle" onClick={() => setFiltersOpen((open) => !open)}>
          <SlidersHorizontal size={16} /> {filtersOpen ? "Ẩn bộ lọc" : "Bộ lọc"}
        </button>
        <aside className={`filter-panel card${filtersOpen ? " open" : ""}`}>
          <h2>Bộ lọc</h2>
          <fieldset>
            <legend>Giờ đi</legend>
            <div className="chip-row">
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  className={`chip-btn${activeSlot?.id === slot.id ? " on" : ""}`}
                  onClick={() =>
                    apply(
                      activeSlot?.id === slot.id
                        ? { departureTimeFrom: null, departureTimeTo: null }
                        : { departureTimeFrom: slot.from, departureTimeTo: slot.to },
                    )
                  }
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Giá (VND)</legend>
            <div className="filter-row">
              <input
                type="number"
                min={0}
                step={10000}
                placeholder="Từ"
                defaultValue={query.get("minPrice") ?? ""}
                onBlur={(event) => apply({ minPrice: event.target.value || null })}
              />
              <input
                type="number"
                min={0}
                step={10000}
                placeholder="Đến"
                defaultValue={query.get("maxPrice") ?? ""}
                onBlur={(event) => apply({ maxPrice: event.target.value || null })}
              />
            </div>
          </fieldset>
          <fieldset>
            <legend>Tiện nghi</legend>
            {AMENITY_FILTERS.map((item) => (
              <label key={item.id} className="check">
                <input
                  type="checkbox"
                  checked={selectedAmenities.includes(item.id)}
                  onChange={() => {
                    const next = selectedAmenities.includes(item.id)
                      ? selectedAmenities.filter((id) => id !== item.id)
                      : [...selectedAmenities, item.id];
                    apply({ amenities: next.length ? next.join(",") : null });
                  }}
                />
                <AmenityIcon code={item.id} />
                {item.label}
              </label>
            ))}
          </fieldset>
          {operators.length > 0 || query.get("organizationId") ? (
            <fieldset>
              <legend>Nhà xe</legend>
              <select value={query.get("organizationId") ?? ""} onChange={(event) => apply({ organizationId: event.target.value || null })}>
                <option value="">Tất cả</option>
                {operators.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </fieldset>
          ) : null}
          {busTypes.length > 0 ? (
            <fieldset>
              <legend>Loại xe</legend>
              <select value={query.get("busType") ?? ""} onChange={(event) => apply({ busType: event.target.value || null })}>
                <option value="">Tất cả</option>
                {busTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </fieldset>
          ) : null}
          {stopOptions.length > 0 ? (
            <>
              <fieldset>
                <legend>Điểm đón</legend>
                <select value={query.get("pickupStopId") ?? ""} onChange={(event) => apply({ pickupStopId: event.target.value || null })}>
                  <option value="">Tất cả</option>
                  {stopOptions.filter((stop) => stop.pickupAllowed).map((stop) => (
                    <option key={stop.id} value={stop.id}>
                      {stop.name}
                    </option>
                  ))}
                </select>
              </fieldset>
              <fieldset>
                <legend>Điểm trả</legend>
                <select value={query.get("dropoffStopId") ?? ""} onChange={(event) => apply({ dropoffStopId: event.target.value || null })}>
                  <option value="">Tất cả</option>
                  {stopOptions.filter((stop) => stop.dropoffAllowed).map((stop) => (
                    <option key={stop.id} value={stop.id}>
                      {stop.name}
                    </option>
                  ))}
                </select>
              </fieldset>
            </>
          ) : null}
          <button
            type="button"
            className="secondary"
            onClick={() =>
              navigate(
                `/trips?${new URLSearchParams({
                  origin: query.get("origin") ?? SEED_ORIGIN,
                  destination: query.get("destination") ?? SEED_DESTINATION,
                  departureDate: query.get("departureDate") ?? SEED_DATE,
                  passengerCount: query.get("passengerCount") ?? "1",
                })}`,
              )
            }
          >
            Xóa bộ lọc
          </button>
        </aside>
        </div>
        <div>
          <div className="result-toolbar">
            <p className="muted">
              {typeof result === "object" ? `${result.totalElements} chuyến` : "Đang lọc…"}
            </p>
            <label>
              Sắp xếp
              <select value={query.get("sort") ?? "DEPARTURE_ASC"} onChange={(event) => apply({ sort: event.target.value })}>
                {SORT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {result === "loading" ? (
            <div className="trip-list" aria-busy="true">
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          ) : null}
          {typeof result === "object" && result.items.length === 0 ? (
            <EmptyState
              title="Không có chuyến khớp bộ lọc"
              body={`Thử xóa lọc hoặc tìm ${SEED_ORIGIN} → ${SEED_DESTINATION} ngày ${SEED_DATE}.`}
              to={`/?origin=${encodeURIComponent(SEED_ORIGIN)}&destination=${encodeURIComponent(SEED_DESTINATION)}`}
              action="Về trang tìm vé"
            />
          ) : null}
          {typeof result === "object" ? (
            <div className="trip-list">
              {result.items.map((trip, index) => (
                <article className="card trip-card lift" key={trip.id} style={{ animationDelay: `${index * 60}ms` }}>
                  <div className="trip-cover">
                    <img src={coverFor(trip.id)} alt="" />
                    <span>{trip.busType}</span>
                  </div>
                  <div className="trip-main">
                    <p className="trip-op">
                      <Bus size={14} /> {trip.operatorName}
                    </p>
                    <div className="trip-times">
                      <div>
                        <strong>{clock(trip.departureAt)}</strong>
                        <p className="muted">{trip.origin}</p>
                      </div>
                      <div className="trip-line">
                        <span>{durationLabel(trip.departureAt, trip.arrivalAt)}</span>
                      </div>
                      <div>
                        <strong>{clock(trip.arrivalAt)}</strong>
                        <p className="muted">{trip.destination}</p>
                      </div>
                    </div>
                    <p className="chip-row">
                      {(trip.amenities ?? []).map((item) => (
                        <span className="chip" key={item}>
                          <AmenityIcon code={item} />
                          {amenityLabel(item)}
                        </span>
                      ))}
                    </p>
                  </div>
                  <div className="trip-fare">
                    <p className="price">{money(trip.fare.amount, trip.fare.currency)}</p>
                    <p className="muted">
                      <Armchair size={14} /> Còn {trip.availableSeatCount ?? "?"} ghế
                    </p>
                    <Link className="btn" to={`/trips/${trip.id}`}>
                      Chọn ghế <ChevronRight size={16} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
          {typeof result === "object" && result.totalPages > 1 ? (
            <div className="pager">
              <button
                type="button"
                className="secondary"
                disabled={result.page <= 0}
                onClick={() => {
                  const next = new URLSearchParams(query);
                  next.set("page", String(result.page - 1));
                  navigate(`/trips?${next}`);
                }}
              >
                <ChevronLeft size={16} /> Trước
              </button>
              <span>
                Trang {result.page + 1}/{result.totalPages}
              </span>
              <button
                type="button"
                className="secondary"
                disabled={result.page + 1 >= result.totalPages}
                onClick={() => {
                  const next = new URLSearchParams(query);
                  next.set("page", String(result.page + 1));
                  navigate(`/trips?${next}`);
                }}
              >
                Sau <ChevronRight size={16} />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

function TripPage() {
  const { tripId = "" } = useParams();
  const { api, session } = useSession();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.getTrip(tripId).then(setTrip).catch((err) => setError(errorText(err)));
    if (session) {
      api
        .getSeats(tripId)
        .then((result) => setSeats(result.seats))
        .catch((err) => setError(errorText(err)));
    }
  }, [api, session, tripId]);
  if (error) return <p className="error">{error}</p>;
  if (!trip) return <p>Đang tải chuyến…</p>;
  const pickup = trip.stops.find((stop) => stop.pickupAllowed)?.id ?? trip.stops[0]?.id ?? "";
  const dropoff = [...trip.stops].reverse().find((stop) => stop.dropoffAllowed)?.id ?? pickup;
  const selectedSeats = seats.filter((seat) => selected.includes(seat.id));
  const selectedTotal = selectedSeats.reduce((sum, seat) => sum + seat.price.amount, 0);
  const rows = Array.from(new Set(seats.map((seat) => seat.code.replace(/\D.*/, "") || seat.code)));
  return (
    <>
      <div className="trip-hero">
        <img src={coverFor(trip.id)} alt="" />
        <div>
          <p className="eyebrow">{trip.operatorName}</p>
          <h1 className="page-title">
            {trip.origin} → {trip.destination}
          </h1>
          <p>
            {clock(trip.departureAt)}–{clock(trip.arrivalAt)} · {durationLabel(trip.departureAt, trip.arrivalAt)} · {trip.busType}
          </p>
        </div>
      </div>
      <p className="chip-row">
        {(trip.amenities ?? []).map((item) => (
          <span className="chip" key={item}>
            <AmenityIcon code={item} />
            {amenityLabel(item)}
          </span>
        ))}
      </p>
      <ol className="itinerary">
        {trip.stops.map((stop) => (
          <li key={stop.id}>
            <span className="dot" />
            <div>
              <strong>{stop.name}</strong>
              <p className="muted">
                {stop.pickupAllowed ? "Đón khách" : ""}
                {stop.pickupAllowed && stop.dropoffAllowed ? " · " : ""}
                {stop.dropoffAllowed ? "Trả khách" : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="muted">
        Policy {trip.policyVersion ?? "cancel-mvp-v1"}
        {trip.availabilityAsOf ? ` · ghế cập nhật ${when(trip.availabilityAsOf)}` : ""} · còn {trip.availableSeatCount ?? "?"} ghế
        {!trip.sellable ? " · không bán" : ""}
      </p>
      {!session ? (
        <p>
          <Link className="btn" to="/auth/login">
            Đăng nhập để chọn ghế
          </Link>
        </p>
      ) : (
        <div className="coach-wrap">
          <div className="coach-deck">
            <div className="coach-cab">
              <Bus size={14} /> Tài xế
            </div>
            <div className="seat-rows">
              {rows.map((row) => (
                <div className="seat-row" key={row}>
                  {seats
                    .filter((seat) => (seat.code.replace(/\D.*/, "") || seat.code) === row)
                    .map((seat) => {
                      const on = selected.includes(seat.id);
                      return (
                        <button
                          key={seat.id}
                          type="button"
                          className={`seat ${seat.status}${on ? " selected" : ""}`}
                          disabled={seat.status !== "AVAILABLE"}
                          aria-pressed={on}
                          aria-label={`Ghế ${seat.code}, ${seat.status === "AVAILABLE" ? "còn trống" : "không chọn được"}, ${money(seat.price.amount, seat.price.currency)}`}
                          onClick={() =>
                            setSelected((current) => (current.includes(seat.id) ? current.filter((id) => id !== seat.id) : [...current, seat.id]))
                          }
                        >
                          {seat.code}
                        </button>
                      );
                    })}
                </div>
              ))}
            </div>
            <p className="legend">
              <span>
                <i className="lg-free" /> Còn trống
              </span>
              <span>
                <i className="lg-pick" /> Đang chọn
              </span>
              <span>
                <i className="lg-busy" /> Đã giữ / đã bán
              </span>
            </p>
          </div>
          <aside className="card hold-panel">
            <p className="muted">Tạm tính {selected.length} ghế</p>
            <p className="price">{money(selectedTotal, trip.fare.currency)}</p>
            <p className="muted">{selectedSeats.map((seat) => seat.code).join(", ") || "Chưa chọn ghế"}</p>
            <button
              disabled={selected.length === 0}
              onClick={async () => {
                try {
                  const hold = await api.createHold(tripId, { seatIds: selected, pickupStopId: pickup, dropoffStopId: dropoff });
                  navigate(`/checkout/${encodeURIComponent(hold.holdToken)}/passengers`);
                } catch (err) {
                  setError(errorText(err));
                }
              }}
            >
              <Timer size={16} /> Giữ ghế 10 phút
            </button>
          </aside>
        </div>
      )}
    </>
  );
}

function AuthForm({
  title,
  children,
  onSubmit,
  error,
  submitLabel = "Tiếp tục",
}: {
  title: string;
  children: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  error: string | null;
  submitLabel?: string;
}) {
  return (
    <div className="auth-split">
      <div className="auth-visual">
        <img src="/images/coach-cabin.jpg" alt="" />
        <span>Lên xe, đưa QR, không cần in vé.</span>
      </div>
      <div className="auth-panel">
        <h1 className="page-title">{title}</h1>
        <form className="card stack" onSubmit={onSubmit}>
          {children}
          {error ? <p className="error">{error}</p> : null}
          <button type="submit">{submitLabel}</button>
        </form>
      </div>
    </div>
  );
}

function LoginPage() {
  const { api } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  return (
    <AuthForm
      title="Đăng nhập"
      error={error}
      submitLabel="Đăng nhập"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        try {
          await api.login(String(data.get("identifier")), String(data.get("password")));
          const from = (location.state as { from?: string } | null)?.from ?? "/";
          navigate(from);
        } catch (err) {
          setError(errorText(err));
        }
      }}
    >
      <label>
        Email hoặc số điện thoại
        <input name="identifier" required autoComplete="username" defaultValue="seed.customer@example.test" />
      </label>
      <label>
        Mật khẩu
        <input name="password" type="password" required autoComplete="current-password" defaultValue="CustomerPass1" />
      </label>
      <p className="muted">Tài khoản seed local: seed.customer@example.test / CustomerPass1</p>
      <div className="auth-links">
        <Link to="/auth/forgot-password">Quên mật khẩu</Link>
        <Link to="/auth/register">Chưa có tài khoản?</Link>
      </div>
    </AuthForm>
  );
}

function RegisterPage() {
  const { api } = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  return (
    <AuthForm
      title="Đăng ký"
      error={error}
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        try {
          const result = await api.register({
            fullName: String(data.get("fullName")),
            email: String(data.get("email")),
            phone: String(data.get("phone")),
            password: String(data.get("password")),
          });
          navigate(`/auth/verify?challengeId=${result.operationId}&email=${encodeURIComponent(String(data.get("email")))}`);
        } catch (err) {
          setError(errorText(err));
        }
      }}
    >
      <label>
        Họ tên
        <input name="fullName" required />
      </label>
      <label>
        Email
        <input name="email" type="email" required />
      </label>
      <label>
        Số điện thoại
        <input name="phone" required placeholder="+84900000000" />
      </label>
      <label>
        Mật khẩu (tối thiểu 10 ký tự, có chữ và số)
        <input name="password" type="password" minLength={10} required />
      </label>
      <p className="muted">
        OTP gửi Mailpit: <a href={MAILPIT}>{MAILPIT}</a>
      </p>
      <Link to="/auth/login">Đã có tài khoản?</Link>
    </AuthForm>
  );
}

function VerifyPage() {
  const { api } = useSession();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const email = params.get("email") ?? "";
  return (
    <AuthForm
      title="Xác minh email"
      error={error}
      submitLabel="Xác minh"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        try {
          await api.verify({
            challengeId: String(data.get("challengeId")),
            code: String(data.get("code")),
          });
          navigate("/");
        } catch (err) {
          setError(errorText(err));
        }
      }}
    >
      <p className="muted">
        Lấy mã 6 số trong Mailpit <a href={MAILPIT}>{MAILPIT}</a>. Nội dung dạng <code>challengeId=…; code=123456</code>.
      </p>
      <input type="hidden" name="challengeId" defaultValue={params.get("challengeId") ?? ""} />
      <label>
        OTP
        <input name="code" required inputMode="numeric" autoComplete="one-time-code" />
      </label>
      {email ? (
        <button
          type="button"
          className="secondary"
          onClick={async () => {
            try {
              const result = await api.resendVerification(email);
              setInfo(`Đã gửi lại OTP. challengeId=${result.operationId}`);
              setError(null);
            } catch (err) {
              setError(errorText(err));
            }
          }}
        >
          Gửi lại OTP
        </button>
      ) : null}
      {info ? <p className="muted">{info}</p> : null}
    </AuthForm>
  );
}

function ForgotPage() {
  const { api } = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  return (
    <AuthForm
      title="Quên mật khẩu"
      error={error}
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        try {
          const result = await api.forgotPassword(String(data.get("email")));
          navigate(`/auth/reset-password?challengeId=${result.operationId}&email=${encodeURIComponent(String(data.get("email")))}`);
        } catch (err) {
          setError(errorText(err));
        }
      }}
    >
      <label>
        Email
        <input name="email" type="email" required />
      </label>
      <p className="muted">
        OTP reset nằm ở Mailpit <a href={MAILPIT}>{MAILPIT}</a>.
      </p>
    </AuthForm>
  );
}

function ResetPage() {
  const { api } = useSession();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  return (
    <AuthForm
      title="Đặt lại mật khẩu"
      error={error}
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        try {
          await api.resetPassword({
            challengeId: String(data.get("challengeId")),
            code: String(data.get("code")),
            newPassword: String(data.get("newPassword")),
          });
          navigate("/auth/login");
        } catch (err) {
          setError(errorText(err));
        }
      }}
    >
      <input type="hidden" name="challengeId" defaultValue={params.get("challengeId") ?? ""} />
      <label>
        OTP
        <input name="code" required />
      </label>
      <label>
        Mật khẩu mới
        <input name="newPassword" type="password" minLength={10} required />
      </label>
    </AuthForm>
  );
}

function PassengersPage() {
  const { holdToken = "" } = useParams();
  const { api, session } = useSession();
  const navigate = useNavigate();
  const [hold, setHold] = useState<SeatHold | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState("PREPAID");
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    api
      .getHold(holdToken)
      .then(async (current) => {
        setHold(current);
        setTrip(await api.getTrip(current.tripId));
      })
      .catch((err) => setError(errorText(err)));
  }, [api, holdToken]);
  useEffect(() => {
    if (!hold) return;
    const tick = () => setRemaining(Math.max(0, Math.floor((new Date(hold.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [hold]);
  if (error) return <p className="error">{error}</p>;
  if (!hold || !trip) return <p>Đang tải giữ ghế…</p>;
  const pickup = trip.stops.find((stop) => stop.pickupAllowed)?.id ?? trip.stops[0]?.id ?? "";
  const dropoff = [...trip.stops].reverse().find((stop) => stop.dropoffAllowed)?.id ?? pickup;
  return (
    <>
      <h1 className="page-title">Hành khách</h1>
      <p className={`countdown${remaining < 60 ? " warn" : ""}`}>
        <Clock size={16} /> Giữ ghế còn {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
      </p>
      <div className="checkout-layout">
      <form
        className="card stack"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const contact = {
            fullName: String(data.get("contactName")),
            email: String(data.get("contactEmail")),
            phone: String(data.get("contactPhone")),
          };
          const passengers = hold.seats.map((seat, index) => ({
            seatId: seat.id,
            fullName: String(data.get(`p${index}`) || contact.fullName),
            pickupStopId: pickup,
            dropoffStopId: dropoff,
          }));
          const total = hold.seats.reduce((sum, seat) => sum + seat.price.amount, 0);
          try {
            const booking = await api.createBooking({
              holdToken,
              contact,
              passengers,
              expectedTotal: total,
              currency: hold.seats[0]?.price.currency ?? "VND",
              paymentChannel: channel,
            });
            if (channel === "PREPAID") navigate(`/checkout/${booking.id}/payment`);
            else {
              const tickets = await api.listTickets();
              const issued = tickets.items.find((ticket) => ticket.bookingId === booking.id);
              navigate(issued ? `/tickets/${issued.id}` : "/tickets");
            }
          } catch (err) {
            setError(errorText(err));
          }
        }}
      >
        <label>
          Người liên hệ
          <input name="contactName" required defaultValue={session?.user.fullName ?? ""} />
        </label>
        <label>
          Email
          <input name="contactEmail" type="email" required defaultValue={session?.user.email ?? ""} />
        </label>
        <label>
          Điện thoại
          <input name="contactPhone" required defaultValue={session?.user.phone ?? ""} />
        </label>
        {hold.seats.map((seat, index) => (
          <label key={seat.id}>
            Hành khách ghế {seat.code}
            <input name={`p${index}`} placeholder="Họ tên trên vé" defaultValue={session?.user.fullName ?? ""} />
          </label>
        ))}
        <label>
          Kênh thanh toán
          <select value={channel} onChange={(event) => setChannel(event.target.value)}>
            <option value="PREPAID">Thanh toán trước (VNPay local)</option>
            <option value="PAY_LATER">Trả sau</option>
          </select>
        </label>
        <button type="submit">Tạo đơn {money(hold.seats.reduce((sum, seat) => sum + seat.price.amount, 0))}</button>
      </form>
      <aside className="card hold-panel">
        <h2>{trip.origin} → {trip.destination}</h2>
        <p className="muted">{clock(trip.departureAt)} · {hold.seats.map((seat) => seat.code).join(", ")}</p>
        <p className="price">{money(hold.seats.reduce((sum, seat) => sum + seat.price.amount, 0), hold.seats[0]?.price.currency)}</p>
        <p className="muted">Ghế giữ đến {when(hold.expiresAt)}</p>
      </aside>
      </div>
    </>
  );
}

function PaymentPage() {
  const { bookingId = "" } = useParams();
  const { api } = useSession();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api
      .getBooking(bookingId)
      .then(setBooking)
      .catch((err) => setError(errorText(err)));
  }, [api, bookingId]);
  if (error) return <p className="error">{error}</p>;
  if (!booking) return <p>Đang tải thanh toán…</p>;
  return (
    <>
      <h1 className="page-title">Thanh toán vé</h1>
      <article className="card pay-card">
        <p className="muted">{bookingStatusLabel(booking.status)}</p>
        <p className="price">{money(booking.total, booking.currency)}</p>
        <p className="notice">Cổng thử nghiệm local: localhost:8099. Không mở sandbox.vnpayment.vn khi chưa có TmnCode merchant từ VNPay.</p>
        <button
          disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            let payment: Awaited<ReturnType<typeof api.createPayment>> | null = null;
            let lastError: unknown;
            for (let attempt = 0; attempt < 8; attempt += 1) {
              try {
                payment = await api.createPayment(booking.id, {
                  provider: "VNPAY_SANDBOX",
                  method: "VNPAY_QR",
                  returnUri: `${window.location.origin}/payments/pending/result?bookingId=${booking.id}`,
                });
                lastError = null;
                break;
              } catch (err) {
                lastError = err;
                await new Promise((resolve) => window.setTimeout(resolve, 400));
              }
            }
            if (!payment) throw lastError;
            const redirect = payment.providerAction?.redirectUri;
            if (redirect) window.location.href = redirect;
            else window.location.assign(`/payments/${payment.id}/result`);
          } catch (err) {
            setError(errorText(err));
            setBusy(false);
          }
        }}
      >
        {busy ? "Đang tạo thanh toán…" : "Thanh toán VNPay Sandbox"}
      </button>
      </article>
    </>
  );
}

function PaymentResultPage() {
  const { paymentId = "" } = useParams();
  const { api } = useSession();
  const [params] = useSearchParams();
  const [status, setStatus] = useState("Đang xác nhận vé…");
  const bookingId = params.get("bookingId");
  const responseCode = params.get("vnp_ResponseCode");
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      if (responseCode && responseCode !== "00") {
        setStatus(`Cổng trả về mã ${responseCode}. Thanh toán không thành công.`);
        return;
      }
      if (paymentId !== "pending") {
        const payment = await api.getPayment(paymentId);
        if (!cancelled) setStatus(`Thanh toán ${payment.status}`);
        return;
      }
      for (let attempt = 0; attempt < 20; attempt += 1) {
        if (bookingId) {
          const booking = await api.getBooking(bookingId);
          if (booking.status === "PAID" || booking.status === "CONFIRMED") {
            if (!cancelled) setStatus(`Vé đã sẵn sàng. Mở Vé của tôi để xem QR.`);
            return;
          }
          if (booking.status === "CANCELLED" || booking.status === "EXPIRED") {
            if (!cancelled) setStatus("Vé đã hết hạn hoặc bị hủy.");
            return;
          }
        }
        const bookings = await api.listBookings();
        const paid = bookings.items.find((item) => item.status === "PAID" || item.status === "CONFIRMED");
        if (paid && (!bookingId || paid.id === bookingId)) {
          if (!cancelled) setStatus("Vé đã sẵn sàng.");
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }
      if (!cancelled) setStatus("Cổng đã trả về. Nếu vé chưa hiện, mở Vé của tôi và tải lại sau vài giây.");
    }
    poll().catch((err) => {
      if (!cancelled) setStatus(errorText(err));
    });
    return () => {
      cancelled = true;
    };
  }, [api, bookingId, paymentId, responseCode]);
  return (
    <>
      <h1 className="page-title">Kết quả thanh toán</h1>
      <article className="card pay-card">
        <CheckCircle2 size={28} />
        <p>{status}</p>
        <div className="row">
          <Link className="btn" to="/tickets">
            Xem vé của tôi
          </Link>
        </div>
      </article>
    </>
  );
}

function BookingRedirect() {
  const { bookingId = "" } = useParams();
  const { api } = useSession();
  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [booking, tickets] = await Promise.all([api.getBooking(bookingId), api.listTickets()]);
        if (cancelled) return;
        const ticket = tickets.items.find((item) => item.bookingId === bookingId);
        if (ticket) navigate(`/tickets/${ticket.id}`, { replace: true });
        else if (booking.status === "PENDING_PAYMENT") navigate(`/checkout/${bookingId}/payment`, { replace: true });
        else navigate("/tickets", { replace: true });
      } catch {
        if (!cancelled) navigate("/tickets", { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, bookingId, navigate]);
  return <p>Đang mở vé…</p>;
}

function TicketsPage() {
  const { api } = useSession();
  const [rows, setRows] = useState<
    { key: string; href: string; title: string; meta: string; status: string; amount?: string; coverId: string }[] | "loading"
  >("loading");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const [tickets, bookings] = await Promise.all([api.listTickets(), api.listBookings()]);
        const tripIds = [...new Set([...tickets.items.map((item) => item.tripId), ...bookings.items.map((item) => item.tripId)])];
        const trips = Object.fromEntries(
          await Promise.all(
            tripIds.map(async (id) => {
              try {
                return [id, await api.getTrip(id)] as const;
              } catch {
                return [id, null] as const;
              }
            }),
          ),
        );
        const withTickets = new Set(tickets.items.map((item) => item.bookingId));
        const pending = bookings.items.filter((item) => item.status === "PENDING_PAYMENT" && !withTickets.has(item.id));
        setRows([
          ...tickets.items.map((ticket) => {
            const trip = trips[ticket.tripId];
            return {
              key: ticket.id,
              href: `/tickets/${ticket.id}`,
              title: trip ? `${trip.origin} → ${trip.destination}` : ticket.publicCode,
              meta: `Ghế ${ticket.seatCode} · ${ticket.publicCode}${trip ? ` · ${clock(trip.departureAt)}` : ""}`,
              status: ticketStatusLabel(ticket.status),
              amount: trip ? money(trip.fare.amount, trip.fare.currency) : undefined,
              coverId: ticket.tripId,
            };
          }),
          ...pending.map((booking) => {
            const trip = trips[booking.tripId];
            return {
              key: booking.id,
              href: `/checkout/${booking.id}/payment`,
              title: trip ? `${trip.origin} → ${trip.destination}` : "Chuyến đã giữ chỗ",
              meta: `${booking.items.length} ghế · chờ thanh toán`,
              status: "Chờ thanh toán",
              amount: money(booking.total, booking.currency),
              coverId: booking.tripId,
            };
          }),
        ]);
      } catch (err) {
        setError(errorText(err));
      }
    })();
  }, [api]);
  if (error) return <p className="error">{error}</p>;
  if (rows === "loading") {
    return (
      <>
        <h1 className="page-title">Vé của tôi</h1>
        <div className="stack" aria-busy="true">
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      </>
    );
  }
  return (
    <>
      <h1 className="page-title">Vé của tôi</h1>
      <div className="stack">
        {rows.map((row) => (
          <Link className="card ticket-row lift" key={row.key} to={row.href}>
            <img src={coverFor(row.coverId)} alt="" />
            <div>
              <strong>{row.title}</strong>
              <p className="muted">{row.meta}</p>
              {row.amount ? <p className="amount">{row.amount}</p> : null}
            </div>
            <span className={statusPill(row.status)}>{row.status}</span>
          </Link>
        ))}
        {rows.length === 0 ? (
          <EmptyState title="Chưa có vé" body="Tìm chuyến và giữ ghế để nhận vé điện tử trên điện thoại." to="/" action="Tìm chuyến" />
        ) : null}
      </div>
    </>
  );
}

function TicketPage() {
  const { ticketId = "" } = useParams();
  const { api } = useSession();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [companions, setCompanions] = useState<Ticket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reload = () =>
    api.getTicket(ticketId).then(async (current) => {
      setTicket(current);
      const [nextTrip, nextBooking, tickets] = await Promise.all([
        api.getTrip(current.tripId).catch(() => null),
        api.getBooking(current.bookingId).catch(() => null),
        api.listTickets().catch(() => ({ items: [] as Ticket[] })),
      ]);
      setTrip(nextTrip);
      setBooking(nextBooking);
      setCompanions(tickets.items.filter((item) => item.bookingId === current.bookingId));
    });
  useEffect(() => {
    reload().catch((err) => setError(errorText(err)));
  }, [api, ticketId]);
  if (error) return <p className="error">{error}</p>;
  if (!ticket) return <p>Đang tải vé…</p>;
  const showQr = ticket.status === "ISSUED" && Boolean(ticket.qrPayload);
  const pickup = trip?.stops.find((stop) => stop.pickupAllowed)?.name ?? trip?.origin;
  const dropoff = [...(trip?.stops ?? [])].reverse().find((stop) => stop.dropoffAllowed)?.name ?? trip?.destination;
  const seatPrice = trip?.fare;
  const canCancel = Boolean(booking && booking.status !== "CANCELLED" && companions.some((item) => item.status === "ISSUED"));
  return (
    <>
      <h1 className="page-title">Vé điện tử</h1>
      <article className="card ticket">
        <div className="ticket-hero">
          <img src={coverFor(ticket.tripId)} alt="" />
        </div>
        <div className="ticket-band">
          <span>{ticket.publicCode}</span>
          <span>Ghế {ticket.seatCode}</span>
        </div>
        <div className="ticket-body">
          <p>
            <strong>{ticket.passengerName}</strong>
          </p>
          {trip ? (
            <>
              <h2>
                {trip.origin} → {trip.destination}
              </h2>
              <p className="muted">
                {trip.operatorName} · {clock(trip.departureAt)} · {when(trip.departureAt)}
              </p>
              <p className="muted">
                Đón {pickup} · Trả {dropoff}
              </p>
              {seatPrice ? <p className="price">{money(seatPrice.amount, seatPrice.currency)}</p> : null}
            </>
          ) : null}
          <p>
            <span className={statusPill(ticketStatusLabel(ticket.status))}>{ticketStatusLabel(ticket.status)}</span>
            {" · "}
            {channelLabel(ticket.paymentChannel)}
          </p>
          {showQr ? (
            <div className="qr">
              <QRCodeSVG value={ticket.qrPayload!} size={220} marginSize={2} level="M" />
              <p className="muted">Đưa mã này cho tài xế khi lên xe. Mã thay thế: {ticket.publicCode}</p>
            </div>
          ) : (
            <p className="muted">QR không còn hiệu lực cho vé {ticketStatusLabel(ticket.status)}.</p>
          )}
          {companions.filter((item) => item.id !== ticket.id).length > 0 ? (
            <p className="muted">
              Ghế cùng chuyến:{" "}
              {companions
                .filter((item) => item.id !== ticket.id)
                .map((item) => (
                  <Link key={item.id} to={`/tickets/${item.id}`}>
                    {item.seatCode}{" "}
                  </Link>
                ))}
            </p>
          ) : null}
          <div className="stack">
            {booking?.status === "PENDING_PAYMENT" ? (
              <button type="button" onClick={() => navigate(`/checkout/${booking.id}/payment`)}>
                Thanh toán
              </button>
            ) : null}
            {canCancel ? (
              <button
                type="button"
                className="danger"
                onClick={async () => {
                  if (!booking) return;
                  try {
                    const preview = await api.previewCancel(
                      booking.id,
                      companions.map((item) => item.id),
                    );
                    if (window.confirm(`Phí ${money(preview.fee, booking.currency)}, hoàn ${money(preview.refundAmount, booking.currency)}?`)) {
                      await api.cancelBooking(booking.id, {
                        previewId: preview.previewId,
                        reason: "CUSTOMER_REQUEST",
                        expectedVersion: booking.rowVersion,
                      });
                      await reload();
                    }
                  } catch (err) {
                    setError(errorText(err));
                  }
                }}
              >
                Hủy vé
              </button>
            ) : null}
          </div>
        </div>
      </article>
    </>
  );
}

function ProfilePage() {
  const { api, session } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const user = session?.user;
  if (!user) return null;
  return (
    <>
      <h1 className="page-title">Hồ sơ</h1>
      <form
        className="card stack"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          try {
            await api.updateMe({
              fullName: String(data.get("fullName")),
              expectedVersion: user.rowVersion,
            });
            setSaved(true);
            setError(null);
          } catch (err) {
            setError(errorText(err));
          }
        }}
      >
        <label>
          Họ tên
          <input name="fullName" defaultValue={user.fullName} />
        </label>
        <p className="muted">
          {user.email} · {user.phone} · {user.roles.join(", ") || "CUSTOMER"}
        </p>
        {error ? <p className="error">{error}</p> : null}
        {saved ? <p className="muted">Đã lưu.</p> : null}
        <button type="submit">Lưu</button>
      </form>
    </>
  );
}

function NotificationsPage() {
  const { api } = useSession();
  const [items, setItems] = useState<{ id: string; title: string; body: string; read: boolean }[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api
      .listNotifications()
      .then((result) => setItems(result.items))
      .catch((err) => setError(errorText(err)));
  }, [api]);
  return (
    <>
      <h1 className="page-title">Thông báo</h1>
      {error ? <p className="error">{error}</p> : null}
      <div className="stack">
        {items.map((item) => (
          <article className={`card note-card${item.read ? "" : " unread"}`} key={item.id}>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
            {!item.read ? (
              <button className="secondary" onClick={() => api.markNotificationRead(item.id).then(() => setItems((current) => current.map((row) => (row.id === item.id ? { ...row, read: true } : row))))}>
                Đánh dấu đã đọc
              </button>
            ) : (
              <span className="pill pill-muted">Đã đọc</span>
            )}
          </article>
        ))}
        {items.length === 0 ? <EmptyState title="Không có thông báo" body="Khi vé được phát hành hoặc thanh toán xong, thông báo sẽ hiện ở đây." /> : null}
      </div>
    </>
  );
}

export function App() {
  return (
    <SessionProvider>
      <Shell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/trips" element={<TripsPage />} />
          <Route path="/trips/:tripId" element={<TripPage />} />
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/register" element={<RegisterPage />} />
          <Route path="/auth/verify" element={<VerifyPage />} />
          <Route path="/auth/forgot-password" element={<ForgotPage />} />
          <Route path="/auth/reset-password" element={<ResetPage />} />
          <Route
            path="/checkout/:holdToken/passengers"
            element={
              <RequireAuth>
                <PassengersPage />
              </RequireAuth>
            }
          />
          <Route
            path="/checkout/:bookingId/payment"
            element={
              <RequireAuth>
                <PaymentPage />
              </RequireAuth>
            }
          />
          <Route
            path="/payments/:paymentId/result"
            element={
              <RequireAuth>
                <PaymentResultPage />
              </RequireAuth>
            }
          />
          <Route
            path="/bookings"
            element={
              <RequireAuth>
                <Navigate to="/tickets" replace />
              </RequireAuth>
            }
          />
          <Route
            path="/bookings/:bookingId"
            element={
              <RequireAuth>
                <BookingRedirect />
              </RequireAuth>
            }
          />
          <Route
            path="/tickets"
            element={
              <RequireAuth>
                <TicketsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/tickets/:ticketId"
            element={
              <RequireAuth>
                <TicketPage />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />
          <Route
            path="/notifications"
            element={
              <RequireAuth>
                <NotificationsPage />
              </RequireAuth>
            }
          />
        </Routes>
      </Shell>
    </SessionProvider>
  );
}
