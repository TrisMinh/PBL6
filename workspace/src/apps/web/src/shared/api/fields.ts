export type ApiRow = Record<string, unknown>;
export function field(row: ApiRow, path: string): string {
  let value: unknown = row;
  for (const part of path.split("."))
    value =
      typeof value === "object" && value !== null
        ? (value as ApiRow)[part]
        : undefined;
  return value === null || value === undefined
    ? "—"
    : Array.isArray(value)
      ? value.join(", ")
      : typeof value === "object"
        ? "—"
        : String(value);
}
