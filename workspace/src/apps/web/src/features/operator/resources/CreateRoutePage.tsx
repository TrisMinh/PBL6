import { AddRouteStopModal } from "./AddRouteStopModal";
import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState, type ReactElement, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { OperatorSidebar } from "../components/OperatorSidebar";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";
import {
  routeInputSchema,
  stopSchema,
  STOP_KIND,
  type RouteStop,
  type OperatorRoute,
} from "./routes.schema";
import { saveOperatorRoute } from "./routesRepository";
import {
  loadCreateRouteDraft,
  draftFromExistingRoute,
  saveCreateRouteDraft,
  CREATE_ROUTE_DRAFT_KEY,
  type CreateRouteDraft,
} from "./createRouteDraft";
import "../schedule/SchedulePage.css";
import "./RouteManagementPage.css";
import "./CreateRoutePage.css";

function RouteField({
  label,
  value,
  type = "text",
  maxLength,
  disabled,
  onChange,
}: {
  label: string;
  value: string | number;
  type?: string;
  maxLength?: number;
  disabled?: boolean;
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <label className="operator-new-route__field">
      <span>{label}</span>
      <input
        aria-label={label}
        disabled={disabled}
        type={type}
        step={type === "number" ? "any" : undefined}
        min={type === "number" ? 0 : undefined}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function DraftStopEditor({
  stop,
  distance,
  save,
}: {
  stop?: RouteStop;
  distance: number;
  save: (stop: RouteStop) => void;
}): ReactElement {
  const [value, setValue] = useState<RouteStop>(
    () =>
      stop ?? {
        id: crypto.randomUUID(),
        name: "",
        address: "",
        kind: "both",
        km: 0,
      },
  );
  const [error, setError] = useState("");
  return (
    <form
      className="operator-routes__editor"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = stopSchema.safeParse(value);
        if (!parsed.success || value.km > distance) {
          setError(
            "Điền đầy đủ tên/địa chỉ và khoảng cách trong chiều dài tuyến.",
          );
          return;
        }
        save(parsed.data);
      }}
    >
      <Input
        label="Tên điểm dừng"
        value={value.name}
        required
        maxLength={100}
        onChange={(e) => setValue({ ...value, name: e.target.value })}
      />
      <Input
        label="Địa chỉ"
        value={value.address}
        required
        maxLength={200}
        onChange={(e) => setValue({ ...value, address: e.target.value })}
      />
      <label>
        Loại phục vụ
        <select
          value={value.kind}
          onChange={(e) =>
            setValue({ ...value, kind: e.target.value as RouteStop["kind"] })
          }
        >
          {Object.entries(STOP_KIND).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <Input
        label="Khoảng cách từ điểm đầu (km)"
        type="number"
        min={0}
        max={distance}
        step="any"
        required
        value={value.km}
        onChange={(e) => setValue({ ...value, km: Number(e.target.value) })}
      />
      {error && <p role="alert">{error}</p>}
      <Button type="submit">Lưu điểm dừng</Button>
    </form>
  );
}
export function CreateRoutePage({
  route,
  returnTo = "/operator/routes",
}: { route?: OperatorRoute; returnTo?: string } = {}): ReactElement {
  const [draft, setDraft] = useState(() =>
      route ? draftFromExistingRoute(route) : loadCreateRouteDraft(),
    ),
    [message, setMessage] = useState(""),
    [errors, setErrors] = useState<string[]>([]);
  const [stopEditor, setStopEditor] = useState<{ stop?: RouteStop } | null>(
    null,
  );
  const navigate = useNavigate(),
    client = useQueryClient();
  const lock = useRef(false);
  const mutation = useMutation({
    mutationFn: (input: CreateRouteDraft) => saveOperatorRoute(input, !route),
    onSuccess: (saved) => {
      client.setQueryData<OperatorRoute[]>(
        ["operator", "resource-routes"],
        (old) =>
          old?.some((item) => item.id === saved.id)
            ? old.map((item) => (item.id === saved.id ? saved : item))
            : [...(old ?? []), saved],
      );
      try {
        if (!route) sessionStorage.removeItem(CREATE_ROUTE_DRAFT_KEY);
      } catch {
        /* Route creation has already succeeded. */
      }
      void navigate(
        `/operator/routes?route=${encodeURIComponent(saved.id)}&status=all`,
      );
    },
    onError: (error) => {
      lock.current = false;
      setErrors([error.message]);
    },
  });
  const update = <K extends keyof CreateRouteDraft>(
    key: K,
    value: CreateRouteDraft[K],
  ): void => {
    setDraft((old) => ({ ...old, [key]: value }));
    setMessage("Có thay đổi chưa lưu");
    setErrors([]);
  };
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (lock.current) return;
    const parsed = routeInputSchema.safeParse(draft);
    if (!parsed.success) {
      const issues: string[] = [];
      if (!/^RT-[A-Z0-9-]{3,40}$/.test(draft.id))
        issues.push(
          "Mã tuyến phải bắt đầu RT- và chỉ gồm chữ in hoa, số, dấu gạch ngang.",
        );
      if (
        !draft.name.trim() ||
        !draft.origin.trim() ||
        !draft.destination.trim()
      )
        issues.push("Nhập tên tuyến, điểm đầu và điểm cuối.");
      if (draft.origin === draft.destination)
        issues.push("Điểm đầu và điểm cuối phải khác nhau.");
      if (draft.stops.length < 2) issues.push("Cần ít nhất hai điểm đón/trả.");
      if (draft.stops.some((stop) => stop.km > draft.distance))
        issues.push("Khoảng cách điểm dừng không được vượt chiều dài tuyến.");
      if (!issues.length)
        issues.push("Kiểm tra khoảng cách, thời lượng và thông tin điểm dừng.");
      setErrors(issues);
      return;
    }
    lock.current = true;
    setErrors([]);
    mutation.mutate({ ...draft, ...parsed.data });
  };
  return (
    <div className="operator-schedule operator-routes operator-new-route">
      <OperatorSidebar />
      <main className="operator-schedule__main">
        <header className="operator-schedule__header">
          <h1>{route ? `Chỉnh sửa tuyến ${route.id}` : "Tạo tuyến mới"}</h1>
          <Link to={returnTo} className="operator-new-route__back">
            ← Quản lý tuyến
          </Link>
        </header>
        <form onSubmit={submit}>
          <div className="operator-new-route__top">
            <section className="operator-new-route__panel operator-new-route__basic">
              <h2>Thông tin tuyến</h2>
              <p>Khai báo thông tin cơ bản trước khi thêm các điểm dừng.</p>
              <div className="operator-new-route__basic-fields">
                <RouteField
                  label="MÃ TUYẾN"
                  disabled={!!route}
                  value={draft.id}
                  maxLength={43}
                  onChange={(value) => update("id", value.toUpperCase())}
                />
                <RouteField
                  label="TÊN TUYẾN"
                  value={draft.name}
                  maxLength={100}
                  onChange={(value) => update("name", value)}
                />
                <div className="operator-new-route__two">
                  <RouteField
                    label="ĐIỂM ĐẦU"
                    value={draft.origin}
                    maxLength={80}
                    onChange={(value) => update("origin", value)}
                  />
                  <RouteField
                    label="ĐIỂM CUỐI"
                    value={draft.destination}
                    maxLength={80}
                    onChange={(value) => update("destination", value)}
                  />
                </div>
                <div className="operator-new-route__two">
                  <RouteField
                    label="KHOẢNG CÁCH (km)"
                    type="number"
                    value={draft.distance}
                    onChange={(value) => update("distance", Number(value))}
                  />
                  <RouteField
                    label="THỜI LƯỢNG (giờ)"
                    type="number"
                    value={draft.hours}
                    onChange={(value) => update("hours", Number(value))}
                  />
                </div>
              </div>
            </section>
            <section className="operator-new-route__panel operator-new-route__stop-editor">
              <h2>Điểm đón/trả trên tuyến</h2>
              <p>Thêm điểm đón hoặc điểm trả rồi sắp xếp theo hành trình.</p>
              <ol className="operator-new-route__stops">
                {draft.stops.map((stop, index) => (
                  <li key={stop.id}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <button
                      type="button"
                      className="operator-new-route__stop-info"
                      aria-label={`Chỉnh sửa ${stop.name}`}
                      onClick={() => setStopEditor({ stop })}
                    >
                      <strong>{stop.name}</strong>
                      <small>{stop.address}</small>
                      <em>{STOP_KIND[stop.kind]}</em>
                    </button>
                    <button
                      type="button"
                      className="operator-new-route__remove"
                      aria-label={`Xóa ${stop.name}`}
                      onClick={() =>
                        update(
                          "stops",
                          draft.stops.filter((item) => item.id !== stop.id),
                        )
                      }
                    >
                      Xóa
                    </button>
                  </li>
                ))}
              </ol>
              <Button
                type="button"
                variant="secondary"
                disabled={draft.stops.length >= 30}
                className="operator-new-route__add"
                onClick={() => setStopEditor({})}
              >
                + Thêm điểm đón/trả
              </Button>
            </section>
          </div>
          <section className="operator-new-route__panel operator-new-route__operations">
            <h2>Thiết lập vận hành</h2>
            <p>Xác định cách tuyến được sử dụng khi tạo chuyến.</p>
            <div className="operator-new-route__two">
              <label className="operator-new-route__field">
                <span>TRẠNG THÁI TUYẾN</span>
                <select
                  aria-label="Trạng thái tuyến"
                  value={draft.status}
                  onChange={(e) =>
                    update(
                      "status",
                      e.target.value as CreateRouteDraft["status"],
                    )
                  }
                >
                  <option value="active">Đang khai thác</option>
                  <option value="paused">Tạm ngừng</option>
                </select>
              </label>
              <label className="operator-new-route__field">
                <span>CHIỀU KHAI THÁC</span>
                <select
                  aria-label="Chiều khai thác"
                  value={draft.direction}
                  onChange={(e) =>
                    update(
                      "direction",
                      e.target.value as CreateRouteDraft["direction"],
                    )
                  }
                >
                  <option value="both">Hai chiều</option>
                  <option value="one-way">Một chiều</option>
                </select>
              </label>
            </div>
            <label className="operator-new-route__field operator-new-route__note">
              <span>GHI CHÚ NỘI BỘ</span>
              <textarea
                aria-label="Ghi chú nội bộ"
                placeholder="Nhập lưu ý dành cho nhân viên vận hành tuyến..."
                value={draft.note}
                maxLength={2000}
                onChange={(e) => update("note", e.target.value)}
              />
            </label>
            <p className="operator-new-route__hint">
              Các thiết lập này được áp dụng cho những chuyến mới tạo từ tuyến.
            </p>
          </section>
          {errors.length > 0 && (
            <ul role="alert" className="operator-new-route__errors">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
          {message && (
            <p role="status" className="operator-new-route__message">
              {message}
            </p>
          )}
          <footer className="operator-new-route__actions">
            <Link to={returnTo}>Hủy</Link>
            {!route && (
              <Button
                type="button"
                variant="secondary"
                disabled={mutation.isPending}
                onClick={() =>
                  setMessage(
                    saveCreateRouteDraft(draft)
                      ? "Đã lưu nháp trong tab này."
                      : "Không lưu được nháp. Kiểm tra quyền lưu trữ trình duyệt.",
                  )
                }
              >
                Lưu nháp
              </Button>
            )}
            <Button type="submit" isLoading={mutation.isPending}>
              {route ? "Lưu thay đổi" : "Tạo tuyến"}
            </Button>
          </footer>
        </form>
        <AddRouteStopModal
          open={!!stopEditor && !stopEditor.stop}
          onOpenChange={(value) => {
            if (!value) setStopEditor(null);
          }}
          origin={draft.origin}
          destination={draft.destination}
          distance={draft.distance}
          stops={draft.stops}
          onAdd={(stop) => {
            update(
              "stops",
              [...draft.stops, stop].sort((a, b) => a.km - b.km),
            );
            setStopEditor(null);
          }}
        />
        <Dialog.Root
          open={!!stopEditor?.stop}
          onOpenChange={(open) => {
            if (!open) setStopEditor(null);
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="operator-routes__overlay" />
            <Dialog.Content className="operator-routes__dialog">
              <Dialog.Title>
                {stopEditor?.stop
                  ? "Chỉnh sửa điểm đón/trả"
                  : "Thêm điểm đón/trả"}
              </Dialog.Title>
              <Dialog.Description>
                Điểm dừng được sắp xếp theo khoảng cách từ điểm đầu tuyến.
              </Dialog.Description>
              {stopEditor && (
                <DraftStopEditor
                  key={stopEditor.stop?.id ?? "new"}
                  stop={stopEditor.stop}
                  distance={draft.distance}
                  save={(stop) => {
                    const stops = stopEditor.stop
                      ? draft.stops.map((item) =>
                          item.id === stop.id ? stop : item,
                        )
                      : [...draft.stops, stop];
                    update(
                      "stops",
                      [...stops].sort((a, b) => a.km - b.km),
                    );
                    setStopEditor(null);
                  }}
                />
              )}
              <Dialog.Close asChild>
                <Button variant="ghost">Hủy</Button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </main>
    </div>
  );
}
