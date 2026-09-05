# 3.5.5 RabbitMQ Retry, DLQ và Replay

## Consumer classification

| Failure | Class | Action |
|---|---|---|
| DB/network temporary, provider 429/5xx | Transient | Retry tier with backoff |
| Unsupported schema/version, malformed required payload | Permanent | DLQ immediately |
| Business duplicate/old version | Success no-op | Commit Inbox/ACK |
| Aggregate version gap | Transient/park | Retry then reconcile owner |
| Invariant impossible after current authoritative state | Permanent/manual | DLQ/manual case + alert |

## Baseline tiers

`5s → 30s → 5m`, maximum attempts configuration per handler. Immediate requeue loop bị cấm. Retry queue TTL dead-letter trực tiếp về đúng primary queue, không fan-out lại exchange events.

Republish flow:

1. Publish persistent copy to retry/DLX with original message ID/body and safe failure headers.
2. Wait publisher confirm/mandatory routing success.
3. ACK original only after confirmed copy.
4. If republish fails, do not ACK original.

## DLQ metadata

Message ID/type/version, original queue, consumer, correlation ID, first/last failure time, retry count và safe final error code. Payload permission/retention bằng dữ liệu nghiệp vụ tương ứng.

## Replay runbook

- Permission `platform.dlq.replay`; identify/fix root cause and validate compatible consumer deployed.
- Record ticket/reason/operator/time/message IDs; snapshot DLQ metrics.
- Replay small canary batch through primary path; Inbox dedupe remains active.
- Monitor failure/lag/state convergence; stop on repeated permanent error.
- Không edit payload in place. Correction tạo message mới có new ID và metadata link original.

Alert theo oldest message age/backlog trend/DLQ rate, không chỉ queue length.

