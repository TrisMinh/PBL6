import {
  provinceDetailSchema,
  type ProvinceDetail,
} from "@/features/explore/explore.schema";
import { operators } from "@/mocks/fixtures/operators";

const seeds = [
  {
    slug: "ho-chi-minh",
    name: "TP. Hồ Chí Minh",
    region: "Miền Nam",
    description:
      "Kết nối hành trình từ thành phố đến cao nguyên và miền Trung.",
    sites: [
      ["Văn phòng trung tâm", "Khu vực Quận 1, TP. Hồ Chí Minh"],
      ["Điểm phía Đông", "Khu vực Thủ Đức, TP. Hồ Chí Minh"],
      ["Điểm phía Tây", "Khu vực Bình Tân, TP. Hồ Chí Minh"],
    ],
  },
  {
    slug: "lam-dong",
    name: "Lâm Đồng",
    region: "Tây Nguyên",
    description:
      "Tìm điểm hẹn cho hành trình khám phá Đà Lạt và vùng cao nguyên.",
    sites: [
      ["Văn phòng Đà Lạt", "Khu vực trung tâm Đà Lạt, Lâm Đồng"],
      ["Điểm cửa ngõ cao nguyên", "Khu vực Đức Trọng, Lâm Đồng"],
      ["Điểm phía Nam", "Khu vực Bảo Lộc, Lâm Đồng"],
    ],
  },
  {
    slug: "da-nang",
    name: "Đà Nẵng",
    region: "Miền Trung",
    description: "Tra cứu các điểm kết nối trên hành trình dọc miền Trung.",
    sites: [
      ["Văn phòng Đà Nẵng", "Khu vực Hải Châu, Đà Nẵng"],
      ["Điểm phía Tây", "Khu vực Liên Chiểu, Đà Nẵng"],
      ["Điểm ven sông", "Khu vực Sơn Trà, Đà Nẵng"],
    ],
  },
  {
    slug: "ha-noi",
    name: "Hà Nội",
    region: "Miền Bắc",
    description: "Khám phá các điểm đón, trả phục vụ hành trình từ thủ đô.",
    sites: [
      ["Văn phòng Hà Nội", "Khu vực Hoàn Kiếm, Hà Nội"],
      ["Điểm phía Nam", "Khu vực Hoàng Mai, Hà Nội"],
      ["Điểm phía Tây", "Khu vực Nam Từ Liêm, Hà Nội"],
    ],
  },
] as const;

// Names, service coverage and area-level addresses are invented demonstration data.
// No operational stop, postal address or geographic coordinate is asserted as verified.
export const exploreProvinces: readonly ProvinceDetail[] = Object.freeze(
  seeds.map((seed) => {
    const servedBy = operators.slice(0, 2);
    return Object.freeze(
      provinceDetailSchema.parse({
        slug: seed.slug,
        name: seed.name,
        region: seed.region,
        description: seed.description,
        isMock: true,
        operatorCount: servedBy.length,
        pickupCount: 2,
        dropoffCount: 2,
        operators: servedBy,
        points: seed.sites.map(([name, address], index) => ({
          id: `${seed.slug}-${index + 1}`,
          name,
          address,
          services:
            index === 0
              ? ["pickup", "dropoff"]
              : index === 1
                ? ["pickup"]
                : ["dropoff"],
          operatorIds: servedBy.map((operator) => operator.id),
          latitude: null,
          longitude: null,
          coordinateSource: null,
        })),
      }),
    );
  }),
);
