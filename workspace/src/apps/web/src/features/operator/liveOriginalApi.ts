import { z } from "zod";
import { apiJson } from "@/shared/api/client";
import { getLiveRows, liveApiJson } from "@/shared/api/liveRequest";
// Operator resource endpoints return different row shapes. Their adapters parse each result against its page schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;
export const rows = getLiveRows as (
  path: string,
  signal?: AbortSignal,
) => Promise<Row[]>;
export const request = (
  path: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<Row> =>
  liveApiJson(path, z.any(), {
    method,
    body,
    signal,
    idempotent: method !== "GET",
  });
export const metadata = (
  kind: string,
  signal?: AbortSignal,
): Promise<Record<string, Row>> =>
  apiJson(
    `/api/v1/operator/resource-metadata/${kind}`,
    z.record(z.string(), z.any()),
    { signal },
  );
export const saveMetadata = (
  kind: string,
  id: string,
  body: unknown,
): Promise<Row> =>
  request(`/api/v1/operator/resource-metadata/${kind}/${id}`, "PUT", body);
export const localDateTime = (value: string): string =>
  new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 16);
export const vehicleTypes = [
  "SLEEPER_40",
  "LIMOUSINE_11",
  "VIP_29",
  "LIMOUSINE_10",
  "LIMOUSINE_24",
  "SLEEPER_36",
  "SLEEPER_34",
  "SLEEPER_30",
  "SLEEPER_24",
  "LIMOUSINE_SLEEPER_22",
  "ROOM_24",
  "ROOM_21",
  "CABIN_24",
  "CABIN_21_22",
  "CABIN_22",
];
export const typeIndex = (value: string): number => {
  const i = vehicleTypes.indexOf(value);
  return i >= 0 ? i : value === "STANDARD" ? 2 : 0;
};
