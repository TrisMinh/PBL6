const PRODUCT_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  calendar: "gregory",
  numberingSystem: "latn",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getVietnamTodayDate(): string {
  const parts = Object.fromEntries(
    PRODUCT_DATE_FORMAT.formatToParts(new Date()).map(({ type, value }) => [
      type,
      value,
    ]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
