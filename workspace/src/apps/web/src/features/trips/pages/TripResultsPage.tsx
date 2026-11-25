import { BrandLoading } from "@/shared/ui/BrandLogo/BrandLoading";
import { useAnimatedGrid } from "@/shared/hooks/useAnimatedGrid";
import { useLiveCatalogue } from "@/features/explore/liveCatalogue";
import { DatePicker } from "@/shared/ui/DatePicker/DatePicker";
import { Rows } from "@phosphor-icons/react/dist/csr/Rows";
import { GridNine } from "@phosphor-icons/react/dist/csr/GridNine";
import { SquaresFour } from "@phosphor-icons/react/dist/csr/SquaresFour";
import { isMockApi } from "@/shared/api/config";
import {
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";
import { createDemoTrips } from "@/mocks/fixtures/demoTrips";
import { locations as catalogueLocations } from "@/mocks/fixtures/locations";
import { tripSearchSchema } from "@/features/trips/schemas/search.schema";
import { Link, useSearchParams } from "react-router";

import {
  useCreateBookingSession,
  type CreateBookingSessionResult,
} from "@/features/booking/hooks/useCreateBookingSession";
import { ExpiredBookingState } from "@/features/booking/components/ExpiredBookingState";
import { TripCard } from "@/features/trips/components/TripCard/TripCard";
import {
  TripFilters,
  type TripFiltersProps,
} from "@/features/trips/components/TripFilters/TripFilters";
import { useTrips } from "@/features/trips/hooks/useTrips";
import { useLocations } from "@/features/trips/hooks/useLocations";
import {
  parseTripSearch,
  selectVisibleTrips,
  type TripFilterCriteria,
} from "@/features/trips/lib/tripResults";
import type {
  Trip,
  Location,
  TripAmenity,
  TripSearch,
} from "@/features/trips/types/trip";
import { ROUTES } from "@/shared/config/routes";
import { Button } from "@/shared/ui/Button/Button";
import { PageState } from "@/shared/ui/PageState/PageState";

import "./TripResultsPage.css";

type TripsQuery = ReturnType<typeof useTrips>;
const CATALOGUE_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
});
const MAX_TIMEOUT_MS = 2_147_483_647;
const FILTER_AMENITIES = [
  "wifi",
  "charging",
  "restroom",
  "doorPickup",
] as const satisfies readonly TripAmenity[];

function parseFilterCriteria(params: URLSearchParams): TripFilterCriteria {
  const one = (key: string): string | undefined => {
    const values = params.getAll(key);
    return values.length === 1 ? values[0] : undefined;
  };
  const period = one("departurePeriod");
  const departurePeriod =
    period === "morning" || period === "afternoon" || period === "evening"
      ? period
      : undefined;
  const number = (key: string): number | undefined => {
    const parsed = Number(one(key));
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
  };
  return {
    organizationId: one("organizationId"),
    pickupStopId: one("pickupStopId"),
    dropoffStopId: one("dropoffStopId"),
    vehicleType: one("vehicleType"),
    departurePeriod,
    departureHour: one("departureHour"),
    minFare: number("minFare"),
    maxFare: number("maxFare"),
    amenities: FILTER_AMENITIES.filter((key) => one(key) === "1"),
  };
}

function EditSearch({
  label = "Sửa tìm kiếm",
}: {
  label?: string;
}): ReactElement {
  return (
    <Link className="trip-results__edit" to={ROUTES.home}>
      {label}
    </Link>
  );
}

function ResultsHeading({
  count,
  originLabel,
  destinationLabel,
  allRoutes = false,
}: {
  allRoutes?: boolean;
  count: number;
  originLabel: string;
  destinationLabel: string;
}): ReactElement {
  return (
    <header className="trip-results__header">
      <h1 className="trip-results__title">
        {allRoutes
          ? "Tất cả chuyến xe"
          : `Chuyến xe ${originLabel} → ${destinationLabel}`}
      </h1>
      <p className="trip-results__count" role="status">
        {count} kết quả
      </p>
    </header>
  );
}

function TripSearchPanel({
  locations,
  params,
  onChange,
}: {
  locations: readonly Location[];
  params: URLSearchParams;
  onChange: (params: URLSearchParams) => void;
}): ReactElement {
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const originId = String(data.get("originId") ?? "");
    const destinationId = String(data.get("destinationId") ?? "");
    const departureDate = String(data.get("departureDate") ?? "");
    if (originId && destinationId && originId === destinationId) {
      setError("Điểm đến phải khác điểm đi.");
      return;
    }
    if (originId && destinationId && departureDate) {
      const parsed = tripSearchSchema.safeParse({
        originId,
        destinationId,
        departureDate,
        passengerCount: data.get("passengerCount"),
      });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Kiểm tra lại hành trình.");
        return;
      }
    }
    const next = new URLSearchParams();
    for (const name of [
      "originId",
      "destinationId",
      "departureDate",
      "passengerCount",
    ]) {
      const value = String(data.get(name) ?? "");
      if (value) next.set(name, value);
    }
    if (
      params.get("browse") === "1" ||
      !originId ||
      !destinationId ||
      !departureDate
    )
      next.set("browse", "1");
    const view = params.get("view");
    if (view) next.set("view", view);
    const operatorName = params.get("operatorName");
    if (operatorName) next.set("operatorName", operatorName);
    setError("");
    onChange(next);
  }
  return (
    <section className="trip-catalogue__search" aria-label="Tìm kiếm chuyến xe">
      <header>
        <h2>Tìm chuyến xe</h2>
        <p>Khám phá tất cả chuyến đang mở bán hoặc chọn hành trình của bạn.</p>
      </header>
      <form
        key={
          params.toString() + locations.map((location) => location.id).join(",")
        }
        aria-label="Tìm chuyến hiện tại"
        onSubmit={submit}
      >
        <label>
          Điểm đi
          <select
            aria-label="Điểm đi"
            name="originId"
            defaultValue={params.get("originId") ?? ""}
          >
            <option value="">Tất cả tỉnh, thành</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.province}
              </option>
            ))}
          </select>
        </label>
        <label>
          Điểm đến
          <select
            name="destinationId"
            aria-label="Điểm đến"
            defaultValue={params.get("destinationId") ?? ""}
          >
            <option value="">Tất cả tỉnh, thành</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.province}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ngày đi
          <DatePicker
            disablePast
            name="departureDate"
            aria-label="Ngày đi"
            defaultValue={params.get("departureDate") ?? ""}
          />
        </label>
        <label>
          Hành khách
          <select
            aria-label="Hành khách"
            name="passengerCount"
            defaultValue={params.get("passengerCount") ?? "1"}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n} người
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">Tìm chuyến</Button>
      </form>
      {error && (
        <p className="trip-catalogue__error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function SortPills({
  params,
  onChange,
}: {
  params: URLSearchParams;
  onChange: (params: URLSearchParams) => void;
}): ReactElement {
  const current = params.get("sort") ?? "relevance";
  const options = [
    ["relevance", "Phù hợp nhất"],
    ["price-asc", "Giá thấp nhất"],
    ["departure", "Khởi hành sớm"],
  ] as const;
  return (
    <div className="trip-results__sort" aria-label="Sắp xếp kết quả">
      {options.map(([value, label]) => (
        <button
          aria-pressed={current === value}
          key={value}
          onClick={() => {
            const next = new URLSearchParams(params);
            if (value === "relevance") next.delete("sort");
            else next.set("sort", value);
            next.delete("page");
            onChange(next);
          }}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Pagination({
  total,
  page,
  params,
  onChange,
}: {
  total: number;
  page: number;
  params: URLSearchParams;
  onChange: (params: URLSearchParams) => void;
}): ReactElement {
  const pages = Math.max(1, Math.ceil(total / 6));
  const numericPages =
    page === 1
      ? Array.from({ length: Math.min(2, pages) }, (_, index) => index + 1)
      : Array.from(
          { length: Math.min(3, pages) },
          (_, index) =>
            Math.min(Math.max(1, page - 1), Math.max(1, pages - 2)) + index,
        );
  const setPage = (nextPage: number): void => {
    const next = new URLSearchParams(params);
    if (nextPage === 1) next.delete("page");
    else next.set("page", String(nextPage));
    onChange(next);
  };
  return (
    <footer className="trip-results__pagination-row">
      <p>
        Hiển thị {(page - 1) * 6 + 1}–{Math.min(page * 6, total)} trong {total}{" "}
        chuyến
      </p>
      <nav
        aria-label="Phân trang kết quả chuyến"
        className="trip-results__pagination"
      >
        <button
          aria-label="Trang trước"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
          type="button"
        >
          ‹
        </button>
        {numericPages.map((number) => (
          <button
            aria-current={number === page ? "page" : undefined}
            key={number}
            onClick={() => setPage(number)}
            type="button"
          >
            {number}
          </button>
        ))}
        <button
          aria-label="Trang sau"
          disabled={page === pages}
          onClick={() => setPage(page + 1)}
          type="button"
        >
          ›
        </button>
      </nav>
    </footer>
  );
}

function ResultsList({
  trips,
  search,
  booking,
  params,
  onChange,
  originLabel,
  destinationLabel,
  allRoutes = false,
}: {
  allRoutes?: boolean;
  trips: readonly Trip[];
  search: Pick<TripSearch, "passengerCount">;
  booking: CreateBookingSessionResult;
  params: URLSearchParams;
  onChange: (params: URLSearchParams) => void;
  originLabel: string;
  destinationLabel: string;
}): ReactElement {
  const mode = params.get("view");
  const view = mode === "list" || mode === "grid-large" ? mode : "grid-small";
  const requestedPage = Number(params.get("page") ?? "1");
  const pageCount = Math.max(1, Math.ceil(trips.length / 6));
  const page =
    Number.isInteger(requestedPage) &&
    requestedPage >= 1 &&
    requestedPage <= pageCount
      ? requestedPage
      : 1;
  const availableTrips = trips.filter((trip) => trip.availableSeatCount > 0);
  const soldOutTrips = trips.filter((trip) => trip.availableSeatCount === 0);
  const pageOrderedTrips = [
    ...availableTrips.slice(0, 6),
    ...soldOutTrips,
    ...availableTrips.slice(6),
  ];
  const pageTrips = pageOrderedTrips.slice((page - 1) * 6, page * 6);
  const list = useAnimatedGrid(
    view + pageTrips.map((trip) => trip.id).join(","),
  );
  return (
    <div className="trip-results__success" data-view={view}>
      <div className="trip-results__heading-row">
        <ResultsHeading
          allRoutes={allRoutes}
          count={trips.length}
          originLabel={originLabel}
          destinationLabel={destinationLabel}
        />
        <div className="trip-results__toolbar">
          <SortPills params={params} onChange={onChange} />
          <div
            className="trip-results__view"
            role="group"
            aria-label="Cách hiển thị chuyến"
          >
            {(
              [
                ["list", "Danh sách", Rows],
                ["grid-small", "Lưới nhỏ", GridNine],
                ["grid-large", "Lưới lớn", SquaresFour],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                type="button"
                key={value}
                aria-label={label}
                title={label}
                aria-pressed={view === value}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set("view", value);
                  onChange(next);
                }}
              >
                <Icon size={18} aria-hidden />
              </button>
            ))}
          </div>
        </div>
      </div>
      <ul
        ref={list}
        className="trip-results__list"
        aria-label="Danh sách chuyến"
      >
        {pageTrips.map((trip) => (
          <li
            className="trip-results__item"
            key={trip.id}
            data-motion-key={trip.id}
          >
            <TripCard
              trip={trip}
              showDate={allRoutes}
              showImage={view === "list"}
              onSelect={(selected) =>
                booking.createSession(selected.id, search.passengerCount)
              }
              disabled={booking.isPending}
              isPending={booking.pendingTripId === trip.id}
            />
          </li>
        ))}
      </ul>
      <Pagination
        total={trips.length}
        page={page}
        params={params}
        onChange={onChange}
      />
    </div>
  );
}

function ResultsError({ query }: { query: TripsQuery }): ReactElement {
  const description =
    query.error?.code === "NETWORK_ERROR"
      ? "Không thể kết nối. Kiểm tra kết nối của bạn và thử lại."
      : "Chưa thể hiển thị thông tin chuyến. Bạn có thể thử lại hoặc sửa tìm kiếm.";
  return (
    <PageState
      title="Không thể tải chuyến"
      description={description}
      action={
        <>
          <Button
            type="button"
            isLoading={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Thử lại
          </Button>
          <EditSearch />
        </>
      }
    />
  );
}

function ResultsLoading(): ReactElement {
  return (
    <section className="trip-results__loading">
      <h1 className="trip-results__title">Đang tìm chuyến</h1>
      <BrandLoading compact title="Đang tải chuyến…" />
    </section>
  );
}

function ResultsEmpty({
  operatorName,
  onClearOperator,
}: {
  operatorName: string | null;
  onClearOperator: () => void;
}): ReactElement {
  return (
    <PageState
      title="Không tìm thấy chuyến phù hợp"
      description={
        operatorName
          ? `Không có chuyến phù hợp với tên nhà xe “${operatorName}” và các bộ lọc hiện tại.`
          : "Thử đổi loại xe hoặc sửa hành trình và ngày đi để tìm chuyến khác."
      }
      action={
        operatorName ? (
          <Button onClick={onClearOperator}>Bỏ lọc tên nhà xe</Button>
        ) : (
          <EditSearch />
        )
      }
    />
  );
}

function withoutOperatorName(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete("operatorName");
  next.delete("page");
  return next;
}

function ResultsState({
  query,
  search,
  params,
  booking,
  onChange,
  originLabel,
  destinationLabel,
}: {
  query: TripsQuery;
  search: TripSearch;
  params: URLSearchParams;
  booking: CreateBookingSessionResult;
  onChange: (params: URLSearchParams) => void;
  originLabel: string;
  destinationLabel: string;
}): ReactElement {
  if (query.isPending) return <ResultsLoading />;
  if (query.isError) return <ResultsError query={query} />;
  const operatorName = params.get("operatorName");
  const visible = selectVisibleTrips(query.data, search.sort, {
    ...parseFilterCriteria(params),
    operatorName: operatorName ?? undefined,
  });
  if (visible.length === 0)
    return (
      <ResultsEmpty
        operatorName={operatorName}
        onClearOperator={() => onChange(withoutOperatorName(params))}
      />
    );
  return (
    <ResultsList
      key={params.toString()}
      trips={visible}
      search={search}
      booking={booking}
      params={params}
      onChange={onChange}
      originLabel={originLabel}
      destinationLabel={destinationLabel}
    />
  );
}

function ValidResults({
  search,
  searchParams,
  onChange,
  booking,
}: TripFiltersProps & {
  search: TripSearch;
  booking: CreateBookingSessionResult;
}): ReactElement {
  const {
    organizationId,
    pickupStopId,
    dropoffStopId,
    departureHour,
    minFare,
    maxFare,
  } = parseFilterCriteria(searchParams);
  const serverFilters = {
    organizationId,
    pickupStopId,
    dropoffStopId,
    departureHour,
    minFare,
    maxFare,
  };
  const hasServerFilters =
    !isMockApi &&
    Object.values(serverFilters).some((value) => value !== undefined);
  const needsCatalog =
    !isMockApi &&
    (hasServerFilters ||
      (search.sort !== "relevance" && search.sort !== "departure"));
  const query = useTrips({
    ...search,
    ...(hasServerFilters ? { filters: serverFilters } : {}),
  });
  const filterCatalog = useTrips(
    { ...search, sort: "relevance" },
    needsCatalog,
    false,
  );
  const locations = useLocations();
  const originLabel =
    locations.data?.find((location) => location.id === search.originId)
      ?.displayName ?? search.originId;
  const destinationLabel =
    locations.data?.find((location) => location.id === search.destinationId)
      ?.displayName ?? search.destinationId;
  return (
    <>
      <TripSearchPanel
        locations={locations.data ?? []}
        params={searchParams}
        onChange={onChange}
      />
      <div className="trip-results__body">
        <TripFilters
          key={searchParams.toString()}
          searchParams={searchParams}
          onChange={onChange}
          trips={
            (needsCatalog ? filterCatalog.data : query.data) ?? query.data ?? []
          }
        />
        <ResultsState
          query={query}
          search={search}
          params={searchParams}
          booking={booking}
          onChange={onChange}
          originLabel={originLabel}
          destinationLabel={destinationLabel}
        />
      </div>
    </>
  );
}

function TripCatalogue({
  params,
  onChange,
  booking,
}: {
  params: URLSearchParams;
  onChange: (params: URLSearchParams) => void;
  booking: CreateBookingSessionResult;
}): ReactElement {
  const liveLocations = useLocations();
  const mockCatalogue = useMemo(() => (isMockApi ? createDemoTrips() : []), []);
  const locations = isMockApi ? catalogueLocations : (liveLocations.data ?? []);
  const effective = new URLSearchParams(params);
  effective.set("browse", "1");
  const parsedPassengers = tripSearchSchema.shape.passengerCount.safeParse(
    params.get("passengerCount") ?? "1",
  );
  const passengerCount = parsedPassengers.success ? parsedPassengers.data : 1;
  const originId = params.get("originId") ?? "";
  const destinationId = params.get("destinationId") ?? "";
  const departureDate = params.get("departureDate") ?? "";
  const parsedDate =
    tripSearchSchema.shape.departureDate.safeParse(departureDate);
  const liveCatalogue = useLiveCatalogue(!isMockApi, {
    originId,
    destinationId,
    departureDate: parsedDate.data ?? "",
    passengerCount,
  });
  const catalogue = isMockApi ? mockCatalogue : (liveCatalogue.data ?? []);
  const [catalogueTime, setCatalogueTime] = useState(() => Date.now());
  const candidates = catalogue.filter(
    (trip) =>
      (!originId || trip.origin.id === originId) &&
      (!destinationId || trip.destination.id === destinationId) &&
      (!departureDate ||
        CATALOGUE_DATE.format(new Date(trip.departureTime)) ===
          departureDate) &&
      trip.availableSeatCount >= passengerCount &&
      Date.parse(trip.departureTime) > catalogueTime,
  );
  const nextDeparture = candidates.reduce(
    (earliest, trip) => Math.min(earliest, Date.parse(trip.departureTime)),
    Infinity,
  );
  const scheduleCatalogueUpdate = useEffectEvent((departure: number): number => {
    const delay = Math.min(MAX_TIMEOUT_MS, Math.max(0, departure - Date.now()));
    return window.setTimeout(() => setCatalogueTime(Date.now()), delay);
  });
  useEffect(() => {
    if (!Number.isFinite(nextDeparture)) return;
    const timeout = scheduleCatalogueUpdate(nextDeparture);
    return () => window.clearTimeout(timeout);
  }, [catalogueTime, nextDeparture]);
  const sort = tripSearchSchema.shape.sort.safeParse(
    params.get("sort") ?? "relevance",
  );
  const operatorName = params.get("operatorName");
  const visible = selectVisibleTrips(
    candidates,
    sort.success && sort.data !== "relevance" ? sort.data : "departure",
    { ...parseFilterCriteria(params), operatorName: operatorName ?? undefined },
  );
  return (
    <div className="trip-results trip-results--catalogue">
      <BookingFeedback booking={booking} />
      <TripSearchPanel
        locations={locations}
        params={params}
        onChange={onChange}
      />
      <div className="trip-results__body">
        <TripFilters
          key={effective.toString()}
          searchParams={effective}
          onChange={onChange}
          trips={candidates}
        />
        {!isMockApi && liveCatalogue.isPending ? (
          <BrandLoading compact title="Đang tải chuyến xe…" />
        ) : !isMockApi && liveCatalogue.isError ? (
          <PageState
            title="Chưa tải được chuyến xe"
            description="Vui lòng thử lại để xem lịch chạy."
            action={
              <Button onClick={() => void liveCatalogue.refetch()}>
                Thử lại
              </Button>
            }
          />
        ) : visible.length ? (
          <ResultsList
            trips={visible}
            search={{ passengerCount }}
            booking={booking}
            params={effective}
            onChange={onChange}
            originLabel=""
            destinationLabel=""
            allRoutes
          />
        ) : operatorName ? (
          <div className="trip-catalogue__empty">
            <ResultsEmpty
              operatorName={operatorName}
              onClearOperator={() => onChange(withoutOperatorName(effective))}
            />
          </div>
        ) : (
          <div className="trip-catalogue__empty">
            <PageState
              title="Không tìm thấy chuyến phù hợp"
              description="Thử đổi hành trình, ngày đi hoặc bỏ bớt bộ lọc."
              action={
                <Button onClick={() => onChange(new URLSearchParams())}>
                  Xem tất cả chuyến
                </Button>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function TripResultsPage(): ReactElement {
  const [params, setParams] = useSearchParams();
  const booking = useCreateBookingSession();
  if (params.get("reason") === "expired")
    return <ExpiredBookingState params={params} />;
  if (
    params.get("browse") === "1" ||
    (!params.has("originId") &&
      !params.has("destinationId") &&
      !params.has("departureDate"))
  )
    return (
      <TripCatalogue params={params} onChange={setParams} booking={booking} />
    );
  const search = parseTripSearch(params);
  return (
    <div className="trip-results">
      <BookingFeedback booking={booking} />
      {search ? (
        <ValidResults
          search={search}
          searchParams={params}
          onChange={setParams}
          booking={booking}
        />
      ) : (
        <PageState
          title="Thông tin tìm kiếm chưa hợp lệ"
          description="Kiểm tra điểm đi, điểm đến, ngày đi và số hành khách rồi tìm lại chuyến."
          action={<EditSearch label="Tìm lại chuyến" />}
        />
      )}
    </div>
  );
}

function BookingFeedback({
  booking,
}: {
  booking: CreateBookingSessionResult;
}): ReactElement | null {
  if (booking.isPending)
    return (
      <p className="trip-results__booking" role="status">
        Đang bắt đầu đặt vé…
      </p>
    );
  if (!booking.error) return null;
  if (booking.error.code === "TRIP_NOT_SELLABLE")
    return (
      <PageState
        title="Chuyến đã ngừng bán"
        description="Chuyến vừa ngừng nhận đặt vé. Vui lòng tìm chuyến khác."
        action={<EditSearch label="Tìm chuyến khác" />}
      />
    );
  if (booking.error.code === "ACCESS_REQUIRED")
    return (
      <p role="alert">
        Vui lòng <Link to="/login">đăng nhập</Link> để đặt vé.
      </p>
    );
  return (
    <div className="trip-results__booking" role="alert">
      <p>
        {booking.error.code === "NETWORK_ERROR"
          ? "Không thể kết nối để đặt vé. Kiểm tra kết nối và thử lại."
          : booking.error.canRetry
            ? "Chưa thể bắt đầu đặt vé. Bạn có thể thử lại hoặc chọn chuyến khác."
            : "Chưa thể bắt đầu đặt vé. Chọn chuyến khác hoặc sửa tìm kiếm để tiếp tục."}
      </p>
      {booking.error.canRetry && (
        <Button type="button" onClick={booking.retry}>
          Thử lại đặt vé
        </Button>
      )}
      <EditSearch />
    </div>
  );
}
