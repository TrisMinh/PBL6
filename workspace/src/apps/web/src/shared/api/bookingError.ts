import { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import { ApiError } from "./error";

export async function bookingAction<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof BookingRepositoryError) throw error;
    if (error instanceof ApiError) {
      const code =
        error.code.includes("HOLD") ||
        error.code.includes("EXPIRED") ||
        error.status === 410
          ? "HOLD_EXPIRED"
          : error.code.includes("SEAT")
            ? "SEAT_CONFLICT"
            : error.status === 401
              ? "ACCESS_REQUIRED"
              : error.code === "ABORTED"
                ? "ABORTED"
                : error.code === "NETWORK_ERROR"
                  ? "NETWORK_ERROR"
                  : error.status === 400
                    ? "VALIDATION_ERROR"
                    : "HTTP_ERROR";
      const mapped = new BookingRepositoryError(code, error.status);
      mapped.message = error.message;
      throw mapped;
    }
    throw error;
  }
}
