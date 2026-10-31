import type { OperatorSummary } from "@/features/trips/types/trip";

// Mock operator labels; no real logos, claims or testimonials are represented.
export const operators = Object.freeze([
  Object.freeze({ id: "op-blue-express", name: "BLUE Express" }),
  Object.freeze({ id: "op-sao-mai", name: "Sao Mai" }),
  Object.freeze({ id: "op-duong-viet", name: "Đường Việt" }),
  Object.freeze({ id: "op-hanh-trinh-xanh", name: "Hành Trình Xanh" }),
  Object.freeze({ id: "op-cao-nguyen", name: "Cao Nguyên" }),
  Object.freeze({ id: "op-doi-xanh", name: "Đồi Xanh" }),
]) satisfies readonly OperatorSummary[];
