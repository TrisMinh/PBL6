export interface VehicleSeat {
  code: string;
  deck: number;
  row: number;
  column: number;
  type: string;
  enabled: boolean;
}

export const vehicleTypeNames: Record<string, string> = {
  LIMOUSINE_10: "Limousine",
  LIMOUSINE_24: "Limousine",
  LIMOUSINE_SLEEPER_22: "Limousine giường",
  CABIN_24: "Cabin",
  CABIN_21_22: "Cabin",
};

/** Positions are in the template's physical rows and columns; codes remain server supplied. */
export function layoutPosition(
  type: string,
  seat: VehicleSeat,
  seats: VehicleSeat[],
): { left: string; top: number } | undefined {
  if (type === "LIMOUSINE_10") {
    const x = (seat.row === 4 ? [47, 130, 213] : [47, 107, 213])[
      seat.column - 1
    ];
    if (x === undefined) return undefined;
    return {
      left: `${(x / 320) * 100}%`,
      top: [83, 147, 211, 279][seat.row - 1] ?? 83 + (seat.row - 1) * 64,
    };
  }
  if (type === "LIMOUSINE_24") {
    const columns = Math.max(
      ...seats.filter((s) => s.row === seat.row).map((s) => s.column),
    );
    const xs =
      seat.row === 8 && columns === 2
        ? [64, 272]
        : columns === 4
          ? [64, 116, 220, 272]
          : [64, 116, 272];
    const x = xs[seat.column - 1];
    if (x === undefined) return undefined;
    return { left: `${(x / 380) * 100}%`, top: 75 + (seat.row - 1) * 42 };
  }
  if (["LIMOUSINE_SLEEPER_22", "CABIN_24", "CABIN_21_22"].includes(type)) {
    return {
      left: `${((37 + (seat.column - 1) * 120) / 232.56) * 100}%`,
      top: 83 + (seat.row - 1) * 53,
    };
  }
  return undefined;
}

export function configuredSeats(
  type: string,
  current: VehicleSeat[],
  capacity: number,
): VehicleSeat[] {
  const seats: VehicleSeat[] = [];
  if (type === "LIMOUSINE_24") {
    for (let i = 0; i < 21 + capacity; i++)
      seats.push({
        code: String(i + 1).padStart(2, "0"),
        deck: 1,
        row: i < 21 ? Math.floor(i / 3) + 1 : 8,
        column: i < 21 ? (i % 3) + 1 : i - 20,
        type: "VIP",
        enabled: true,
      });
  } else if (type === "CABIN_21_22") {
    for (const deck of [1, 2]) {
      for (let i = 0; i < (deck === 1 ? capacity - 12 : 12); i++)
        seats.push({
          code: `${deck === 1 ? "D" : "T"}${String(i + 1).padStart(2, "0")}`,
          deck,
          row: Math.floor(i / 2) + 1,
          column: (i % 2) + 1,
          type: "SLEEPER",
          enabled: true,
        });
    }
  }
  return seats.map((seat) => ({
    ...seat,
    enabled: current.find((s) => s.code === seat.code)?.enabled ?? true,
  }));
}
