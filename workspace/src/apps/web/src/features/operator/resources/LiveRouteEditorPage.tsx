import { Toast } from "@/shared/ui/Toast/Toast";
import { useRef, useState, type ReactElement } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/shared/ui/Button/Button";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { liveApiJson, liveQueryKey } from "@/shared/api/liveRequest";
import { readApiSession } from "@/shared/api/session";
import { shortId } from "@/shared/api/livePresentation";
import {
  getLiveRoutes,
  liveRouteSchema,
  liveStopSchema,
  orderedStops,
  stopKind,
  type LiveRoute,
  type LiveStop,
} from "./liveRoutes";
import { LiveRouteStopModal } from "./LiveRouteStopModal";
import "./RouteManagementPage.css";
import "./CreateRoutePage.css";
import "./LiveRoutes.css";

const draftSchema = z.object({
  name: z.string(),
  origin: z.string(),
  destination: z.string(),
  distance: z.string(),
  hours: z.string(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  stops: z.array(liveStopSchema),
});
type Draft = z.infer<typeof draftSchema>;
const draftKey = (): string =>
  `blue-route-draft:${readApiSession()?.user.id ?? ""}`;
const empty: Draft = {
  name: "",
  origin: "",
  destination: "",
  distance: "",
  hours: "",
  status: "ACTIVE",
  stops: [],
};
function loadDraft(): { draft: Draft; saved?: LiveRoute } {
  try {
    const value = JSON.parse(sessionStorage.getItem(draftKey()) ?? "null");
    return z
      .object({ draft: draftSchema, saved: liveRouteSchema.optional() })
      .parse(value);
  } catch {
    return { draft: empty };
  }
}
function RouteField({
  label,
  value,
  onChange,
  type = "text",
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  type?: string;
  readOnly?: boolean;
}): ReactElement {
  return (
    <label className="operator-new-route__field">
      <span>{label}</span>
      <input
        aria-label={label}
        value={value}
        type={type}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "any" : undefined}
        readOnly={readOnly}
        required={!readOnly}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </label>
  );
}
function RouteForm({ route }: { route?: LiveRoute }): ReactElement {
  const [initial] = useState(() =>
    route
      ? {
          draft: {
            name: route.name,
            origin: route.origin,
            destination: route.destination,
            distance: String(route.distanceKm ?? ""),
            hours:
              route.durationMinutes === null
                ? ""
                : String(route.durationMinutes / 60),
            status:
              route.status === "ACTIVE"
                ? ("ACTIVE" as const)
                : ("INACTIVE" as const),
            stops: [...route.stops].sort((a, b) => a.sequence - b.sequence),
          },
          saved: route,
        }
      : loadDraft(),
  );
  const [form, setForm] = useState<Draft>(initial.draft);
  const saved = useRef<LiveRoute | undefined>(initial.saved);
  const [savedId, setSavedId] = useState(initial.saved?.id);
  const [partiallySaved, setPartiallySaved] = useState(false);
  const [params] = useSearchParams();
  const [modal, setModal] = useState<{ stop?: LiveStop } | null>(() =>
    params.has("addStop") ? {} : null,
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const client = useQueryClient();
  const navigate = useNavigate();
  const update = <K extends keyof Draft>(key: K, value: Draft[K]): void => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setError("");
    setNotice("");
  };
  const persist = (value: Draft): void =>
    sessionStorage.setItem(
      draftKey(),
      JSON.stringify({ draft: value, saved: saved.current }),
    );
  const mutation = useMutation({
    mutationFn: async () => {
      const stops = orderedStops(form.stops);
      const durationMinutes = Math.round(Number(form.hours) * 60);
      const body = {
        name: form.name.trim(),
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        distanceKm: Number(form.distance),
        durationMinutes,
        expectedVersion: saved.current?.expectedVersion ?? 0,
      };
      if (
        !body.name ||
        !body.origin ||
        !body.destination ||
        body.origin === body.destination ||
        !Number.isFinite(body.distanceKm) ||
        body.distanceKm <= 0 ||
        !Number.isInteger(durationMinutes) ||
        durationMinutes <= 0
      )
        throw Error(
          "Kiểm tra tên tuyến, điểm đầu/điểm cuối, khoảng cách và thời lượng.",
        );
      if (
        stops.length < 2 ||
        stops.some(
          (stop) =>
            !stop.name.trim() ||
            !Number.isInteger(stop.offsetMinutes) ||
            stop.offsetMinutes < 0 ||
            stop.offsetMinutes > durationMinutes,
        ) ||
        new Set(stops.map((stop) => stop.name.trim().toLocaleLowerCase("vi")))
          .size !== stops.length
      )
        throw Error(
          "Cần ít nhất hai điểm khác nhau với thời gian hợp lệ trong tuyến.",
        );
      if (
        stops[0].name !== body.origin ||
        stops.at(-1)?.name !== body.destination ||
        stops[0].offsetMinutes !== 0 ||
        !stops[0].pickupAllowed ||
        !stops.at(-1)?.dropoffAllowed
      )
        throw Error(
          "Điểm đầu phải là điểm đón ở phút 0; điểm cuối phải là điểm trả, trùng với thông tin tuyến.",
        );
      const routeId = saved.current?.id;
      let result = await liveApiJson(
        routeId
          ? `/api/v1/operator/routes/${routeId}`
          : "/api/v1/operator/routes",
        liveRouteSchema,
        { method: routeId ? "PATCH" : "POST", body, idempotent: true },
      );
      saved.current = result;
      setSavedId(result.id);
      setPartiallySaved(true);
      if (!route) {
        try {
          persist(form);
        } catch {
          /* Keep the saved ID in memory for retry. */
        }
      }
      result = await liveApiJson(
        `/api/v1/operator/routes/${result.id}/stops`,
        liveRouteSchema,
        {
          method: "PUT",
          idempotent: true,
          body: stops.map(({ id, ...stop }) => {
            void id;
            return stop;
          }),
        },
      );
      saved.current = result;
      if (form.status === "INACTIVE" && result.status === "ACTIVE")
        await liveApiJson(
          `/api/v1/operator/routes/${result.id}/deactivate`,
          z.unknown(),
          { method: "POST", idempotent: true },
        );
      return result;
    },
    onSuccess: async (result) => {
      if (!route) {
        try {
          sessionStorage.removeItem(draftKey());
        } catch {
          /* Save already succeeded. */
        }
      }
      await client.invalidateQueries({ queryKey: ["live-api"] });
      void navigate(`/operator/routes?route=${result.id}`);
    },
    onError: () => {
      if (!route && saved.current) {
        try {
          persist(form);
        } catch {
          /* The in-memory retry is still available. */
        }
      }
    },
    onMutate: () => setPartiallySaved(false),
    retry: false,
  });
  return (
    <div className="operator-routes operator-new-route live-routes live-route-form">
      <header className="live-routes__heading">
        <h1>
          {route ? `Chỉnh sửa tuyến ${shortId(route.id)}` : "Tạo tuyến mới"}
        </h1>
        <Link className="operator-new-route__back" to="/operator/routes">
          ← Quản lý tuyến
        </Link>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <fieldset
          className="live-route-form__fieldset"
          disabled={mutation.isPending}
        >
          <div className="operator-new-route__top">
            <section className="operator-new-route__panel operator-new-route__basic">
              <h2>Thông tin tuyến</h2>
              <p>Khai báo thông tin cơ bản trước khi thêm các điểm dừng.</p>
              <div className="operator-new-route__basic-fields">
                <RouteField
                  label="MÃ TUYẾN"
                  value={
                    route
                      ? shortId(route.id)
                      : savedId
                        ? shortId(savedId)
                        : "Tự động khi tạo tuyến"
                  }
                  readOnly
                />
                <RouteField
                  label="TÊN TUYẾN"
                  value={form.name}
                  onChange={(value) => update("name", value)}
                />
                <div className="operator-new-route__two">
                  <RouteField
                    label="ĐIỂM ĐẦU"
                    value={form.origin}
                    onChange={(value) => update("origin", value)}
                  />
                  <RouteField
                    label="ĐIỂM CUỐI"
                    value={form.destination}
                    onChange={(value) => update("destination", value)}
                  />
                </div>
                <div className="operator-new-route__two">
                  <RouteField
                    label="KHOẢNG CÁCH (KM)"
                    type="number"
                    value={form.distance}
                    onChange={(value) => update("distance", value)}
                  />
                  <RouteField
                    label="THỜI LƯỢNG (GIỜ)"
                    type="number"
                    value={form.hours}
                    onChange={(value) => update("hours", value)}
                  />
                </div>
              </div>
            </section>
            <section className="operator-new-route__panel operator-new-route__stop-editor">
              <h2>Điểm đón/trả trên tuyến</h2>
              <p>Thêm điểm đón hoặc điểm trả rồi sắp xếp theo hành trình.</p>
              <ol className="operator-new-route__stops">
                {form.stops.map((stop, index) => (
                  <li key={`${index}-${stop.name}`}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <button
                      className="operator-new-route__stop-info"
                      type="button"
                      onClick={() => setModal({ stop })}
                    >
                      <strong>{stop.name}</strong>
                      <small>{stop.address || "Chưa có địa chỉ"}</small>
                      <em>
                        {stopKind(stop)} · {stop.offsetMinutes} phút
                      </em>
                    </button>
                    <button
                      className="operator-new-route__remove"
                      type="button"
                      aria-label={`Xóa ${stop.name}`}
                      onClick={() =>
                        update(
                          "stops",
                          form.stops.filter((_, i) => i !== index),
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
                className="operator-new-route__add"
                variant="secondary"
                onClick={() => setModal({})}
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
                  value={form.status}
                  onChange={(event) =>
                    update("status", event.target.value as Draft["status"])
                  }
                >
                  <option
                    value="ACTIVE"
                    disabled={route?.status === "INACTIVE"}
                  >
                    Đang khai thác
                  </option>
                  <option value="INACTIVE">Tạm ngừng</option>
                </select>
              </label>
              <RouteField
                label="CHIỀU KHAI THÁC"
                value="Từ điểm đầu đến điểm cuối"
                readOnly
              />
            </div>
            <label className="operator-new-route__field operator-new-route__note">
              <span>GHI CHÚ NỘI BỘ</span>
              <textarea
                disabled
                placeholder="Chưa hỗ trợ lưu ghi chú nội bộ."
              />
            </label>
            <p className="operator-new-route__hint">
              Điểm dừng được sắp xếp theo số phút từ điểm đầu. Tuyến chiều ngược
              lại được tạo riêng.
            </p>
          </section>
        </fieldset>
        {error && (
          <p role="alert" className="operator-new-route__errors">
            {error}
          </p>
        )}
        {mutation.isError && (
          <>
            <ApiFailure error={mutation.error} />
            {partiallySaved && (
              <p className="operator-new-route__message">
                Thông tin tuyến đã được lưu. Bấm lưu lại để hoàn tất các bước
                còn lại.
              </p>
            )}
          </>
        )}
        {notice && <Toast message={notice} onClose={() => setNotice("")} />}
        <footer className="operator-new-route__actions">
          <Link to="/operator/routes">Hủy</Link>
          {!route && (
            <Button
              type="button"
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => {
                try {
                  persist(form);
                  setNotice("Đã lưu nháp trên trình duyệt này.");
                } catch {
                  setError("Không lưu được bản nháp trên trình duyệt.");
                }
              }}
            >
              Lưu nháp
            </Button>
          )}
          <Button type="submit" isLoading={mutation.isPending}>
            {route ? "Lưu thay đổi" : "Tạo tuyến"}
          </Button>
        </footer>
      </form>
      {modal && (
        <LiveRouteStopModal
          stop={modal.stop}
          stops={form.stops}
          duration={Math.round(Number(form.hours) * 60) || 0}
          onClose={() => setModal(null)}
          onSave={(stop) => {
            const next = modal.stop
              ? form.stops.map((item) =>
                  item.sequence === modal.stop?.sequence ? stop : item,
                )
              : [...form.stops, { ...stop, id: crypto.randomUUID() }];
            update("stops", orderedStops(next));
            setModal(null);
          }}
        />
      )}
    </div>
  );
}
export function LiveRouteEditorPage({
  edit = false,
}: {
  edit?: boolean;
}): ReactElement {
  const { routeId } = useParams();
  const query = useQuery({
    queryKey: liveQueryKey("operator-routes"),
    queryFn: ({ signal }) => getLiveRoutes(signal),
    enabled: edit,
  });
  if (!edit) return <RouteForm />;
  if (query.isPending) return <p role="status">Đang tải thông tin tuyến…</p>;
  if (query.isError) return <ApiFailure error={query.error} />;
  const route = query.data.find((route) => route.id === routeId);
  return route ? (
    <RouteForm key={route.id} route={route} />
  ) : (
    <p>
      Không tìm thấy tuyến. <Link to="/operator/routes">Quản lý tuyến</Link>
    </p>
  );
}
