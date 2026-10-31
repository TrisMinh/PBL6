import type { Location } from "@/features/trips/types/trip";

// Fictional terminal names; city/province labels are only geographic context.
export const locations = Object.freeze([
  Object.freeze({
    id: "loc-hcm",
    name: "Bến Mây Sài Gòn",
    displayName: "TP. Hồ Chí Minh",
    province: "Hồ Chí Minh",
  }),
  Object.freeze({
    id: "loc-danang",
    name: "Bến Sóng Đà Nẵng",
    displayName: "Đà Nẵng",
    province: "Đà Nẵng",
  }),
  Object.freeze({
    id: "loc-dalat",
    name: "Bến Thông Đà Lạt",
    displayName: "Đà Lạt",
    province: "Lâm Đồng",
  }),
  Object.freeze({
    id: "loc-hanoi",
    name: "Bến Mây Hà Nội",
    displayName: "Hà Nội",
    province: "Hà Nội",
  }),
]) satisfies readonly Location[];
