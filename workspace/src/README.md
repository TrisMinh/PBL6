# Application source

- `apps/`: Customer Web (`:5173`), Operator Web (`:5174`), Admin Web (`:5175`) and the mobile app use Gateway `:5080`.
- [Docker setup and local accounts](../README.md)
- `packages/`: shared UI tokens and Gateway API client.
- `gateway/`: YARP edge for `/api/v1` and payment webhooks.
- `services/`: Identity, Transport, Booking, Payment, Notification, Reporting.
- `building-blocks/`: Result, error envelope, JWT, outbox/inbox Rabbit consumers.
- `tests/`: architecture, contract, service integration, messaging bus.
- [Local PostgreSQL backup and restore](data-backup/README.md)
