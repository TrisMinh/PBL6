import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState, type ReactElement, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/shared/ui/Button/Button";
import { PageState } from "@/shared/ui/PageState/PageState";
import { getStopCatalogue } from "./stopCatalogueRepository";
import {
  cataloguePlaceToStop,
  type CataloguePlace,
} from "./stopCatalogue.schema";
import { STOP_KIND, type RouteStop } from "./routes.schema";
import "./AddRouteStopModal.css";
function CatalogueStopForm({
  places,
  existing,
  distance,
  onAdd,
  onClose,
}: {
  places: CataloguePlace[];
  existing: RouteStop[];
  distance: number;
  onAdd: (stop: RouteStop) => void;
  onClose: () => void;
}): ReactElement {
  const [province, setProvince] = useState(places[0]?.province ?? ""),
    [district, setDistrict] = useState(places[0]?.district ?? ""),
    [placeId, setPlaceId] = useState(places[0]?.id ?? ""),
    [kind, setKind] = useState<RouteStop["kind"]>("both"),
    [error, setError] = useState("");
  const districts = [
    ...new Set(
      places
        .filter((place) => place.province === province)
        .map((place) => place.district),
    ),
  ];
  const available = places.filter(
    (place) => place.province === province && place.district === district,
  );
  const place = available.find((item) => item.id === placeId);
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (!place) {
      setError("Chọn địa điểm trước khi thêm.");
      return;
    }
    try {
      onAdd(cataloguePlaceToStop(place, kind, existing, distance));
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Không thêm được điểm dừng.",
      );
    }
  };
  if (!places.length)
    return (
      <PageState
        title="Chưa có địa điểm"
        description="Danh mục mẫu hiện chưa có địa điểm cho tuyến này."
        action={<Button onClick={onClose}>Đóng</Button>}
      />
    );
  return (
    <form onSubmit={submit}>
      <div className="operator-add-stop__body">
        <div className="operator-add-stop__two">
          <label className="operator-add-stop__field">
            <span>TỈNH / THÀNH PHỐ</span>
            <select
              aria-label="Tỉnh / Thành phố"
              value={province}
              onChange={(event) => {
                const first = places.find(
                  (item) => item.province === event.target.value,
                );
                setProvince(event.target.value);
                setDistrict(first?.district ?? "");
                setPlaceId(first?.id ?? "");
                setError("");
              }}
            >
              {[...new Set(places.map((item) => item.province))].map(
                (value) => (
                  <option key={value}>{value}</option>
                ),
              )}
            </select>
          </label>
          <label className="operator-add-stop__field">
            <span>QUẬN / HUYỆN</span>
            <select
              aria-label="Quận / Huyện"
              value={district}
              onChange={(event) => {
                setDistrict(event.target.value);
                setPlaceId(
                  places.find(
                    (item) =>
                      item.province === province &&
                      item.district === event.target.value,
                  )?.id ?? "",
                );
                setError("");
              }}
            >
              {districts.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="operator-add-stop__field operator-add-stop__place">
          <span>ĐỊA ĐIỂM</span>
          <select
            aria-label="Địa điểm"
            value={placeId}
            onChange={(event) => {
              setPlaceId(event.target.value);
              setError("");
            }}
          >
            {available.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <small>{place?.address}</small>
        </label>
        <fieldset className="operator-add-stop__types">
          <legend>LOẠI ĐIỂM</legend>
          <div>
            {Object.entries(STOP_KIND).map(([value, label]) => (
              <label
                key={value}
                className={
                  kind === value
                    ? "operator-add-stop__type--selected"
                    : undefined
                }
              >
                <input
                  type="radio"
                  name="stopKind"
                  value={value}
                  checked={kind === value}
                  onChange={() => {
                    setKind(value as RouteStop["kind"]);
                    setError("");
                  }}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="operator-add-stop__preview" aria-live="polite">
          <span>ĐỊA ĐIỂM ĐÃ CHỌN</span>
          <strong>{place?.name ?? "Chưa chọn địa điểm"}</strong>
          <p>
            {province} · {STOP_KIND[kind]}
          </p>
        </div>
        {error && (
          <p role="alert" className="operator-add-stop__error">
            {error}
          </p>
        )}
      </div>
      <footer className="operator-add-stop__actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" disabled={!place}>
          Thêm điểm
        </Button>
      </footer>
    </form>
  );
}
export function AddRouteStopModal({
  open,
  onOpenChange,
  origin,
  destination,
  distance,
  stops,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  origin: string;
  destination: string;
  distance: number;
  stops: RouteStop[];
  onAdd: (stop: RouteStop) => void;
}): ReactElement {
  const trigger = useRef<HTMLElement | null>(null);
  const query = useQuery({
    queryKey: ["operator", "stop-catalogue", origin, destination, distance],
    queryFn: ({ signal }) =>
      getStopCatalogue(origin, destination, distance, signal),
    enabled: open && !!origin.trim() && !!destination.trim() && distance > 0,
    refetchOnWindowFocus: false,
  });
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="operator-add-stop__overlay" />
        <Dialog.Content
          className="operator-add-stop__dialog"
          onOpenAutoFocus={() => {
            trigger.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <header className="operator-add-stop__header">
            <Dialog.Title>Thêm điểm đón/trả</Dialog.Title>
            <Dialog.Description>
              Chọn địa điểm và xác định cách phục vụ trên tuyến.
            </Dialog.Description>
            <Dialog.Close asChild>
              <button type="button" aria-label="Đóng hộp thoại thêm điểm">
                ×
              </button>
            </Dialog.Close>
          </header>
          {!origin.trim() || !destination.trim() || distance <= 0 ? (
            <PageState
              title="Chưa đủ thông tin tuyến"
              description="Nhập điểm đầu, điểm cuối và khoảng cách trước khi thêm điểm."
              action={<Button onClick={() => onOpenChange(false)}>Đóng</Button>}
            />
          ) : query.isPending ? (
            <p role="status" className="operator-add-stop__loading">
              Đang tải danh mục địa điểm…
            </p>
          ) : query.isError ? (
            <PageState
              title="Không tải được địa điểm"
              description={query.error.message}
              action={
                <Button onClick={() => void query.refetch()}>Thử lại</Button>
              }
            />
          ) : (
            <CatalogueStopForm
              key={origin + destination + distance}
              places={query.data}
              existing={stops}
              distance={distance}
              onAdd={onAdd}
              onClose={() => onOpenChange(false)}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
