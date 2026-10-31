import { http, HttpResponse } from "msw";
import { z } from "zod";
import {
  cabinConfigurationSchema,
  rearConfigurationSchema,
  vehicleSchema,
  vehicleInputSchema,
  seatPermissionSchema,
  vehicleSeatCodes,
  type OperatorVehicle,
} from "@/features/operator/vehicles/vehicles.schema";
const plates = [
  "45B-204.12",
  "51B-208.36",
  "49B-214.08",
  "51B-230.10",
  "51B-218.52",
  "50B-236.18",
  "72B-221.19",
  "51B-230.30",
  "51B-224.12",
  "51B-222.10",
  "50B-224.24",
  "45B-229.72",
  "79B-225.40",
  "51B-221.22",
  "51B-222.22",
];
const initial: OperatorVehicle[] = plates.map((plate, type) => ({
  id: plate,
  plate,
  type,
  disabledSeats:
    type === 14
      ? ["D07", "T11"]
      : type === 11
        ? ["D07", "T11"]
        : type === 8
          ? ["D07", "T11"]
          : type === 5
            ? ["D07", "T11"]
            : type === 0 ||
                type === 6 ||
                type === 9 ||
                type === 12 ||
                type === 7 ||
                type === 10 ||
                type === 13
              ? ["D07", "T11"]
              : type === 1 || type === 3
                ? ["A07"]
                : type === 2 || type === 4
                  ? ["A14", "A23"]
                  : [],
  ...(type === 1 || type === 4 || type === 7 || type === 5
    ? { rearSeats: 3 as const }
    : type === 2 || type === 6
      ? { rearSeats: 5 as const }
      : {}),
  ...(type === 13 ? { cabinCapacity: 22 as const } : {}),
  ...(type === 11 ? { lowerRooms: 10 as const } : {}),
  assignment:
    type === 0
      ? {
          code: "BL-204",
          origin: "TP.HCM",
          destination: "Đà Lạt",
          time: "11:00 – 17:30",
        }
      : type === 1
        ? {
            code: "BL-208",
            origin: "TP.HCM",
            destination: "Nha Trang",
            time: "13:30 – 20:00",
          }
        : type === 2
          ? {
              code: "BL-214",
              origin: "Đà Lạt",
              destination: "TP.HCM",
              time: "23:15 – 05:45",
            }
          : type === 3
            ? {
                code: "BL-230",
                origin: "TP.HCM",
                destination: "Nha Trang",
                time: "13:30 – 20:00",
              }
            : type === 6
              ? {
                  code: "BL-233",
                  origin: "TP.HCM",
                  destination: "Đà Lạt",
                  time: "11:00 – 17:30",
                }
              : type === 9
                ? {
                    code: "BL-236",
                    origin: "TP.HCM",
                    destination: "Đà Lạt",
                    time: "11:00 – 17:30",
                  }
                : type === 12
                  ? {
                      code: "BL-239",
                      origin: "TP.HCM",
                      destination: "Đà Lạt",
                      time: "11:00 – 17:30",
                    }
                  : type === 4
                    ? {
                        code: "BL-231",
                        origin: "Đà Lạt",
                        destination: "TP.HCM",
                        time: "23:15 – 05:45",
                      }
                    : type === 7
                      ? {
                          code: "BL-234",
                          origin: "TP.HCM",
                          destination: "Đà Lạt",
                          time: "11:00 – 17:30",
                        }
                      : type === 10
                        ? {
                            code: "BL-237",
                            origin: "TP.HCM",
                            destination: "Đà Lạt",
                            time: "11:00 – 17:30",
                          }
                        : type === 13
                          ? {
                              code: "BL-240",
                              origin: "TP.HCM",
                              destination: "Đà Lạt",
                              time: "11:00 – 17:30",
                            }
                          : type === 5
                            ? {
                                code: "BL-232",
                                origin: "TP.HCM",
                                destination: "Đà Lạt",
                                time: "11:00 – 17:30",
                              }
                            : type === 8
                              ? {
                                  code: "BL-235",
                                  origin: "TP.HCM",
                                  destination: "Đà Lạt",
                                  time: "11:00 – 17:30",
                                }
                              : type === 11
                                ? {
                                    code: "BL-238",
                                    origin: "TP.HCM",
                                    destination: "Đà Lạt",
                                    time: "11:00 – 17:30",
                                  }
                                : type === 14
                                  ? {
                                      code: "BL-241",
                                      origin: "TP.HCM",
                                      destination: "Đà Lạt",
                                      time: "11:00 – 17:30",
                                    }
                                  : null,
}));
const LEGACY_KEY = "blue-operator-vehicles-v1";
const KEY = "blue-operator-vehicles-v2";
let vehicles = structuredClone(initial);
const storedVehicleSchema = z.preprocess((value) => {
  const room = z
    .object({
      type: z.literal(11),
      lowerRooms: z.undefined().optional(),
      disabledSeats: z.array(z.string()),
    })
    .passthrough()
    .safeParse(value);
  if (room.success)
    return {
      ...room.data,
      lowerRooms: 10,
      disabledSeats: [
        ...new Set(
          room.data.disabledSeats.map((code) =>
            code === "D11" ? "T11" : code,
          ),
        ),
      ],
    };
  const legacy = z
    .object({
      type: z.union([z.literal(9), z.literal(13), z.literal(14)]),
      disabledSeats: z.array(z.string()),
    })
    .passthrough()
    .safeParse(value);
  if (!legacy.success) return value;
  return {
    ...legacy.data,
    disabledSeats: [
      ...new Set(
        legacy.data.disabledSeats.map((code) =>
          code === "D11" ? "T12" : code,
        ),
      ),
    ],
  };
}, vehicleSchema);
function load(): OperatorVehicle[] {
  try {
    const raw =
      typeof sessionStorage !== "undefined"
        ? (sessionStorage.getItem(KEY) ?? sessionStorage.getItem(LEGACY_KEY))
        : null;
    if (raw && raw.length < 300000) {
      const parsed = z
        .array(storedVehicleSchema)
        .max(200)
        .safeParse(JSON.parse(raw));
      if (parsed.success)
        vehicles = parsed.data.map((v) =>
          v.type === 1
            ? {
                ...v,
                rearSeats: v.rearSeats ?? 3,
                assignment:
                  v.plate === "51B-208.36"
                    ? initial[1].assignment
                    : v.assignment,
              }
            : v.type === 2
              ? {
                  ...v,
                  rearSeats: v.rearSeats ?? 5,
                  assignment:
                    v.plate === "49B-214.08"
                      ? initial[2].assignment
                      : v.assignment,
                }
              : v.type === 3 && v.plate === "51B-230.10"
                ? { ...v, assignment: initial[3].assignment }
                : v.type === 6
                  ? {
                      ...v,
                      rearSeats: v.rearSeats ?? 5,
                      assignment:
                        v.plate === "72B-221.19"
                          ? initial[6].assignment
                          : v.assignment,
                    }
                  : v.type === 9 && v.plate === "51B-222.10"
                    ? { ...v, assignment: initial[9].assignment }
                    : v.type === 12 && v.plate === "79B-225.40"
                      ? { ...v, assignment: initial[12].assignment }
                      : v.type === 4
                        ? {
                            ...v,
                            rearSeats: v.rearSeats ?? 3,
                            assignment:
                              v.plate === "51B-218.52"
                                ? initial[4].assignment
                                : v.assignment,
                          }
                        : v.type === 7
                          ? {
                              ...v,
                              rearSeats: v.rearSeats ?? 3,
                              assignment:
                                v.plate === "51B-230.30"
                                  ? initial[7].assignment
                                  : v.assignment,
                            }
                          : v.type === 10 && v.plate === "50B-224.24"
                            ? { ...v, assignment: initial[10].assignment }
                            : v.type === 13
                              ? {
                                  ...v,
                                  cabinCapacity: v.cabinCapacity ?? 22,
                                  assignment:
                                    v.plate === "51B-221.22"
                                      ? initial[13].assignment
                                      : v.assignment,
                                }
                              : v.type === 5
                                ? {
                                    ...v,
                                    rearSeats: v.rearSeats ?? 3,
                                    assignment:
                                      v.plate === "50B-236.18"
                                        ? initial[5].assignment
                                        : v.assignment,
                                  }
                                : v.type === 8 && v.plate === "51B-224.12"
                                  ? { ...v, assignment: initial[8].assignment }
                                  : v.type === 11
                                    ? {
                                        ...v,
                                        lowerRooms: v.lowerRooms ?? 10,
                                        assignment:
                                          v.plate === "45B-229.72"
                                            ? initial[11].assignment
                                            : v.assignment,
                                      }
                                    : v.type === 14 && v.plate === "51B-222.22"
                                      ? {
                                          ...v,
                                          assignment: initial[14].assignment,
                                        }
                                      : v,
        );
    }
  } catch {
    /* Keep fixtures when storage is unavailable. */
  }
  return vehicles;
}
function commit(next: OperatorVehicle[]): boolean {
  try {
    if (typeof sessionStorage !== "undefined")
      sessionStorage.setItem(KEY, JSON.stringify(next));
    vehicles = next;
    return true;
  } catch {
    return false;
  }
}
export const operatorVehicleHandlers = [
  http.patch(
    "/api/v1/operator/vehicles-preview/:id/room-configuration",
    async ({ request, params }) => {
      try {
        const current = load();
        const vehicle = current.find((v) => v.id === params.id);
        if (!vehicle) return new HttpResponse(null, { status: 404 });
        const result = z
          .object({ lowerRooms: z.union([z.literal(10), z.literal(11)]) })
          .safeParse(await request.json());
        if (!result.success || vehicle.type !== 11)
          return new HttpResponse(null, { status: 400 });
        const codes = vehicleSeatCodes(
          vehicle.type,
          vehicle.rearSeats,
          vehicle.cabinCapacity,
          result.data.lowerRooms,
        );
        const saved = {
          ...vehicle,
          lowerRooms: result.data.lowerRooms,
          disabledSeats: vehicle.disabledSeats.filter((code) =>
            codes.includes(code),
          ),
        };
        if (!commit(current.map((v) => (v.id === saved.id ? saved : v))))
          return new HttpResponse(null, { status: 503 });
        return HttpResponse.json(saved);
      } catch {
        return new HttpResponse(null, { status: 400 });
      }
    },
  ),
  http.patch(
    "/api/v1/operator/vehicles-preview/:id/cabin-configuration",
    async ({ request, params }) => {
      try {
        const current = load();
        const vehicle = current.find((v) => v.id === params.id);
        if (!vehicle) return new HttpResponse(null, { status: 404 });
        const result = cabinConfigurationSchema.safeParse(await request.json());
        if (!result.success || vehicle.type !== 13)
          return new HttpResponse(null, { status: 400 });
        const codes = vehicleSeatCodes(
          vehicle.type,
          vehicle.rearSeats,
          result.data.cabinCapacity,
        );
        const saved = {
          ...vehicle,
          cabinCapacity: result.data.cabinCapacity,
          disabledSeats: vehicle.disabledSeats.filter((code) =>
            codes.includes(code),
          ),
        };
        if (!commit(current.map((v) => (v.id === saved.id ? saved : v))))
          return new HttpResponse(null, { status: 503 });
        return HttpResponse.json(saved);
      } catch {
        return new HttpResponse(null, { status: 400 });
      }
    },
  ),
  http.patch(
    "/api/v1/operator/vehicles-preview/:id/rear-configuration",
    async ({ request, params }) => {
      try {
        const current = load();
        const vehicle = current.find((v) => v.id === params.id);
        if (!vehicle) return new HttpResponse(null, { status: 404 });
        const parsed = rearConfigurationSchema.safeParse(await request.json());
        if (
          !parsed.success ||
          (vehicle.type !== 1 &&
            vehicle.type !== 2 &&
            vehicle.type !== 4 &&
            vehicle.type !== 6 &&
            vehicle.type !== 7 &&
            vehicle.type !== 5) ||
          ((vehicle.type === 1 || vehicle.type === 4) &&
            parsed.data.rearSeats > 4) ||
          ((vehicle.type === 2 || vehicle.type === 6) &&
            parsed.data.rearSeats < 4) ||
          ((vehicle.type === 7 || vehicle.type === 5) &&
            parsed.data.rearSeats < 3)
        )
          return new HttpResponse(null, { status: 400 });
        const codes = vehicleSeatCodes(vehicle.type, parsed.data.rearSeats);
        const saved = {
          ...vehicle,
          rearSeats: parsed.data.rearSeats,
          disabledSeats: vehicle.disabledSeats.filter((code) =>
            codes.includes(code),
          ),
        };
        if (!commit(current.map((v) => (v.id === saved.id ? saved : v))))
          return new HttpResponse(null, { status: 503 });
        return HttpResponse.json(saved);
      } catch {
        return new HttpResponse(null, { status: 400 });
      }
    },
  ),
  http.get("/api/v1/operator/vehicles-preview", () =>
    HttpResponse.json({ items: load() }),
  ),
  http.post("/api/v1/operator/vehicles-preview", async ({ request }) => {
    try {
      const parsed = vehicleInputSchema.safeParse(await request.json());
      if (!parsed.success) return new HttpResponse(null, { status: 400 });
      const current = load();
      if (
        current.length >= 200 ||
        current.some((v) => v.plate === parsed.data.plate)
      )
        return new HttpResponse(null, { status: 409 });
      const saved: OperatorVehicle = {
        ...parsed.data,
        id: parsed.data.plate,
        disabledSeats: [],
        assignment: null,
      };
      if (!commit([...current, saved]))
        return new HttpResponse(null, { status: 503 });
      return HttpResponse.json(saved, { status: 201 });
    } catch {
      return new HttpResponse(null, { status: 400 });
    }
  }),
  http.patch(
    "/api/v1/operator/vehicles-preview/:id/seats/:code",
    async ({ request, params }) => {
      try {
        const current = load();
        const vehicle = current.find((v) => v.id === params.id);
        if (!vehicle) return new HttpResponse(null, { status: 404 });
        const parsed = seatPermissionSchema.safeParse(await request.json());
        if (
          !parsed.success ||
          !vehicleSeatCodes(
            vehicle.type,
            vehicle.rearSeats,
            vehicle.cabinCapacity,
            vehicle.lowerRooms,
          ).includes(String(params.code))
        )
          return new HttpResponse(null, { status: 400 });
        const disabled = new Set(vehicle.disabledSeats);
        if (parsed.data.enabled) disabled.delete(String(params.code));
        else disabled.add(String(params.code));
        const saved = { ...vehicle, disabledSeats: [...disabled] };
        if (!commit(current.map((v) => (v.id === saved.id ? saved : v))))
          return new HttpResponse(null, { status: 503 });
        return HttpResponse.json(saved);
      } catch {
        return new HttpResponse(null, { status: 400 });
      }
    },
  ),
];
