import type { z } from "zod";

import type {
  cancellationKeyRecordSchema,
  cancellationOptionsSchema,
  cancellationRequestSchema,
  refundSchema,
} from "@/features/cancellation/schemas/cancellation.schema";

export type CancellationRequest = z.infer<typeof cancellationRequestSchema>;
export type CancellationOptions = z.infer<typeof cancellationOptionsSchema>;
export type Refund = z.infer<typeof refundSchema>;
export type CancellationKeyRecord = z.infer<typeof cancellationKeyRecordSchema>;
