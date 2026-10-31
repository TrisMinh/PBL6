import { http, HttpResponse } from "msw";
import { z } from "zod";
import {
  operatorRouteSchema,
  routeInputSchema,
  type OperatorRoute,
  type RouteStop,
} from "@/features/operator/resources/routes.schema";
const stop = (
  id: string,
  name: string,
  address: string,
  kind: RouteStop["kind"],
  km: number,
): RouteStop => ({ id, name, address, kind, km });
const dalat = [
  stop("hcm", "Bến xe Miền Đông mới", "TP. Thủ Đức, TP.HCM", "pickup", 0),
  stop("td", "Ngã tư Thủ Đức", "TP. Thủ Đức, TP.HCM", "pickup", 18),
  stop("dn", "Trạm dừng Đồng Nai", "Long Khánh, Đồng Nai", "both", 85),
  stop("bl", "Bến xe Bảo Lộc", "Bảo Lộc, Lâm Đồng", "both", 190),
  stop("dli", "Trung tâm Đà Lạt", "TP. Đà Lạt, Lâm Đồng", "dropoff", 310),
];
const nhatrang = [
  dalat[0],
  stop("dn", "Trạm dừng Đồng Nai", "Long Khánh, Đồng Nai", "both", 85),
  stop("pth", "Bến xe Phan Thiết", "Phan Thiết, Bình Thuận", "both", 195),
  stop("ntr", "Bến xe Nha Trang", "Nha Trang, Khánh Hòa", "dropoff", 435),
];
const reverse = (stops: RouteStop[], distance: number): RouteStop[] =>
  [...stops]
    .reverse()
    .map((s) => ({
      ...s,
      km: distance - s.km,
      kind:
        s.kind === "pickup"
          ? "dropoff"
          : s.kind === "dropoff"
            ? "pickup"
            : "both",
    }));
const timestamp = "2026-09-05T03:31:00.000Z";
const samples: OperatorRoute[] = [
  {
    id: "RT-HCM-DLI",
    origin: "TP.HCM",
    destination: "Đà Lạt",
    region: "Miền Nam – Tây Nguyên",
    distance: 310,
    hours: 7,
    status: "active",
    stops: dalat,
    updatedAt: timestamp,
  },
  {
    id: "RT-HCM-NTR",
    origin: "TP.HCM",
    destination: "Nha Trang",
    region: "Miền Nam – Nam Trung Bộ",
    distance: 435,
    hours: 8,
    status: "active",
    stops: nhatrang,
    updatedAt: timestamp,
  },
  {
    id: "RT-DLI-HCM",
    origin: "Đà Lạt",
    destination: "TP.HCM",
    region: "Miền Nam – Tây Nguyên",
    distance: 310,
    hours: 7,
    status: "active",
    stops: reverse(dalat, 310),
    updatedAt: timestamp,
  },
  {
    id: "RT-PTH-HCM",
    origin: "Phan Thiết",
    destination: "TP.HCM",
    region: "Miền Nam – Nam Trung Bộ",
    distance: 195,
    hours: 4,
    status: "active",
    stops: [
      stop("pth", "Bến xe Phan Thiết", "Phan Thiết, Bình Thuận", "pickup", 0),
      stop("dn", "Trạm dừng Đồng Nai", "Long Khánh, Đồng Nai", "both", 110),
      stop(
        "hcm",
        "Bến xe Miền Đông mới",
        "TP. Thủ Đức, TP.HCM",
        "dropoff",
        195,
      ),
    ],
    updatedAt: timestamp,
  },
  {
    id: "RT-HCM-VTU",
    origin: "TP.HCM",
    destination: "Vũng Tàu",
    region: "Miền Nam",
    distance: 105,
    hours: 3.25,
    status: "active",
    stops: [
      dalat[0],
      stop("lt", "Trạm Long Thành", "Long Thành, Đồng Nai", "both", 55),
      stop("vtu", "Bến xe Vũng Tàu", "Vũng Tàu", "dropoff", 105),
    ],
    updatedAt: timestamp,
  },
  {
    id: "RT-NTR-HCM",
    origin: "Nha Trang",
    destination: "TP.HCM",
    region: "Miền Nam – Nam Trung Bộ",
    distance: 435,
    hours: 8,
    status: "paused",
    stops: reverse(nhatrang, 435),
    updatedAt: timestamp,
  },
];
const KEY = "blue-operator-routes-v1";
let routes = structuredClone(samples);
function load(): OperatorRoute[] {
  try {
    if (typeof sessionStorage !== "undefined") {
      const raw = sessionStorage.getItem(KEY);
      if (raw && raw.length < 300000) {
        const parsed = z
          .array(operatorRouteSchema)
          .max(100)
          .safeParse(JSON.parse(raw));
        if (parsed.success) routes = parsed.data;
      }
    }
  } catch {
    /* Keep initial fixtures when browser storage is unavailable. */
  }
  return routes;
}
function commit(next: OperatorRoute[]): boolean {
  try {
    if (typeof sessionStorage !== "undefined")
      sessionStorage.setItem(KEY, JSON.stringify(next));
    routes = next;
    return true;
  } catch {
    return false;
  }
}
function normalized(
  input: ReturnType<typeof routeInputSchema.parse>,
): OperatorRoute {
  return {
    ...input,
    stops: [...input.stops].sort((a, b) => a.km - b.km),
    updatedAt: new Date().toISOString(),
  };
}
export const operatorRouteHandlers = [
  http.get("/api/v1/operator/routes-preview", () =>
    HttpResponse.json({ items: load() }),
  ),
  http.post("/api/v1/operator/routes-preview", async ({ request }) => {
    try {
      const result = routeInputSchema.safeParse(await request.json());
      if (!result.success) return new HttpResponse(null, { status: 400 });
      const current = load();
      if (current.some((route) => route.id === result.data.id))
        return new HttpResponse(null, { status: 409 });
      if (current.length >= 100) return new HttpResponse(null, { status: 409 });
      const saved = normalized(result.data);
      if (!commit([...current, saved]))
        return new HttpResponse(null, { status: 503 });
      return HttpResponse.json(saved, { status: 201 });
    } catch {
      return new HttpResponse(null, { status: 400 });
    }
  }),
  http.put(
    "/api/v1/operator/routes-preview/:id",
    async ({ request, params }) => {
      try {
        const current = load();
        if (!current.some((route) => route.id === params.id))
          return new HttpResponse(null, { status: 404 });
        const result = routeInputSchema.safeParse(await request.json());
        if (!result.success || result.data.id !== params.id)
          return new HttpResponse(null, { status: 400 });
        const saved = normalized(result.data);
        if (
          !commit(
            current.map((route) => (route.id === params.id ? saved : route)),
          )
        )
          return new HttpResponse(null, { status: 503 });
        return HttpResponse.json(saved);
      } catch {
        return new HttpResponse(null, { status: 400 });
      }
    },
  ),
];
