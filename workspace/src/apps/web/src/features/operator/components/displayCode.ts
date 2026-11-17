/** Display label only. API requests and detail records always retain the original identifier. */
export function displayCode(value: string, prefix = "CX"): string {
  return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)
    ? `${prefix}-${value.slice(-8).toUpperCase()}`
    : value;
}
