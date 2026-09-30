# Application source

- `apps/`: Customer Web (`:5173`) and Back-office (`:5174`) talk to Gateway `:5080`.
- `packages/`: shared UI tokens and Gateway API client.
- `gateway/`: YARP edge for `/api/v1` and payment webhooks.
- `services/`: Identity, Transport, Booking, Payment, Notification, Reporting.
- `building-blocks/`: Result, error envelope, JWT, outbox/inbox Rabbit consumers.
- `tests/`: architecture, contract, service integration, messaging bus.
