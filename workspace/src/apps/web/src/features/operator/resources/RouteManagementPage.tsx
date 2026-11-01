import * as Dialog from "@radix-ui/react-dialog";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useState, type ReactElement, type FormEvent } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { OperatorSidebar } from "../components/OperatorSidebar";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";
import { PageState } from "@/shared/ui/PageState/PageState";
import { getOperatorRoutes, saveOperatorRoute } from "./routesRepository";
import {
  routeFiltersSchema,
  routeInputSchema,
  stopSchema,
  STOP_KIND,
  type RouteInput,
  type OperatorRoute,
  type RouteStop,
} from "./routes.schema";
import "../schedule/SchedulePage.css";
import "./RouteManagementPage.css";
const normalize = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
const inputOf = (route: OperatorRoute): RouteInput => {
  const { updatedAt, ...input } = route;
  void updatedAt;
  return input;
};
type Editor =
  | { type: "route"; route?: OperatorRoute }
  | { type: "stop"; route: OperatorRoute; stop?: RouteStop }
  | { type: "confirm"; route: OperatorRoute; stop?: RouteStop };
type Save = (input: RouteInput, create?: boolean) => void;
function RouteEditor({
  route,
  save,
  pending,
}: {
  route?: OperatorRoute;
  save: Save;
  pending: boolean;
}): ReactElement {
  const [draft, setDraft] = useState(() =>
    route
      ? inputOf(route)
      : {
          id: "RT-",
          origin: "",
          destination: "",
          region: "Miền Nam",
          distance: 100,
          hours: 3,
          status: "active" as const,
          stops: [],
        },
  );
  const [error, setError] = useState("");
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const value = {
      ...draft,
      stops: route
        ? draft.stops
        : [
            {
              id: crypto.randomUUID(),
              name: `Bến xe ${draft.origin}`,
              address: draft.origin,
              kind: "pickup",
              km: 0,
            },
            {
              id: crypto.randomUUID(),
              name: `Bến xe ${draft.destination}`,
              address: draft.destination,
              kind: "dropoff",
              km: draft.distance,
            },
          ],
    };
    const parsed = routeInputSchema.safeParse(value);
    if (!parsed.success) {
      setError(
        "Kiểm tra mã tuyến RT-…, điểm đi/đến khác nhau và khoảng cách các điểm dừng.",
      );
      return;
    }
    setError("");
    save(parsed.data, !route);
  };
  return (
    <form onSubmit={submit} className="operator-routes__editor">
      <Input
        label="Mã tuyến"
        value={draft.id}
        disabled={!!route}
        required
        maxLength={43}
        onChange={(e) =>
          setDraft({ ...draft, id: e.target.value.toUpperCase() })
        }
      />
      <Input
        label="Điểm đi"
        value={draft.origin}
        required
        maxLength={80}
        onChange={(e) => setDraft({ ...draft, origin: e.target.value })}
      />
      <Input
        label="Điểm đến"
        value={draft.destination}
        required
        maxLength={80}
        onChange={(e) => setDraft({ ...draft, destination: e.target.value })}
      />
      <Input
        label="Khu vực"
        value={draft.region}
        required
        maxLength={100}
        onChange={(e) => setDraft({ ...draft, region: e.target.value })}
      />
      <Input
        label="Khoảng cách (km)"
        type="number"
        min={1}
        max={5000}
        step="any"
        value={draft.distance}
        onChange={(e) =>
          setDraft({ ...draft, distance: Number(e.target.value) })
        }
      />
      <Input
        label="Thời gian dự kiến (giờ)"
        type="number"
        min={0.25}
        max={72}
        step=".25"
        value={draft.hours}
        onChange={(e) => setDraft({ ...draft, hours: Number(e.target.value) })}
      />
      {error && <p role="alert">{error}</p>}
      <Button type="submit" isLoading={pending}>
        Lưu tuyến
      </Button>
    </form>
  );
}
function StopEditor({
  route,
  stop,
  save,
  pending,
}: {
  route: OperatorRoute;
  stop?: RouteStop;
  save: Save;
  pending: boolean;
}): ReactElement {
  const [draft, setDraft] = useState<RouteStop>(
    stop ?? {
      id: crypto.randomUUID(),
      name: "",
      address: "",
      kind: "both",
      km: 0,
    },
  );
  const [error, setError] = useState("");
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const parsed = stopSchema.safeParse(draft);
    if (!parsed.success || draft.km > route.distance) {
      setError(
        "Kiểm tra tên, địa chỉ và khoảng cách điểm dừng trong chiều dài tuyến.",
      );
      return;
    }
    save({
      ...inputOf(route),
      stops: stop
        ? route.stops.map((item) => (item.id === stop.id ? parsed.data : item))
        : [...route.stops, parsed.data],
    });
  };
  return (
    <form onSubmit={submit} className="operator-routes__editor">
      <Input
        label="Tên điểm dừng"
        required
        maxLength={100}
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
      />
      <Input
        label="Địa chỉ"
        required
        maxLength={200}
        value={draft.address}
        onChange={(e) => setDraft({ ...draft, address: e.target.value })}
      />
      <label>
        Loại phục vụ
        <select
          value={draft.kind}
          onChange={(e) =>
            setDraft({ ...draft, kind: e.target.value as RouteStop["kind"] })
          }
        >
          {Object.entries(STOP_KIND).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <Input
        label="Khoảng cách từ điểm đi (km)"
        type="number"
        min={0}
        max={route.distance}
        step="any"
        value={draft.km}
        onChange={(e) => setDraft({ ...draft, km: Number(e.target.value) })}
      />
      {error && <p role="alert">{error}</p>}
      <Button type="submit" isLoading={pending}>
        Lưu điểm dừng
      </Button>
    </form>
  );
}
export function RouteManagementPage(): ReactElement {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const parsed = routeFiltersSchema.safeParse(Object.fromEntries(params));
  const applied = parsed.success ? parsed.data : routeFiltersSchema.parse({});
  const [filters, setFilters] = useState({
    ...applied,
    status: params.has("status") ? applied.status : ("active" as const),
  });
  const [editor, setEditor] = useState<Editor | null>(null),
    [notice, setNotice] = useState("");
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["operator", "resource-routes"],
    queryFn: ({ signal }) => getOperatorRoutes(signal),
  });
  const items = query.data ?? [],
    filtered = items.filter(
      (route) =>
        (applied.region === "all" || route.region === applied.region) &&
        (applied.status === "all" || route.status === applied.status) &&
        normalize(
          `${route.id} ${route.name ?? ""} ${route.origin} ${route.destination} ${route.region}`,
        ).includes(normalize(applied.search.trim())),
    );
  const route =
    filtered.find((item) => item.id === applied.route) ?? filtered[0];
  const select = (id: string): void =>
    setParams(new URLSearchParams({ ...applied, route: id }));
  const mutation = useMutation({
    mutationFn: ({ input, create }: { input: RouteInput; create: boolean }) =>
      saveOperatorRoute(input, create),
    onSuccess: (saved) => {
      client.setQueryData<OperatorRoute[]>(
        ["operator", "resource-routes"],
        (old) =>
          old?.some((item) => item.id === saved.id)
            ? old.map((item) => (item.id === saved.id ? saved : item))
            : [...(old ?? []), saved],
      );
      setEditor(null);
      setNotice("Đã lưu thay đổi trong dữ liệu mô phỏng của tab này.");
      setParams(new URLSearchParams({ ...applied, route: saved.id }));
    },
    onError: (error) => setNotice(error.message),
  });
  const save: Save = (input, create = false) => {
    if (mutation.isPending) return;
    setNotice("");
    mutation.mutate({ input, create });
  };
  const open = (value: Editor): void => {
    setNotice("");
    mutation.reset();
    setEditor(value);
  };
  return (
    <div className="operator-schedule operator-routes">
      <OperatorSidebar />
      <main className="operator-schedule__main">
        <header className="operator-schedule__header">
          <h1>Tuyến &amp; điểm dừng</h1>
          <Button onClick={() => void navigate("/operator/routes/new")}>
            + Tạo tuyến mới
          </Button>
        </header>
        <form
          className="operator-routes__toolbar"
          onSubmit={(event) => {
            event.preventDefault();
            setParams(
              new URLSearchParams({ ...filters, route: applied.route }),
            );
          }}
        >
          <label>
            <span>TÌM KIẾM</span>
            <input
              placeholder="Tên tuyến, mã tuyến hoặc tỉnh thành"
              aria-label="Tìm kiếm tuyến"
              maxLength={100}
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
            />
          </label>
          <label>
            <span>KHU VỰC</span>
            <select
              aria-label="Khu vực"
              value={filters.region}
              onChange={(e) =>
                setFilters({ ...filters, region: e.target.value })
              }
            >
              <option value="all">Tất cả khu vực</option>
              {[...new Set(items.map((item) => item.region))].map((region) => (
                <option key={region}>{region}</option>
              ))}
            </select>
          </label>
          <label>
            <span>TRẠNG THÁI</span>
            <select
              aria-label="Trạng thái tuyến"
              value={filters.status}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  status: e.target.value as typeof filters.status,
                })
              }
            >
              <option value="all">Tất cả</option>
              <option value="active">Đang khai thác</option>
              <option value="paused">Tạm ngừng</option>
            </select>
          </label>
          <Button type="submit">Lọc tuyến</Button>
        </form>
        {notice && !editor && (
          <p className="operator-routes__notice" role="status">
            {notice}
          </p>
        )}
        {query.isPending ? (
          <p role="status">Đang tải tuyến…</p>
        ) : query.isError ? (
          <PageState
            title="Không tải được tuyến"
            description={query.error.message}
            action={
              <Button onClick={() => void query.refetch()}>Thử lại</Button>
            }
          />
        ) : (
          <div className="operator-routes__columns">
            <section
              className="operator-routes__list"
              aria-labelledby="route-list-title"
            >
              <h2 id="route-list-title">Danh sách tuyến</h2>
              {filtered.length ? (
                filtered.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    aria-pressed={route?.id === item.id}
                    onClick={() => select(item.id)}
                    className="operator-routes__card"
                  >
                    <small>{item.id}</small>
                    <strong>
                      {item.name ?? `${item.origin} → ${item.destination}`}
                    </strong>
                    <span>
                      {item.stops.length} điểm dừng · {item.distance} km
                    </span>
                    <em
                      className={
                        item.status === "paused"
                          ? "operator-routes__paused"
                          : undefined
                      }
                    >
                      {item.status === "active"
                        ? "Đang khai thác"
                        : "Tạm ngừng"}
                    </em>
                  </button>
                ))
              ) : (
                <PageState
                  title="Không tìm thấy tuyến"
                  description="Thử thay đổi từ khóa hoặc bộ lọc."
                  action={
                    <Button
                      onClick={() => {
                        const defaults = routeFiltersSchema.parse({});
                        setFilters(defaults);
                        setParams(new URLSearchParams(defaults));
                      }}
                    >
                      Đặt lại bộ lọc
                    </Button>
                  }
                />
              )}
              <p>Chọn một tuyến để xem và quản lý điểm dừng.</p>
            </section>
            <section
              className="operator-routes__detail"
              aria-label="Chi tiết tuyến"
            >
              {route ? (
                <>
                  <header className="operator-routes__route-header">
                    <small>{route.id}</small>
                    <h2>
                      {route.name ?? `${route.origin} → ${route.destination}`}
                    </h2>
                    <p>Tuyến đường dài · {route.region}</p>
                    <span
                      className={
                        route.status === "paused"
                          ? "operator-routes__paused"
                          : undefined
                      }
                    >
                      {route.status === "active"
                        ? "Đang khai thác"
                        : "Tạm ngừng"}
                    </span>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        void navigate(
                          `/operator/routes/${encodeURIComponent(route.id)}/edit`,
                          {
                            state: {
                              returnTo: location.pathname + location.search,
                            },
                          },
                        )
                      }
                    >
                      Chỉnh sửa tuyến
                    </Button>
                  </header>
                  <div className="operator-routes__metrics">
                    {[
                      ["KHOẢNG CÁCH", `${route.distance} km`],
                      [
                        "THỜI GIAN DỰ KIẾN",
                        `${String(Math.floor(route.hours)).padStart(2, "0")} giờ${route.hours % 1 ? ` ${Math.round((route.hours % 1) * 60)} phút` : ""}`,
                      ],
                      ["ĐIỂM DỪNG", `${route.stops.length} điểm`],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="operator-routes__stops-heading">
                    <div>
                      <h3>Các điểm đón/trả</h3>
                      <p>Sắp xếp theo hành trình và loại phục vụ</p>
                    </div>
                    <Button
                      variant="secondary"
                      disabled={route.stops.length >= 30}
                      onClick={() => open({ type: "stop", route })}
                    >
                      + Thêm điểm đón/trả
                    </Button>
                  </div>
                  <ol className="operator-routes__stops">
                    {route.stops.map((stop, i) => (
                      <li key={stop.id}>
                        <span className="operator-routes__number">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <strong>{stop.name}</strong>
                          <small>{stop.address}</small>
                        </div>
                        <span className="operator-routes__kind">
                          {STOP_KIND[stop.kind]}
                        </span>
                        <small>{stop.km} km</small>
                        <Menu.Root>
                          <Menu.Trigger asChild>
                            <button
                              type="button"
                              aria-label={`Tùy chọn ${stop.name}`}
                            >
                              •••
                            </button>
                          </Menu.Trigger>
                          <Menu.Portal>
                            <Menu.Content
                              className="operator-routes__menu"
                              sideOffset={6}
                            >
                              <Menu.Item
                                onSelect={() =>
                                  open({ type: "stop", route, stop })
                                }
                              >
                                Chỉnh sửa điểm dừng
                              </Menu.Item>
                              <Menu.Item
                                disabled={route.stops.length <= 2}
                                onSelect={() =>
                                  open({ type: "confirm", route, stop })
                                }
                              >
                                Xóa điểm dừng
                              </Menu.Item>
                            </Menu.Content>
                          </Menu.Portal>
                        </Menu.Root>
                      </li>
                    ))}
                  </ol>
                  <footer className="operator-routes__footer">
                    <Button
                      variant="secondary"
                      className={
                        route.status === "active"
                          ? "operator-routes__disable"
                          : ""
                      }
                      onClick={() => open({ type: "confirm", route })}
                    >
                      {route.status === "active"
                        ? "Tạm ngừng tuyến"
                        : "Khai thác lại tuyến"}
                    </Button>
                    <p>
                      Cập nhật lần cuối{" "}
                      {new Intl.DateTimeFormat("vi-VN", {
                        timeZone: "Asia/Ho_Chi_Minh",
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      }).format(new Date(route.updatedAt))}{" "}
                      ·{" "}
                      {new Intl.DateTimeFormat("vi-VN", {
                        timeZone: "Asia/Ho_Chi_Minh",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      }).format(new Date(route.updatedAt))}
                    </p>
                  </footer>
                </>
              ) : (
                <PageState
                  title="Chưa chọn tuyến"
                  description="Chọn tuyến trong danh sách hoặc tạo tuyến mới."
                />
              )}
            </section>
          </div>
        )}
        <Dialog.Root
          open={!!editor}
          onOpenChange={(value) => {
            if (!value && !mutation.isPending) setEditor(null);
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="operator-routes__overlay" />
            <Dialog.Content className="operator-routes__dialog">
              <Dialog.Title>
                {editor?.type === "route"
                  ? editor.route
                    ? "Chỉnh sửa tuyến"
                    : "Tạo tuyến mới"
                  : editor?.type === "stop"
                    ? editor.stop
                      ? "Chỉnh sửa điểm dừng"
                      : "Thêm điểm đón/trả"
                    : editor?.stop
                      ? "Xóa điểm dừng"
                      : "Thay đổi trạng thái tuyến"}
              </Dialog.Title>
              <Dialog.Description>
                {editor?.type === "confirm"
                  ? editor.stop
                    ? `Xóa ${editor.stop.name} khỏi tuyến ${editor.route.id}?`
                    : `${editor.route.status === "active" ? "Tạm ngừng" : "Khai thác lại"} tuyến ${editor.route.origin} → ${editor.route.destination}?`
                  : "Thay đổi được lưu trong dữ liệu mô phỏng của tab hiện tại. Điểm dừng được xếp theo khoảng cách từ điểm đi."}
              </Dialog.Description>
              {editor?.type === "route" && (
                <RouteEditor
                  key={editor.route?.id ?? "new"}
                  route={editor.route}
                  save={save}
                  pending={mutation.isPending}
                />
              )}
              {editor?.type === "stop" && (
                <StopEditor
                  key={editor.stop?.id ?? "new-stop"}
                  route={editor.route}
                  stop={editor.stop}
                  save={save}
                  pending={mutation.isPending}
                />
              )}
              {editor?.type === "confirm" && (
                <Button
                  isLoading={mutation.isPending}
                  onClick={() =>
                    save({
                      ...inputOf(editor.route),
                      ...(editor.stop
                        ? {
                            stops: editor.route.stops.filter(
                              (stop) => stop.id !== editor.stop?.id,
                            ),
                          }
                        : {
                            status:
                              editor.route.status === "active"
                                ? "paused"
                                : "active",
                          }),
                    })
                  }
                >
                  Xác nhận
                </Button>
              )}
              {notice && <p role="alert">{notice}</p>}
              <Button
                variant="ghost"
                disabled={mutation.isPending}
                onClick={() => setEditor(null)}
              >
                Hủy
              </Button>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </main>
    </div>
  );
}
