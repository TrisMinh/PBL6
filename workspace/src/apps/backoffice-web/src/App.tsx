import { ApiError, type Booking, type Payment, type Trip } from "@busticket/api-client";
import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { SessionProvider, useSession } from "./session";

type Manifest = {
  tripId: string;
  generatedAt: string;
  passengers: { ticketId: string; passengerName: string; seatCode: string; pickupStopName: string; status: string }[];
};

function errorText(error: unknown) {
  return error instanceof ApiError ? `${error.code}: ${error.message}` : "Không thực hiện được.";
}

function when(value: string) {
  return new Date(value).toLocaleString("vi-VN");
}

function money(amount: number, currency = "VND") {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency }).format(amount);
}

function Shell({ children }: { children: ReactNode }) {
  const { session, api } = useSession();
  const navigate = useNavigate();
  if (!session) return <>{children}</>;
  return (
    <div className="layout">
      <aside>
        <strong>BusTicket Ops</strong>
        <Link to="/app/dashboard">Tổng quan</Link>
        <Link to="/app/trips">Chuyến xe</Link>
        <Link to="/app/fleet">Xe / tuyến / tài xế</Link>
        <Link to="/app/bookings">Đơn đặt vé</Link>
        <Link to="/app/payments">Thanh toán</Link>
        <Link to="/app/reports">Báo cáo</Link>
        <Link to="/app/driver">Lịch tài xế</Link>
        <button
          className="secondary"
          onClick={async () => {
            await api.logout();
            navigate("/login");
          }}
        >
          Đăng xuất
        </button>
      </aside>
      <main>{children}</main>
    </div>
  );
}

function LoginPage() {
  const { api, session } = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  if (session) return <Navigate to="/app/dashboard" replace />;
  return (
    <main>
      <h1>Đăng nhập back-office</h1>
      <form
        className="card stack"
        onSubmit={async (event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          try {
            await api.login(String(data.get("identifier")), String(data.get("password")));
            navigate("/app/dashboard");
          } catch (err) {
            setError(errorText(err));
          }
        }}
      >
        <label>
          Tài khoản
          <input name="identifier" required defaultValue="operator.seed@example.test" autoComplete="username" />
        </label>
        <label>
          Mật khẩu
          <input name="password" type="password" required defaultValue="OperatorPass1" autoComplete="current-password" />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit">Vào hệ thống</button>
        <p className="muted">
          Operator: operator.seed@example.test / OperatorPass1
          <br />
          Admin: admin.seed@example.test / AdminPass1234
          <br />
          Driver: driver.seed@example.test / DriverPass1
        </p>
      </form>
    </main>
  );
}

function Guard({ children }: { children: ReactNode }) {
  const { session } = useSession();
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function DashboardPage() {
  const { session, api } = useSession();
  const [org, setOrg] = useState<{ name: string; status: string; allowPayLater?: boolean; contactEmail?: string; contactPhone?: string; rowVersion: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api
      .operatorOrganization()
      .then(setOrg)
      .catch(() => setOrg(null));
  }, [api]);
  return (
    <>
      <h1>Tổng quan</h1>
      <p>Xin chào {session?.user.fullName}.</p>
      <p className="muted">Quyền: {session?.user.roles.join(", ") || "không có role trên token"}.</p>
      {org ? (
        <form
          className="card stack"
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            try {
              await api.patchOrganization({
                name: org.name,
                contactEmail: org.contactEmail ?? "operator.seed@example.test",
                contactPhone: org.contactPhone ?? "+840000000000",
                allowPayLater: data.get("allowPayLater") === "on",
                expectedVersion: org.rowVersion,
              });
              setOrg(await api.operatorOrganization());
              setError(null);
            } catch (err) {
              setError(errorText(err));
            }
          }}
        >
          <p>
            Tổ chức: {org.name} ({org.status})
          </p>
          <label className="row">
            <input key={org.rowVersion} type="checkbox" name="allowPayLater" defaultChecked={Boolean(org.allowPayLater)} />
            Cho phép trả sau
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit">Lưu</button>
        </form>
      ) : (
        <p className="muted">Không đọc được tổ chức (đăng nhập PLATFORM_ADMIN thì dùng màn báo cáo / thanh toán).</p>
      )}
    </>
  );
}

type FleetBus = { id: string; plateNumber: string; type: string; status: string; expectedVersion: number; seats: { code: string }[] };
type FleetDriver = { id: string; userId: string; licenseNumber: string; licenseExpiresOn: string; status: string; expectedVersion: number };
type FleetRoute = { id: string; name: string; origin: string; destination: string; status: string; expectedVersion: number };

function TripsPage() {
  const { api } = useSession();
  const [items, setItems] = useState<Trip[]>([]);
  const [buses, setBuses] = useState<FleetBus[]>([]);
  const [drivers, setDrivers] = useState<FleetDriver[]>([]);
  const [routes, setRoutes] = useState<FleetRoute[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reload = () =>
    Promise.all([api.operatorTrips(), api.operatorBuses(), api.operatorDrivers(), api.operatorRoutes()])
      .then(([page, nextBuses, nextDrivers, nextRoutes]) => {
        setItems(page.items);
        setBuses(nextBuses);
        setDrivers(nextDrivers);
        setRoutes(nextRoutes);
      })
      .catch((err) => setError(errorText(err)));
  useEffect(() => {
    reload();
  }, [api]);
  return (
    <>
      <h1>Chuyến xe</h1>
      {error ? <p className="error">{error}</p> : null}
      <form
        className="card stack"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          try {
            await api.createTrip({
              routeId: String(data.get("routeId")),
              busId: String(data.get("busId")),
              driverId: String(data.get("driverId")),
              departureAt: new Date(String(data.get("departureAt"))).toISOString(),
              arrivalAt: new Date(String(data.get("arrivalAt"))).toISOString(),
              fare: { amount: Number(data.get("fare")), currency: "VND" },
              policyVersion: "cancel-mvp-v1",
              expectedVersion: 0,
            });
            setError(null);
            await reload();
          } catch (err) {
            setError(errorText(err));
          }
        }}
      >
        <p>
          <strong>Tạo chuyến nháp</strong>
        </p>
        <label>
          Tuyến
          <select name="routeId" required>
            {routes.map((route) => (
              <option key={route.id} value={route.id}>
                {route.name} ({route.origin} → {route.destination})
              </option>
            ))}
          </select>
        </label>
        <label>
          Xe
          <select name="busId" required>
            {buses.map((bus) => (
              <option key={bus.id} value={bus.id}>
                {bus.plateNumber} · {bus.type}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tài xế
          <select name="driverId" required>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.licenseNumber}
              </option>
            ))}
          </select>
        </label>
        <label>
          Giờ đi
          <input name="departureAt" type="datetime-local" required defaultValue="2026-12-15T08:00" />
        </label>
        <label>
          Giờ đến
          <input name="arrivalAt" type="datetime-local" required defaultValue="2026-12-15T12:00" />
        </label>
        <label>
          Giá (VND)
          <input name="fare" type="number" min={1000} step={1000} required defaultValue={150000} />
        </label>
        <button type="submit" disabled={buses.length === 0 || routes.length === 0 || drivers.length === 0}>
          Tạo chuyến
        </button>
        {drivers.length === 0 ? <p className="muted">Cần có tài xế ở mục Xe / tuyến / tài xế trước khi tạo chuyến.</p> : null}
      </form>
      <table>
        <thead>
          <tr>
            <th>Tuyến</th>
            <th>Giờ đi</th>
            <th>Trạng thái</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((trip) => (
            <tr key={trip.id}>
              <td>
                {trip.origin} → {trip.destination}
              </td>
              <td>{when(trip.departureAt)}</td>
              <td>{trip.status}</td>
              <td className="row">
                <button
                  className="secondary"
                  onClick={async () => {
                    try {
                      await api.operatorPublish(trip.id, trip.rowVersion);
                      await reload();
                    } catch (err) {
                      setError(errorText(err));
                    }
                  }}
                >
                  Publish
                </button>
                <button
                  className="secondary"
                  onClick={async () => {
                    try {
                      await api.operatorCancelTrip(trip.id, trip.rowVersion);
                      await reload();
                    } catch (err) {
                      setError(errorText(err));
                    }
                  }}
                >
                  Hủy chuyến
                </button>
                <Link to={`/app/trips/${trip.id}/manifest`}>Manifest</Link>
              </td>
            </tr>
          ))}
          {items.length === 0 ? (
            <tr>
              <td colSpan={4}>Chưa có chuyến. Seed trip 01/12/2026 Seed Origin → Seed Destination.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}

function ManifestPage() {
  const { tripId = "" } = useParams();
  const { api } = useSession();
  const [data, setData] = useState<Manifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const reload = () =>
    api
      .manifest(tripId)
      .then(setData)
      .catch((err) => setError(errorText(err)));
  useEffect(() => {
    reload();
  }, [api, tripId]);
  return (
    <>
      <h1>Manifest</h1>
      {error ? <p className="error">{error}</p> : null}
      <p className="muted">Trip {tripId}</p>
      <table>
        <thead>
          <tr>
            <th>Ghế</th>
            <th>Hành khách</th>
            <th>Đón</th>
            <th>Trạng thái</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(data?.passengers ?? []).map((row) => (
            <tr key={row.ticketId}>
              <td>{row.seatCode}</td>
              <td>{row.passengerName}</td>
              <td>{row.pickupStopName}</td>
              <td>{row.status}</td>
              <td>
                <button
                  className="secondary"
                  disabled={row.status !== "ISSUED"}
                  onClick={async () => {
                    try {
                      const ticket = await api.getTicket(row.ticketId);
                      await api.checkIn(ticket.id, {
                        tripId,
                        scannedToken: ticket.id,
                        expectedVersion: ticket.rowVersion,
                      });
                      await reload();
                    } catch (err) {
                      setError(errorText(err));
                    }
                  }}
                >
                  Check-in
                </button>
              </td>
            </tr>
          ))}
          {(data?.passengers ?? []).length === 0 ? (
            <tr>
              <td colSpan={5}>Chưa có hành khách.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <form
        className="card stack"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            const scannedToken = token.trim();
            const checked = await api.validateTicket({ tripId, scannedToken });
            if (!checked.valid || !checked.ticket) {
              setError(checked.reasonCode ? `Vé không hợp lệ: ${checked.reasonCode}` : "QR/mã vé không khớp chuyến này.");
              return;
            }
            await api.checkIn(checked.ticket.id, {
              tripId,
              scannedToken,
              expectedVersion: checked.ticket.rowVersion,
            });
            setToken("");
            setError(null);
            await reload();
          } catch (err) {
            setError(errorText(err));
          }
        }}
      >
        <label>
          Check-in bằng QR hoặc mã vé
          <input value={token} onChange={(event) => setToken(event.target.value)} placeholder="Dán QR (BT1.…) hoặc mã TKxxxx" />
        </label>
        <button type="submit">Quét / check-in</button>
      </form>
    </>
  );
}

function BookingsPage() {
  const { api } = useSession();
  const [items, setItems] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api
      .adminBookings()
      .then((page) => setItems(page.items))
      .catch((err) => setError(errorText(err)));
  }, [api]);
  return (
    <>
      <h1>Đơn đặt vé</h1>
      {error ? <p className="error">{error}</p> : null}
      <table>
        <thead>
          <tr>
            <th>Mã</th>
            <th>Trạng thái</th>
            <th>Kênh</th>
            <th>Tổng</th>
          </tr>
        </thead>
        <tbody>
          {items.map((booking) => (
            <tr key={booking.id}>
              <td>{booking.code}</td>
              <td>{booking.status}</td>
              <td>{booking.paymentChannel}</td>
              <td>{money(booking.total, booking.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function PaymentsPage() {
  const { api } = useSession();
  const [items, setItems] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api
      .adminPayments()
      .then((page) => setItems(page.items))
      .catch((err) => setError(errorText(err)));
  }, [api]);
  return (
    <>
      <h1>Thanh toán</h1>
      {error ? <p className="error">{error}</p> : null}
      <table>
        <thead>
          <tr>
            <th>Id</th>
            <th>Đơn</th>
            <th>Trạng thái</th>
            <th>Số tiền</th>
          </tr>
        </thead>
        <tbody>
          {items.map((payment) => (
            <tr key={payment.id}>
              <td>{payment.id}</td>
              <td>{payment.bookingId}</td>
              <td>{payment.status}</td>
              <td>{money(payment.amount, payment.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function reportRows(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== "object") return [];
  const payload = (data as { data?: unknown }).data;
  return Array.isArray(payload) ? payload.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object") : [];
}

function ReportsPage() {
  const { api } = useSession();
  const [kind, setKind] = useState<"revenue" | "bookings" | "occupancy">("revenue");
  const [from, setFrom] = useState("2026-09-01T00:00");
  const [to, setTo] = useState("2026-12-31T23:59");
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const rows = reportRows(data);
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  return (
    <>
      <h1>Báo cáo</h1>
      <p className="muted">Khoảng mặc định phủ cả đơn đặt hôm nay và chuyến seed 01/12/2026. Power BI không nằm trong MVP.</p>
      <div className="stack">
        <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
          <option value="revenue">Doanh thu</option>
          <option value="bookings">Đơn</option>
          <option value="occupancy">Lấp đầy</option>
        </select>
        <label>
          Từ
          <input type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label>
          Đến
          <input type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <button
          onClick={async () => {
            try {
              setError(null);
              setData(await api.report(kind, new Date(from).toISOString(), new Date(to).toISOString()));
            } catch (err) {
              setError(errorText(err));
            }
          }}
        >
          Tải báo cáo
        </button>
        {error ? <p className="error">{error}</p> : null}
        {rows.length === 0 ? (
          <p className="muted">{data ? "Không có dòng trong khoảng đã chọn." : "Chưa tải."}</p>
        ) : (
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {columns.map((column) => (
                    <td key={column}>{String(row[column] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function FleetPage() {
  const { api } = useSession();
  const [buses, setBuses] = useState<FleetBus[]>([]);
  const [drivers, setDrivers] = useState<FleetDriver[]>([]);
  const [routes, setRoutes] = useState<FleetRoute[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reload = () =>
    Promise.all([api.operatorBuses(), api.operatorDrivers(), api.operatorRoutes()])
      .then(([nextBuses, nextDrivers, nextRoutes]) => {
        setBuses(nextBuses);
        setDrivers(nextDrivers);
        setRoutes(nextRoutes);
      })
      .catch((err) => setError(errorText(err)));
  useEffect(() => {
    reload();
  }, [api]);
  return (
    <>
      <h1>Xe / tuyến / tài xế</h1>
      {error ? <p className="error">{error}</p> : null}
      <div className="stack">
        <form
          className="card stack"
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            try {
              await api.createBus({
                plateNumber: String(data.get("plateNumber")),
                type: String(data.get("type")),
                amenities: ["WIFI"],
                expectedVersion: 0,
              });
              event.currentTarget.reset();
              setError(null);
              await reload();
            } catch (err) {
              setError(errorText(err));
            }
          }}
        >
          <p>
            <strong>Thêm xe</strong>
          </p>
          <label>
            Biển số
            <input name="plateNumber" required minLength={5} maxLength={20} placeholder="29B-12345" />
          </label>
          <label>
            Loại
            <select name="type" defaultValue="STANDARD">
              <option value="STANDARD">STANDARD</option>
              <option value="LIMOUSINE">LIMOUSINE</option>
              <option value="SLEEPER">SLEEPER</option>
            </select>
          </label>
          <button type="submit">Tạo xe</button>
        </form>
        <table>
          <thead>
            <tr>
              <th>Biển số</th>
              <th>Loại</th>
              <th>Ghế</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {buses.map((bus) => (
              <tr key={bus.id}>
                <td>{bus.plateNumber}</td>
                <td>{bus.type}</td>
                <td>{bus.seats?.map((seat) => seat.code).join(", ") || "—"}</td>
                <td>{bus.status}</td>
              </tr>
            ))}
            {buses.length === 0 ? (
              <tr>
                <td colSpan={4}>Chưa có xe.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <form
          className="card stack"
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            try {
              await api.createDriver({
                userId: String(data.get("userId")),
                licenseNumber: String(data.get("licenseNumber")),
                licenseExpiresOn: String(data.get("licenseExpiresOn")),
                expectedVersion: 0,
              });
              event.currentTarget.reset();
              setError(null);
              await reload();
            } catch (err) {
              setError(errorText(err));
            }
          }}
        >
          <p>
            <strong>Thêm tài xế</strong>
          </p>
          <label>
            User ID (Identity)
            <input name="userId" required placeholder="UUID tài khoản DRIVER từ Identity" />
          </label>
          <label>
            GPLX
            <input name="licenseNumber" required placeholder="SEED-LIC-002" />
          </label>
          <label>
            Hết hạn
            <input name="licenseExpiresOn" type="date" required defaultValue="2027-12-31" />
          </label>
          <button type="submit">Tạo tài xế</button>
        </form>
        <table>
          <thead>
            <tr>
              <th>GPLX</th>
              <th>User</th>
              <th>Hết hạn</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((driver) => (
              <tr key={driver.id}>
                <td>{driver.licenseNumber}</td>
                <td>{driver.userId}</td>
                <td>{driver.licenseExpiresOn}</td>
                <td>{driver.status}</td>
              </tr>
            ))}
            {drivers.length === 0 ? (
              <tr>
                <td colSpan={4}>Chưa có tài xế. Seed driver.seed@example.test nếu DB chưa apply 012_seed_driver.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <form
          className="card stack"
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            try {
              await api.createRoute({
                name: String(data.get("name")),
                origin: String(data.get("origin")),
                destination: String(data.get("destination")),
                durationMinutes: Number(data.get("durationMinutes")),
                expectedVersion: 0,
              });
              event.currentTarget.reset();
              setError(null);
              await reload();
            } catch (err) {
              setError(errorText(err));
            }
          }}
        >
          <p>
            <strong>Thêm tuyến</strong>
          </p>
          <label>
            Tên tuyến
            <input name="name" required placeholder="Hà Nội → Đà Nẵng" />
          </label>
          <label>
            Điểm đi
            <input name="origin" required placeholder="Hà Nội" />
          </label>
          <label>
            Điểm đến
            <input name="destination" required placeholder="Đà Nẵng" />
          </label>
          <label>
            Thời gian (phút)
            <input name="durationMinutes" type="number" min={1} required defaultValue={240} />
          </label>
          <button type="submit">Tạo tuyến</button>
        </form>
        <table>
          <thead>
            <tr>
              <th>Tên</th>
              <th>Tuyến</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((route) => (
              <tr key={route.id}>
                <td>{route.name}</td>
                <td>
                  {route.origin} → {route.destination}
                </td>
                <td>{route.status}</td>
              </tr>
            ))}
            {routes.length === 0 ? (
              <tr>
                <td colSpan={3}>Chưa có tuyến.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DriverPage() {
  const { api } = useSession();
  const [data, setData] = useState<{ tripId: string; startAt: string; endAt: string; label?: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api
      .driverAssignments()
      .then(async (rows) => {
        const labelled = await Promise.all(
          rows.map(async (row) => {
            try {
              const trip = await api.getTrip(row.tripId);
              return { ...row, label: `${trip.origin} → ${trip.destination}` };
            } catch {
              return { ...row, label: row.tripId };
            }
          }),
        );
        setData(labelled);
      })
      .catch((err) => setError(errorText(err)));
  }, [api]);
  return (
    <>
      <h1>Lịch tài xế</h1>
      {error ? <p className="error">{error}</p> : null}
      <table>
        <thead>
          <tr>
            <th>Trip</th>
            <th>Bắt đầu</th>
            <th>Kết thúc</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={`${row.tripId}-${row.startAt}`}>
              <td>
                <Link to={`/app/trips/${row.tripId}/manifest`}>{row.label ?? row.tripId}</Link>
              </td>
              <td>{new Date(row.startAt).toLocaleString("vi-VN")}</td>
              <td>{new Date(row.endAt).toLocaleString("vi-VN")}</td>
            </tr>
          ))}
          {data.length === 0 ? (
            <tr>
              <td colSpan={3}>Không có phân công. Đăng nhập driver.seed@example.test nếu đang dùng tài khoản operator.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}

export function App() {
  return (
    <SessionProvider>
      <Shell>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
          <Route
            path="/app/dashboard"
            element={
              <Guard>
                <DashboardPage />
              </Guard>
            }
          />
          <Route
            path="/app/trips"
            element={
              <Guard>
                <TripsPage />
              </Guard>
            }
          />
          <Route
            path="/app/trips/:tripId/manifest"
            element={
              <Guard>
                <ManifestPage />
              </Guard>
            }
          />
          <Route
            path="/app/fleet"
            element={
              <Guard>
                <FleetPage />
              </Guard>
            }
          />
          <Route
            path="/app/bookings"
            element={
              <Guard>
                <BookingsPage />
              </Guard>
            }
          />
          <Route
            path="/app/payments"
            element={
              <Guard>
                <PaymentsPage />
              </Guard>
            }
          />
          <Route
            path="/app/reports"
            element={
              <Guard>
                <ReportsPage />
              </Guard>
            }
          />
          <Route
            path="/app/driver"
            element={
              <Guard>
                <DriverPage />
              </Guard>
            }
          />
        </Routes>
      </Shell>
    </SessionProvider>
  );
}
