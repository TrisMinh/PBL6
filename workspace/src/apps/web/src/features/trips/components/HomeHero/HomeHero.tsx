import { isMockApi } from "@/shared/api/config";
import { useId, type ReactElement } from "react";
import { createSearchParams, useNavigate } from "react-router";

import heroBus from "@/assets/home/hero-bus.png";
import { SearchForm } from "@/features/trips/components/SearchForm/SearchForm";
import { useLocations } from "@/features/trips/hooks/useLocations";
import type { TripSearch } from "@/features/trips/types/trip";
import { ROUTES } from "@/shared/config/routes";
import { Button } from "@/shared/ui/Button/Button";

import "./HomeHero.css";

function LocationsError({ onRetry }: { onRetry: () => void }): ReactElement {
  return (
    <div className="home-hero__status">
      <p role="alert">Không thể tải điểm đi và điểm đến. Vui lòng thử lại.</p>
      <Button type="button" onClick={onRetry}>
        Thử lại
      </Button>
    </div>
  );
}

function useSearchNavigation(): (search: TripSearch) => void {
  const navigate = useNavigate();
  return (search) => {
    const params = createSearchParams({
      originId: search.originId,
      destinationId: search.destinationId,
      departureDate: search.departureDate,
      passengerCount: String(search.passengerCount),
    });
    void navigate({ pathname: ROUTES.trips, search: params.toString() });
  };
}

function HomeSearch(): ReactElement {
  const locations = useLocations();
  const onSearch = useSearchNavigation();
  if (locations.isPending)
    return (
      <p className="home-hero__status" role="status">
        Đang tải điểm đi và điểm đến…
      </p>
    );
  if (locations.isError)
    return (
      <LocationsError
        onRetry={() => {
          void locations.refetch();
        }}
      />
    );
  if (isMockApi && !locations.data.length)
    return (
      <p className="home-hero__status" role="status">
        Chưa có điểm đi và điểm đến. Vui lòng thử lại sau.
      </p>
    );
  return (
    <SearchForm
      locations={locations.data}
      withLeadingIcon
      onSubmit={onSearch}
    />
  );
}

function HeroCopy({ titleId }: { titleId: string }): ReactElement {
  return (
    <div className="home-hero__copy">
      <p className="home-hero__eyebrow">Đặt vé rõ ràng - Đi xa nhẹ nhàng</p>
      <h1 className="home-hero__title" id={titleId} data-testid="home-heading">
        Mỗi hành trình
        <br /> đều thật giản đơn.
      </h1>
      <p className="home-hero__description" data-testid="home-message">
        Chuyến ngon mình chọn, ghế ngon mình chốt
      </p>
    </div>
  );
}

export function HomeHero(): ReactElement {
  const titleId = useId();
  return (
    <section className="home-hero" aria-labelledby={titleId}>
      <img
        className="home-hero__image"
        src={heroBus}
        alt=""
        width={1536}
        height={1024}
        fetchPriority="high"
      />
      <HeroCopy titleId={titleId} />
      <div className="home-hero__search">
        <HomeSearch />
      </div>
    </section>
  );
}
