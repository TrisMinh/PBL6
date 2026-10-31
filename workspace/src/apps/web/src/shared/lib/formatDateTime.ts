import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { z } from "zod";

type DateTimePattern =
  "HH:mm" | "dd/MM/yyyy" | "HH:mm dd/MM/yyyy" | "EEEE, dd MMMM yyyy";

const utcTimestampSchema = z.iso.datetime();
const vietnamCalendar = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  calendar: "gregory",
  numberingSystem: "latn",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

// A calendar-only adapter for date-fns: UTC getters preserve the Intl parts
// even when the host's local clock has a DST gap. Never use it as an instant.
class CalendarDate extends Date {
  override getFullYear(): number {
    return this.getUTCFullYear();
  }
  override getMonth(): number {
    return this.getUTCMonth();
  }
  override getDate(): number {
    return this.getUTCDate();
  }
  override getDay(): number {
    return this.getUTCDay();
  }
  override getHours(): number {
    return this.getUTCHours();
  }
  override getMinutes(): number {
    return this.getUTCMinutes();
  }
}

function toVietnamCalendarDate(value: string): CalendarDate {
  const parts = vietnamCalendar.formatToParts(new Date(value));
  const part = (name: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find(({ type }) => type === name)?.value);
  const date = new CalendarDate(0);
  date.setUTCFullYear(part("year"), part("month") - 1, part("day"));
  date.setUTCHours(part("hour"), part("minute"), part("second"), 0);
  return date;
}

export function formatDateTime(
  value: string,
  pattern: DateTimePattern = "HH:mm",
): string {
  if (!utcTimestampSchema.safeParse(value).success) return "—";
  return format(toVietnamCalendarDate(value), pattern, { locale: vi });
}
