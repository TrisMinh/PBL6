import { z } from "zod";

export const bookingPassengerCountSchema = z.number().int().min(1).max(6);
