import { http, HttpResponse } from "msw";
import { z } from "zod";
const querySchema = z.object({
  origin: z.string().trim().min(1).max(80),
  destination: z.string().trim().min(1).max(80),
  distance: z.coerce.number().finite().positive().max(5000),
});
// Local presentation catalogue: names and administrative labels follow the Figma sample.
const places = [
  {
    id: "mien-dong",
    province: "TP.HCM",
    district: "TP. Thủ Đức",
    name: "Bến xe Miền Đông mới",
    address: "501 Hoàng Hữu Nam, TP. Thủ Đức",
  },
  {
    id: "thu-duc",
    province: "TP.HCM",
    district: "TP. Thủ Đức",
    name: "Ngã tư Thủ Đức",
    address: "Xa lộ Hà Nội, TP. Thủ Đức",
  },
  {
    id: "suoi-tien",
    province: "TP.HCM",
    district: "TP. Thủ Đức",
    name: "Trạm Suối Tiên",
    address: "Điểm đón mẫu Suối Tiên, TP. Thủ Đức",
  },
  {
    id: "binh-thanh",
    province: "TP.HCM",
    district: "Bình Thạnh",
    name: "Văn phòng Bình Thạnh",
    address: "Văn phòng mẫu, Bình Thạnh, TP.HCM",
  },
  {
    id: "dong-nai",
    province: "Đồng Nai",
    district: "Long Khánh",
    name: "Trạm dừng Đồng Nai",
    address: "Long Khánh, Đồng Nai",
  },
  {
    id: "bao-loc",
    province: "Lâm Đồng",
    district: "Bảo Lộc",
    name: "Bến xe Bảo Lộc",
    address: "Bảo Lộc, Lâm Đồng",
  },
  {
    id: "da-lat",
    province: "Lâm Đồng",
    district: "TP. Đà Lạt",
    name: "Trung tâm Đà Lạt",
    address: "TP. Đà Lạt, Lâm Đồng",
  },
  {
    id: "phan-thiet",
    province: "Bình Thuận",
    district: "Phan Thiết",
    name: "Bến xe Phan Thiết",
    address: "Phan Thiết, Bình Thuận",
  },
  {
    id: "nha-trang",
    province: "Khánh Hòa",
    district: "Nha Trang",
    name: "Bến xe Nha Trang",
    address: "Nha Trang, Khánh Hòa",
  },
  {
    id: "long-thanh",
    province: "Đồng Nai",
    district: "Long Thành",
    name: "Trạm Long Thành",
    address: "Long Thành, Đồng Nai",
  },
  {
    id: "vung-tau",
    province: "Vũng Tàu",
    district: "TP. Vũng Tàu",
    name: "Bến xe Vũng Tàu",
    address: "TP. Vũng Tàu",
  },
];
const paths: Record<
  string,
  { distance: number; points: Record<string, number> }
> = {
  "Đà Lạt": {
    distance: 310,
    points: {
      "mien-dong": 0,
      "thu-duc": 18,
      "suoi-tien": 12,
      "binh-thanh": 0,
      "dong-nai": 85,
      "bao-loc": 190,
      "da-lat": 310,
    },
  },
  "Nha Trang": {
    distance: 435,
    points: {
      "mien-dong": 0,
      "thu-duc": 18,
      "suoi-tien": 12,
      "binh-thanh": 0,
      "dong-nai": 85,
      "phan-thiet": 195,
      "nha-trang": 435,
    },
  },
  "Phan Thiết": {
    distance: 195,
    points: {
      "mien-dong": 0,
      "thu-duc": 18,
      "suoi-tien": 12,
      "binh-thanh": 0,
      "dong-nai": 85,
      "phan-thiet": 195,
    },
  },
  "Vũng Tàu": {
    distance: 105,
    points: {
      "mien-dong": 0,
      "thu-duc": 18,
      "suoi-tien": 12,
      "binh-thanh": 0,
      "long-thanh": 55,
      "vung-tau": 105,
    },
  },
};
export const operatorStopCatalogueHandlers = [
  http.get("/api/v1/operator/stop-catalogue", ({ request }) => {
    const parsed = querySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success || parsed.data.origin === parsed.data.destination)
      return new HttpResponse(null, { status: 400 });
    const { origin, destination, distance } = parsed.data;
    const reverse = destination === "TP.HCM";
    const path =
      origin === "TP.HCM"
        ? paths[destination]
        : reverse
          ? paths[origin]
          : undefined;
    if (!path)
      return HttpResponse.json({
        items: [
          {
            id: `custom-origin-${origin}`,
            province: origin,
            district: "Trung tâm",
            name: `Địa điểm mẫu tại ${origin}`,
            address: `Địa điểm mẫu, ${origin}`,
            km: 0,
          },
          {
            id: `custom-destination-${destination}`,
            province: destination,
            district: "Trung tâm",
            name: `Địa điểm mẫu tại ${destination}`,
            address: `Địa điểm mẫu, ${destination}`,
            km: distance,
          },
        ],
      });
    return HttpResponse.json({
      items: places
        .filter((place) => path.points[place.id] !== undefined)
        .map((place) => ({
          ...place,
          km:
            Math.round(
              ((reverse
                ? path.distance - path.points[place.id]
                : path.points[place.id]) /
                path.distance) *
                distance *
                100,
            ) / 100,
        })),
    });
  }),
];
