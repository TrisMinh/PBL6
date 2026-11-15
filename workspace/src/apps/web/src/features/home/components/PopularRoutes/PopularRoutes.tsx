import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { z } from "zod";
import { isMockApi } from "@/shared/api/config";
import { apiJson } from "@/shared/api/client";
import { ApiFailure } from "@/shared/api/ResourcePage";

import daNangHue from "@/assets/home/route-da-nang-hue.png";
import haNoiSaPa from "@/assets/home/route-ha-noi-sa-pa.png";
import hoChiMinhDaLat from "@/assets/home/route-ho-chi-minh-da-lat.png";
import nhaTrangDaLat from "@/assets/home/route-nha-trang-da-lat.png";

import "./PopularRoutes.css";

const POPULAR_ROUTES = [
  {
    title: "TP.HCM → Đà Lạt",
    price: "Từ 280.000 VNĐ",
    image: hoChiMinhDaLat,
  },
  { title: "Hà Nội → Sa Pa", price: "Từ 320.000 VNĐ", image: haNoiSaPa },
  { title: "Đà Nẵng → Huế", price: "Từ 150.000 VNĐ", image: daNangHue },
  {
    title: "Nha Trang → Đà Lạt",
    price: "Từ 210.000 VNĐ",
    image: nhaTrangDaLat,
  },
] as const;

export function PopularRoutes(): ReactElement {
  return isMockApi ? <MockPopularRoutes /> : <LiveRoutes />;
}

const routesSchema = z.array(
  z.object({
    origin: z.string(),
    destination: z.string(),
    tripCount: z.number(),
    operatorCount: z.number(),
  }),
);
function LiveRoutes(): ReactElement {
  const query = useQuery({
    queryKey: ["live-api", "explore-routes"],
    queryFn: ({ signal }) =>
      apiJson("/api/v1/explore/routes", routesSchema, { signal, auth: false }),
    retry: false,
  });
  return (
    <section className="popular-routes" aria-labelledby="popular-routes-title">
      <header className="popular-routes__header">
        <h2 id="popular-routes-title">Tuyến đường đang mở bán</h2>
        <p>Khám phá các tuyến xe hiện có trên BLUE</p>
      </header>
      {query.isPending ? (
        <p role="status">Đang tải tuyến xe…</p>
      ) : query.isError ? (
        <ApiFailure error={query.error} retry={() => void query.refetch()} />
      ) : !query.data.length ? (
        <p>Chưa có tuyến đang mở bán.</p>
      ) : (
        <div
          className="popular-routes__scroller"
          aria-label="Danh sách tuyến xe"
          role="region"
          tabIndex={0}
        >
          {query.data.map((route) => {
            const title = `${route.origin} → ${route.destination}`;
            const illustration = POPULAR_ROUTES.find((r) => r.title === title);
            return (
              <article className="popular-routes__card" key={title}>
                {illustration && (
                  <img
                    src={illustration.image}
                    alt=""
                    width={1672}
                    height={941}
                    loading="lazy"
                  />
                )}
                <div className="popular-routes__card-copy">
                  <h3>
                    <Link to={`/explore/${encodeURIComponent(route.origin)}`}>
                      {title}
                    </Link>
                  </h3>
                  <p>
                    {route.tripCount} chuyến · {route.operatorCount} nhà xe
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MockPopularRoutes(): ReactElement {
  return (
    <section className="popular-routes" aria-labelledby="popular-routes-title">
      <header className="popular-routes__header">
        <h2 id="popular-routes-title">Tuyến đường phổ biến</h2>
        <p>Những tuyến được đặt nhiều trong tuần này</p>
      </header>
      <div
        aria-label="Danh sách tuyến đường phổ biến"
        className="popular-routes__scroller"
        role="region"
        tabIndex={0}
      >
        {POPULAR_ROUTES.map((route) => (
          <article
            className="popular-routes__card"
            aria-label={route.title}
            key={route.title}
          >
            <img
              src={route.image}
              alt=""
              width={1672}
              height={941}
              loading="lazy"
            />
            <div className="popular-routes__card-copy">
              <h3>{route.title}</h3>
              <p>{route.price}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
