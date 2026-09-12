# AsyncAPI Catalog

- [`platform-mvp.asyncapi.yaml`](./platform-mvp.asyncapi.yaml) khóa exchange, routing key và message type active của MVP.
- Payload/schema nằm tại [`../schemas/platform-message.schema.json`](../schemas/platform-message.schema.json).
- Producer ghi Outbox cùng transaction; consumer validate schema/version, ghi Inbox cùng side effect rồi mới ACK.
- Message `SHOULD/COULD` như TicketChanged/Promotion/Review/Export không nằm trong active catalog.

CI phải parse AsyncAPI/JSON Schema, kiểm tra example, routing key/type/version và chạy compatibility diff trước merge.
