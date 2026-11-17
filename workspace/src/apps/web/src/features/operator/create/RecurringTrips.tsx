import { addMonths, format, isValid, parseISO } from "date-fns";
import { OperatorStatusBadge } from "../components/OperatorStatusBadge";
import { useState } from "react";
import { Link } from "react-router";
import { z } from "zod";
import { getLiveRows, liveApiJson } from "@/shared/api/liveRequest";
import { ApiError } from "@/shared/api/error";
import { Button } from "@/shared/ui/Button/Button";
import { DatePicker } from "@/shared/ui/DatePicker/DatePicker";
import { displayDate, tripSchema, type Trip } from "../tripWorkflow";

export const weekdays = [
  { day: 1, label: "T2" },
  { day: 2, label: "T3" },
  { day: 3, label: "T4" },
  { day: 4, label: "T5" },
  { day: 5, label: "T6" },
  { day: 6, label: "T7" },
  { day: 0, label: "CN" },
];
export interface Recurrence {
  enabled: boolean;
  endDate: string;
  days: number[];
}
export function recurrenceEndLimit(start: string): string {
  const date = parseISO(start);
  return isValid(date) ? format(addMonths(date, 3), "yyyy-MM-dd") : "";
}
export function recurringDates(
  start: string,
  recurrence: Recurrence,
): string[] {
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
export function RecurrenceFields({
  start,
  value,
  onChange,
}: {
  start: string;
  value: Recurrence;
  onChange: (value: Recurrence) => void;
}) {
  const dates = recurringDates(start, value);
  return (
    <div className="operator-recurrence">
      <label className="operator-recurrence__toggle">
        <span>Chạy lặp lại</span>
        <input
          type="checkbox"
          role="switch"
          checked={value.enabled}
          onChange={(event) =>
            onChange({ ...value, enabled: event.target.checked })
          }
        />
      </label>
      {value.enabled && (
        <>
          <div className="operator-recurrence__settings">
            <label className="field">
              <span className="field__label">Ngày kết thúc</span>
              <DatePicker
                aria-label="Ngày kết thúc lịch lặp"
                value={value.endDate}
                min={start || undefined}
                max={recurrenceEndLimit(start) || undefined}
                showYearPicker
                onChange={(event) =>
                  onChange({ ...value, endDate: event.target.value })
                }
              />
            </label>
            <div
              className="operator-recurrence__days"
              role="group"
              aria-label="Ngày chạy trong tuần"
            >
              <div className="operator-recurrence__days-heading">
                <span>Ngày chạy trong tuần</span>
                <button
                  type="button"
                  aria-pressed={value.days.length === 7}
                  onClick={() =>
                    onChange({
                      ...value,
                      days:
                        value.days.length === 7 ? [] : [0, 1, 2, 3, 4, 5, 6],
                    })
                  }
                >
                  Hằng ngày
                </button>
              </div>
              <div className="operator-recurrence__weekdays">
                {weekdays.map(({ day, label }) => (
                  <button
                    type="button"
                    key={day}
                    aria-label={day === 0 ? "Chủ nhật" : `Thứ ${day + 1}`}
                    aria-pressed={value.days.includes(day)}
                    onClick={() =>
                      onChange({
                        ...value,
                        days: value.days.includes(day)
                          ? value.days.filter((item) => item !== day)
                          : [...value.days, day],
                      })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p role="status">
            {dates.length ? (
              <>
                <strong>{dates.length} chuyến</strong>
                <span>Cùng giờ xuất phát và thời lượng.</span>
              </>
            ) : (
              "Chọn ngày kết thúc và ngày chạy · Tối đa 3 tháng mỗi đợt."
            )}
          </p>
        </>
      )}
    </div>
  );
}
export function RecurringTripResults({
  trips,
  onPublished,
}: {
  trips: Trip[];
  onPublished: () => void;
}) {
  const [states, setStates] = useState<
    Record<string, { published?: boolean; error?: string }>
  >({});
  const [busy, setBusy] = useState(false);
  async function publish() {
    if (busy) return;
    setBusy(true);
    try {
      const currentTrips = await getLiveRows("/api/v1/operator/trips");
      for (const trip of trips) {
        if (states[trip.id]?.published) continue;
        try {
          const found = currentTrips.find((item) => item.id === trip.id);
          if (!found)
            throw Error("Không tìm thấy chuyến trong nhà xe của bạn.");
          const current = tripSchema.parse(found);
          if (current.status === "DRAFT")
            await liveApiJson(
              `/api/v1/operator/trips/${trip.id}/publish`,
              z.unknown(),
              {
                method: "POST",
                idempotent: true,
                body: { expectedVersion: current.rowVersion },
              },
            );
          else if (!["SCHEDULED", "BOARDING"].includes(current.status))
            throw Error("Chuyến đã đổi trạng thái. Mở chi tiết để kiểm tra.");
          setStates((previous) => ({
            ...previous,
            [trip.id]: { published: true },
          }));
        } catch (error) {
          setStates((previous) => ({
            ...previous,
            [trip.id]: {
              error:
                error instanceof ApiError && error.code === "SCHEDULE_CONFLICT"
                  ? "Xe hoặc tài xế trùng lịch ngày này. Mở chi tiết để đổi phân công."
                  : error instanceof Error
                    ? error.message
                    : "Không phát hành được chuyến.",
            },
          }));
        }
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Không tải được lịch chuyến. Vui lòng thử lại.";
      setStates((previous) =>
        Object.fromEntries(
          trips.map((trip) => [
            trip.id,
            previous[trip.id]?.published
              ? previous[trip.id]
              : { error: message },
          ]),
        ),
      );
    } finally {
      setBusy(false);
      onPublished();
    }
  }
  const published = Object.values(states).filter(
    (state) => state.published,
  ).length;
  return (
    <section
      className="operator-create__panel operator-recurrence-results"
      aria-label="Kết quả tạo lịch lặp"
    >
      <h2>Đã tạo {trips.length} chuyến</h2>
      <p>
        <strong>
          {trips[0]?.origin} → {trips[0]?.destination}
        </strong>
      </p>
      <p role="status">
        {published}/{trips.length} chuyến đã phát hành. Mỗi chuyến có xe, tài xế
        và danh sách hành khách riêng.
      </p>
      <div className="operator-recurrence-results__list">
        {trips.map((trip) => (
          <div key={trip.id}>
            <div>
              <strong>{displayDate(trip.departureAt)}</strong>
              <small>Đến {displayDate(trip.arrivalAt)}</small>
            </div>
            <span
              className="operator-recurrence-results__state"
              data-error={!!states[trip.id]?.error}
            >
              {states[trip.id]?.error ? (
                states[trip.id].error
              ) : (
                <OperatorStatusBadge
                  state={states[trip.id]?.published ? "scheduled" : "draft"}
                >
                  {states[trip.id]?.published ? "Đã phát hành" : "Bản nháp"}
                </OperatorStatusBadge>
              )}
            </span>
            <Link to={`/operator/trips/review?tripId=${trip.id}`}>
              Chi tiết
            </Link>
          </div>
        ))}
      </div>
      <footer>
        <Link to="/operator/trips">Về lịch chuyến</Link>
        {published < trips.length && (
          <Button type="button" onClick={() => void publish()} isLoading={busy}>
            {published || Object.keys(states).length
              ? "Thử phát hành các chuyến còn lại"
              : "Phát hành các chuyến"}
          </Button>
        )}
      </footer>
    </section>
  );
}
