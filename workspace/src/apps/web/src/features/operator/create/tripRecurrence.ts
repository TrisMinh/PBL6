import { addMonths, format, isValid, parseISO } from "date-fns";

export interface Recurrence {
  enabled: boolean;
  endDate: string;
  days: number[];
}

export function recurrenceEndLimit(start: string): string {
  const date = parseISO(start);
  return isValid(date) ? format(addMonths(date, 3), "yyyy-MM-dd") : "";
}

export function recurringDates(start: string, recurrence: Recurrence): string[] {
  if (!start || !recurrence.endDate || recurrence.endDate < start) return [];
  const date = new Date(start + "T00:00:00Z");
  const end = new Date(recurrence.endDate + "T00:00:00Z");
  if (
    !Number.isFinite(date.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    recurrence.endDate > recurrenceEndLimit(start)
  )
    return [];
  const dates: string[] = [];
  while (date <= end) {
    if (recurrence.days.includes(date.getUTCDay()))
      dates.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return dates;
}
