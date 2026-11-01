import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactElement } from "react";
import { z } from "zod";

import { liveApiJson as apiJson } from "@/shared/api/liveRequest";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { Button } from "@/shared/ui/Button/Button";

const ticketSchema = z.object({
  id: z.string(),
  passengerName: z.string(),
  seatCode: z.string(),
  status: z.string(),
  rowVersion: z.number(),
});
const validationSchema = z.object({
  valid: z.boolean(),
  reasonCode: z.string().nullable().optional(),
  ticket: ticketSchema.nullable().optional(),
});
type Ticket = z.infer<typeof ticketSchema>;

/** Two-step scan: POST /tickets/validate, then POST /tickets/{id}/check-in with the ticket version. */
export function LiveTicketCheckIn({ tripId }: { tripId: string }): ReactElement {
  const client = useQueryClient();
  const [token, setToken] = useState("");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const scanned = token.trim();

  const validate = useMutation({
    mutationFn: () =>
      apiJson("/api/v1/tickets/validate", validationSchema, {
        method: "POST",
        body: { tripId, scannedToken: scanned, expectedVersion: 0 },
      }),
    onSuccess: (result) => setTicket(result.valid ? (result.ticket ?? null) : null),
    retry: false,
  });
  const checkIn = useMutation({
    mutationFn: (target: Ticket) =>
      apiJson(
        `/api/v1/tickets/${encodeURIComponent(target.id)}/check-in`,
        ticketSchema.partial(),
        {
          method: "POST",
          idempotent: true,
          body: {
            tripId,
            scannedToken: scanned,
            expectedVersion: target.rowVersion,
          },
        },
      ),
    onSuccess: () => {
      setTicket(null);
      setToken("");
      void client.invalidateQueries({ queryKey: ["live-api"] });
    },
    retry: false,
  });

  const rejected = validate.isSuccess && !validate.data.valid;
  return (
    <section aria-label="Soát vé">
      <h2>Soát vé</h2>
      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          checkIn.reset();
          validate.mutate();
        }}
      >
        <label>
          Mã QR / mã vé
          <input
            required
            value={token}
            onChange={(event) => {
              setToken(event.target.value);
              setTicket(null);
            }}
          />
        </label>
        <Button isLoading={validate.isPending} type="submit">
          Kiểm tra vé
        </Button>
      </form>
      {rejected ? (
        <p role="alert">
          Vé không hợp lệ{validate.data.reasonCode ? `: ${validate.data.reasonCode}` : ""}.
        </p>
      ) : null}
      {ticket ? (
        <div>
          <p>
            {ticket.passengerName}, ghế {ticket.seatCode}, trạng thái{" "}
            {ticket.status}
          </p>
          <Button
            isLoading={checkIn.isPending}
            onClick={() => checkIn.mutate(ticket)}
            type="button"
          >
            Xác nhận lên xe
          </Button>
        </div>
      ) : null}
      {checkIn.isSuccess ? <p role="status">Đã soát vé thành công.</p> : null}
      {validate.isError ? <ApiFailure error={validate.error} /> : null}
      {checkIn.isError ? <ApiFailure error={checkIn.error} /> : null}
    </section>
  );
}
