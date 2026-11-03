import { isMockApi } from "@/shared/api/config";
import type { ReactElement } from "react";
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
  TripAmenity,
  TripSearch,
} from "@/features/trips/types/trip";
import { ROUTES } from "@/shared/config/routes";
import { Button } from "@/shared/ui/Button/Button";
import { PageState } from "@/shared/ui/PageState/PageState";
import calendarIcon from "@/assets/trip-results/calendar.svg";
import destinationIcon from "@/assets/trip-results/destination.svg";
import originIcon from "@/assets/trip-results/origin.svg";
import passengersIcon from "@/assets/trip-results/passengers.svg";

import "./TripResultsPage.css";

type TripsQuery = ReturnType<typeof useTrips>;
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
}: {
  count: number;
  originLabel: string;
  destinationLabel: string;
}): ReactElement {
  return (
    <header className="trip-results__header">
      <h1 className="trip-results__title">
        Chuyến xe {originLabel} → {destinationLabel}
      </h1>
      <p className="trip-results__count" role="status">
        {count} kết quả
      </p>
    </header>
  );
}

function SearchFact({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}): ReactElement {
  return (
    <div className="trip-results__search-fact">
      <span>{label}</span>
      <strong>
        <img alt="" src={icon} />
        {value}
      </strong>
    </div>
  );
}

function SearchSummary({
  search,
  count,
  originLabel,
  destinationLabel,
}: {
  search: TripSearch;
  count: number;
  originLabel: string;
  destinationLabel: string;
}): ReactElement {
  return (
    <section className="trip-results__search" aria-label="Tìm chuyến hiện tại">
      <div className="trip-results__trip-types">
        <span className="trip-results__trip-type trip-results__trip-type--active">
          Một chiều
        </span>
        <span className="trip-results__trip-type">Khứ hồi</span>
      </div>
      <p className="trip-results__search-count">{count} chuyến phù hợp</p>
      <div className="trip-results__search-fields">
        <SearchFact label="ĐIỂM ĐI" value={originLabel} icon={originIcon} />
        <span className="trip-results__swap" aria-hidden="true">
          ⇄
        </span>
        <SearchFact
          label="ĐIỂM ĐẾN"
          value={destinationLabel}
          icon={destinationIcon}
        />
        <SearchFact
          label="NGÀY ĐI"
          value={search.departureDate.split("-").reverse().join("/")}
          icon={calendarIcon}
        />
        <SearchFact
          label="HÀNH KHÁCH"
          value={`${search.passengerCount} người`}
          icon={passengersIcon}
        />
        <Link className="trip-results__search-action" to={ROUTES.home}>
          Tìm chuyến
        </Link>
      </div>
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
    ["duration-asc", "Thời gian ngắn nhất"],
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
}: {
  trips: readonly Trip[];
  search: TripSearch;
  booking: CreateBookingSessionResult;
  params: URLSearchParams;
  onChange: (params: URLSearchParams) => void;
  originLabel: string;
  destinationLabel: string;
}): ReactElement {
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
  return (
    <div className="trip-results__success">
      <div className="trip-results__heading-row">
        <ResultsHeading
          count={trips.length}
          originLabel={originLabel}
          destinationLabel={destinationLabel}
        />
        <SortPills params={params} onChange={onChange} />
      </div>
      <ul className="trip-results__list" aria-label="Danh sách chuyến">
        {pageTrips.map((trip) => (
          <li className="trip-results__item" key={trip.id}>
            <TripCard
              trip={trip}
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
      <p role="status">Đang tải chuyến…</p>
    </section>
  );
}

function ResultsEmpty(): ReactElement {
  return (
    <PageState
      title="Không tìm thấy chuyến phù hợp"
      description="Thử đổi loại xe hoặc sửa hành trình và ngày đi để tìm chuyến khác."
      action={<EditSearch />}
    />
  );
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
  const visible = selectVisibleTrips(
    query.data,
    search.sort,
    parseFilterCriteria(params),
  );
  if (visible.length === 0) return <ResultsEmpty />;
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
  const query = useTrips({
    ...search,
    filters: parseFilterCriteria(searchParams),
  });
  const filterCatalog = useTrips({ ...search, sort: "relevance" }, !isMockApi);
  const locations = useLocations();
  const originLabel =
    locations.data?.find((location) => location.id === search.originId)
      ?.displayName ?? search.originId;
  const destinationLabel =
    locations.data?.find((location) => location.id === search.destinationId)
      ?.displayName ?? search.destinationId;
  return (
    <>
      <SearchSummary
        search={search}
        count={query.data?.length ?? 0}
        originLabel={originLabel}
        destinationLabel={destinationLabel}
      />
      <div className="trip-results__body">
        <TripFilters
          key={searchParams.toString()}
          searchParams={searchParams}
          onChange={onChange}
          trips={filterCatalog.data ?? query.data ?? []}
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

export function TripResultsPage(): ReactElement {
  const [params, setParams] = useSearchParams();
  const booking = useCreateBookingSession();
  if (params.get("reason") === "expired")
    return <ExpiredBookingState params={params} />;
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
