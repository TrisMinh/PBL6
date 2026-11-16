export function normalizeVietnamPhone(value: string): string {
  const input = value.trim();
  return /^0[35789]\d{8}$/.test(input) ? `+84${input.slice(1)}` : input;
}
