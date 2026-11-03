import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useId, useState, type ReactElement } from "react";

import { tripSearchSchema } from "@/features/trips/schemas/search.schema";
import { tripSchema } from "@/features/trips/schemas/tripResponse.schema";
import { isMockApi } from "@/shared/api/config";
import type { Trip, TripAmenity } from "@/features/trips/types/trip";
import { BREAKPOINTS } from "@/shared/config/breakpoints";
import { Button } from "@/shared/ui/Button/Button";
import chevronIcon from "@/assets/trip-results/chevron.svg";
import clockIcon from "@/assets/trip-results/clock.svg";
import rangeThumb from "@/assets/trip-results/range-thumb.svg";

import "./TripFilters.css";

export interface TripFiltersProps {
  trips?: readonly Trip[];
  searchParams: URLSearchParams;
  onChange: (params: URLSearchParams) => void;
}

const SORT_OPTIONS = [
  { value: "relevance", label: "Phù hợp nhất" },
  { value: "price-asc", label: "Giá thấp đến cao" },
  { value: "price-desc", label: "Giá cao đến thấp" },
  { value: "departure", label: "Khởi hành sớm nhất" },
  { value: "duration-asc", label: "Thời gian ngắn nhất" },
  { value: "duration-desc", label: "Thời gian dài nhất" },
];
const VEHICLE_OPTIONS = [
  { value: "", label: "Tất cả loại xe" },
  { value: "sleeper-34", label: "Giường nằm" },
  { value: "cabin-22", label: "Cabin / phòng" },
];

type DeparturePeriod = "morning" | "afternoon" | "evening";
interface FilterDraft {
  organizationId: string;
  pickupStopId: string;
  dropoffStopId: string;
  vehicleType: string;
  departurePeriod: DeparturePeriod | "";
  departureHour: string;
  minFare: number;
  maxFare: number;
  amenities: Record<TripAmenity, boolean>;
}
const AMENITIES = [
  ["wifi", "Có Wi-Fi"],
  ["charging", "Cổng sạc"],
  ["restroom", "Nhà vệ sinh"],
  ["doorPickup", "Đón tận nơi"],
] as const satisfies readonly (readonly [TripAmenity, string])[];
const FILTER_KEYS = [
  "organizationId",
  "pickupStopId",
  "dropoffStopId",
  "vehicleType",
  "departurePeriod",
  "departureHour",
  "minFare",
  "maxFare",
  "wifi",
  "charging",
  "restroom",
  "doorPickup",
  "page",
] as const;
const DEFAULT_DRAFT: FilterDraft = {
  organizationId: "",
  pickupStopId: "",
  dropoffStopId: "",
  vehicleType: "",
  departurePeriod: "morning",
  departureHour: "",
  minFare: 200_000,
  maxFare: 450_000,
  amenities: {
    wifi: true,
    charging: true,
    restroom: false,
    doorPickup: false,
  },
};

const LIVE_DEFAULT_DRAFT: FilterDraft = {
  ...DEFAULT_DRAFT,
  departurePeriod: "",
  minFare: 0,
  maxFare: 5_000_000,
  amenities: {
    wifi: false,
    charging: false,
    restroom: false,
    doorPickup: false,
  },
};
const defaults = isMockApi ? DEFAULT_DRAFT : LIVE_DEFAULT_DRAFT;
function singleParam(params: URLSearchParams, key: string): string | undefined {
  const values = params.getAll(key);
  return values.length === 1 ? values[0] : undefined;
}

function numberParam(
  params: URLSearchParams,
  key: string,
  fallback: number,
): number {
  const value = Number(singleParam(params, key));
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function draftFromParams(params: URLSearchParams): FilterDraft {
  const vehicle = tripSchema.shape.vehicleType.safeParse(
    singleParam(params, "vehicleType"),
  );
  const period = singleParam(params, "departurePeriod");
  return {
    organizationId: singleParam(params, "organizationId") ?? "",
    pickupStopId: singleParam(params, "pickupStopId") ?? "",
    dropoffStopId: singleParam(params, "dropoffStopId") ?? "",
    vehicleType: vehicle.success ? vehicle.data : "",
    departurePeriod:
      period === "morning" || period === "afternoon" || period === "evening"
        ? period
        : defaults.departurePeriod,
    departureHour: singleParam(params, "departureHour") ?? "",
    minFare: numberParam(params, "minFare", defaults.minFare),
    maxFare: numberParam(params, "maxFare", defaults.maxFare),
    amenities: {
      wifi:
        singleParam(params, "wifi") === undefined
          ? defaults.amenities.wifi
          : singleParam(params, "wifi") === "1",
      charging:
        singleParam(params, "charging") === undefined
          ? defaults.amenities.charging
          : singleParam(params, "charging") === "1",
      restroom: singleParam(params, "restroom") === "1",
      doorPickup: singleParam(params, "doorPickup") === "1",
    },
  };
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}): ReactElement {
  const id = useId();
  return (
    <div className="trip-filters__field">
      <label className="trip-filters__label" htmlFor={id}>
        {label}
      </label>
      <select
        className="trip-filters__select"
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface FilterControlsProps extends TripFiltersProps {
  draft: FilterDraft;
  setDraft: (draft: FilterDraft) => void;
  onApply: () => void;
  onReset: () => void;
}

function FilterControls({
  searchParams,
  onChange,
  trips = [],
  draft,
  setDraft,
  onApply,
}: FilterControlsProps): ReactElement {
  const sort = tripSearchSchema.shape.sort.safeParse(
    singleParam(searchParams, "sort"),
  );
  const operators = [
    ...new Map(
      trips.map((trip) => [
        trip.operator.id,
        { value: trip.operator.id, label: trip.displayOperatorName },
      ]),
    ).values(),
  ];
  const stopOptions = (pickup: boolean): { value: string; label: string }[] => [
    ...new Map(
      trips
        .filter(
          (trip) =>
            !draft.organizationId || trip.operator.id === draft.organizationId,
        )
        .flatMap((trip) =>
          (trip.stops ?? [])
            .filter((stop) =>
              pickup ? stop.pickupAllowed : stop.dropoffAllowed,
            )
            .map(
              (stop) =>
                [
                  stop.id,
                  {
                    value: stop.id,
                    label: stop.address
                      ? stop.name + " · " + stop.address
                      : stop.name,
                  },
                ] as const,
            ),
        ),
    ).values(),
  ];
  const optionsWithSelected = (
    options: { value: string; label: string }[],
    selected: string,
  ): { value: string; label: string }[] =>
    selected && !options.some((option) => option.value === selected)
      ? [...options, { value: selected, label: "Lựa chọn đã áp dụng" }]
      : options;
  return (
    <div className="trip-filters__controls">
      <div className="trip-filters__sort-field">
        <FilterSelect
          label="Sắp xếp"
          value={sort.success ? sort.data : "relevance"}
          options={SORT_OPTIONS}
          onChange={(value) => {
            const parsed = tripSearchSchema.shape.sort.safeParse(value);
            if (!parsed.success) return;
            const next = new URLSearchParams(searchParams);
            if (parsed.data === "relevance") next.delete("sort");
            else next.set("sort", parsed.data);
            next.delete("page");
            onChange(next);
          }}
        />
      </div>
      {!isMockApi && (
        <fieldset className="trip-filters__group trip-filters__group--route">
          <legend className="trip-filters__legend">
            Nhà xe & điểm đón trả
          </legend>
          <FilterSelect
            label="Nhà xe"
            value={draft.organizationId}
            options={[
              { value: "", label: "Tất cả nhà xe" },
              ...optionsWithSelected(operators, draft.organizationId),
            ]}
            onChange={(organizationId) =>
              setDraft({
                ...draft,
                organizationId,
                pickupStopId: "",
                dropoffStopId: "",
              })
            }
          />
          <FilterSelect
            label="Điểm đón"
            value={draft.pickupStopId}
            options={[
              { value: "", label: "Tất cả điểm đón" },
              ...optionsWithSelected(stopOptions(true), draft.pickupStopId),
            ]}
            onChange={(pickupStopId) => setDraft({ ...draft, pickupStopId })}
          />
          <FilterSelect
            label="Điểm trả"
            value={draft.dropoffStopId}
            options={[
              { value: "", label: "Tất cả điểm trả" },
              ...optionsWithSelected(stopOptions(false), draft.dropoffStopId),
            ]}
            onChange={(dropoffStopId) => setDraft({ ...draft, dropoffStopId })}
          />
        </fieldset>
      )}
      <fieldset className="trip-filters__group">
        <legend className="trip-filters__legend">Loại xe</legend>
        <div className="trip-filters__select-wrap">
          <FilterSelect
            label="Loại xe"
            value={draft.vehicleType}
            options={VEHICLE_OPTIONS}
            onChange={(value) => {
              const parsed = tripSchema.shape.vehicleType.safeParse(value);
              if (value === "" || parsed.success)
                setDraft({ ...draft, vehicleType: value });
            }}
          />
          <img
            alt=""
            aria-hidden
            className="trip-filters__select-icon"
            src={chevronIcon}
          />
        </div>
      </fieldset>
      <fieldset className="trip-filters__group">
        <legend className="trip-filters__legend">Buổi khởi hành</legend>
        <div className="trip-filters__periods">
          {[
            ...(!isMockApi ? [["", "Tất cả"]] : []),
            ["morning", "Sáng"],
            ["afternoon", "Chiều"],
            ["evening", "Tối"],
          ].map(([value, label]) => (
            <button
              aria-pressed={draft.departurePeriod === value}
              className="trip-filters__period"
              key={value}
              onClick={() =>
                setDraft({
                  ...draft,
                  departurePeriod: value as DeparturePeriod,
                })
              }
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="trip-filters__group">
        <legend className="trip-filters__legend">Giờ khởi hành</legend>
        <label className="trip-filters__stacked-field">
          <span>GIỜ XUẤT PHÁT</span>
          <input
            aria-label="Giờ xuất phát"
            onChange={(event) =>
              setDraft({ ...draft, departureHour: event.target.value })
            }
            type="time"
            value={draft.departureHour}
          />
          <img alt="" aria-hidden src={clockIcon} />
        </label>
      </fieldset>
      <fieldset className="trip-filters__group">
        <legend className="trip-filters__legend">Khoảng giá</legend>
        <p className="trip-filters__range-copy">
          {draft.minFare.toLocaleString("vi-VN")} đ —{" "}
          {draft.maxFare.toLocaleString("vi-VN")} đ
        </p>
        <div className="trip-filters__range">
          <span aria-hidden="true" />
          <img src={rangeThumb} alt="" aria-hidden="true" />
          <img src={rangeThumb} alt="" aria-hidden="true" />
          <input
            aria-label="Giá tối thiểu"
            max={isMockApi ? 450000 : 5000000}
            min={isMockApi ? 200000 : 0}
            onChange={(event) =>
              setDraft({
                ...draft,
                minFare: Math.min(Number(event.target.value), draft.maxFare),
              })
            }
            step="25000"
            type="range"
            value={draft.minFare}
          />
          <input
            aria-label="Giá tối đa"
            max="450000"
            min="200000"
            onChange={(event) =>
              setDraft({
                ...draft,
                maxFare: Math.max(Number(event.target.value), draft.minFare),
              })
            }
            step="25000"
            type="range"
            value={draft.maxFare}
          />
        </div>
      </fieldset>
      <fieldset className="trip-filters__group trip-filters__group--amenities">
        <legend className="trip-filters__legend">Tiện ích</legend>
        {AMENITIES.map(([key, label]) => (
          <label className="trip-filters__check" key={key}>
            <input
              checked={draft.amenities[key]}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  amenities: {
                    ...draft.amenities,
                    [key]: event.target.checked,
                  },
                })
              }
              type="checkbox"
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      <Button className="trip-filters__apply" type="button" onClick={onApply}>
        Áp dụng bộ lọc
      </Button>
    </div>
  );
}

function FilterDrawer(props: FilterControlsProps): ReactElement {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="trip-filters__overlay" />
      <Dialog.Content className="trip-filters__drawer">
        <div className="trip-filters__header">
          <Dialog.Title className="trip-filters__title">
            Bộ lọc và sắp xếp
          </Dialog.Title>
          <Button type="button" variant="ghost" onClick={props.onReset}>
            Đặt lại
          </Button>
          <Dialog.Close asChild>
            <Button type="button" variant="ghost">
              Đóng bộ lọc
            </Button>
          </Dialog.Close>
        </div>
        <Dialog.Description className="trip-filters__description">
          Chọn điều kiện rồi nhấn Áp dụng bộ lọc. Đặt lại giữ nguyên hành trình
          và hành khách.
        </Dialog.Description>
        <FilterControls {...props} />
      </Dialog.Content>
    </Dialog.Portal>
  );
}

function MobileFilters(props: FilterControlsProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia(
      `(min-width: ${BREAKPOINTS.customerNavigation}px)`,
    );
    const closeOnDesktop = (): void => {
      if (desktop.matches) setIsOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <Button
          type="button"
          variant="secondary"
          className="trip-filters__trigger"
          aria-expanded={isOpen}
        >
          Bộ lọc và sắp xếp
        </Button>
      </Dialog.Trigger>
      <FilterDrawer {...props} />
    </Dialog.Root>
  );
}

export function TripFilters(props: TripFiltersProps): ReactElement {
  const headingId = useId();
  const [draft, setDraft] = useState(() => draftFromParams(props.searchParams));
  const apply = (): void => {
    const next = new URLSearchParams(props.searchParams);
    for (const key of FILTER_KEYS) next.delete(key);
    for (const key of [
      "organizationId",
      "pickupStopId",
      "dropoffStopId",
    ] as const)
      if (draft[key]) next.set(key, draft[key]);
    if (draft.vehicleType) next.set("vehicleType", draft.vehicleType);
    if (draft.departurePeriod)
      next.set("departurePeriod", draft.departurePeriod);
    if (draft.departureHour) next.set("departureHour", draft.departureHour);
    next.set("minFare", String(draft.minFare));
    next.set("maxFare", String(draft.maxFare));
    for (const [key] of AMENITIES)
      next.set(key, draft.amenities[key] ? "1" : "0");
    props.onChange(next);
  };
  const reset = (): void => {
    setDraft(defaults);
    const next = new URLSearchParams(props.searchParams);
    next.delete("sort");
    for (const key of FILTER_KEYS) next.delete(key);
    props.onChange(next);
  };
  const controls = {
    ...props,
    draft,
    setDraft,
    onApply: apply,
    onReset: reset,
  };
  return (
    <div
      className={isMockApi ? "trip-filters" : "trip-filters trip-filters--live"}
    >
      <section className="trip-filters__desktop" aria-label="Bộ lọc chuyến">
        <h2 className="trip-filters__title" id={headingId}>
          Bộ lọc
        </h2>
        <Button type="button" variant="ghost" onClick={reset}>
          Đặt lại
        </Button>
        <FilterControls {...controls} />
      </section>
      <MobileFilters {...controls} />
    </div>
  );
}
