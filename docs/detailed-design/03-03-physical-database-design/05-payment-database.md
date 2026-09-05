# 3.3.5 Payment Database

Logical DB/schema: `payment_db`; ERD: [Payment](../../system-design/02-07-database-erd/04-payment-db.md).

## Tables và invariant

| Table | Unique/check chính | Lifecycle |
|---|---|---|
| `payments` | logical idempotency, positive amount/currency | state machine Payment |
| `payment_attempts` | `(provider,provider_transaction_id)` khi có | immutable attempt outcome |
| `webhook_receipts` | `(provider,external_event_id)` | received → verified/processed/rejected |
| `refunds` | logical reference/idempotency | Refund state machine |
| `reconciliation_cases` | open case uniqueness theo discrepancy policy | open → resolved |

## Provider dedupe

```sql
create unique index uq_payment_provider_transaction
  on payment_attempts (provider, provider_transaction_id)
  where provider_transaction_id is not null;

alter table webhook_receipts
  add constraint uq_webhook_provider_event unique (provider, external_event_id);

create unique index uq_refund_logical_reference
  on refunds (payment_id, refund_reference);
```

Duplicate webhook transaction:

1. Insert receipt by provider/event ID hoặc load existing.
2. Lock Payment; verify event belongs expected intent/provider reference.
3. Apply transition only when source state permits and amount/currency match.
4. Insert Outbox outcome only for first logical transition.
5. Commit rồi trả provider acknowledgement.

## Refund cap

Payment row được `FOR UPDATE` khi accept Refund. Tính tổng refund `SUCCEEDED/PROCESSING` theo policy và reject request vượt remaining amount. Guard phải tính lại trong transaction, không dựa cache/report projection.

Money/currency check:

```sql
alter table payments add constraint ck_payment_amount check (amount > 0);
alter table refunds add constraint ck_refund_amount check (amount > 0);
alter table payments add constraint ck_payment_currency check (currency ~ '^[A-Z]{3}$');
```

## Index baseline

- `payments(booking_id_external,created_at desc)`.
- `payments(status,updated_at)` cho timeout/reconciliation worker.
- `payment_attempts(payment_id,created_at desc)`.
- `webhook_receipts(provider,received_at desc)` và rejected/security investigation.
- `refunds(payment_id,status,updated_at)` và `refunds(booking_id_external,created_at desc)`.
- `reconciliation_cases(status,opened_at)`.

Không lưu PAN/CVV. Raw payload chỉ lưu nếu provider/đối soát bắt buộc và đã mã hóa/retention/field redaction được phê duyệt; baseline ưu tiên payload hash + metadata allow-list.

