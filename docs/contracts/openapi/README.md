# OpenAPI Contracts

- [`platform-mvp.openapi.yaml`](./platform-mvp.openapi.yaml) là contract HTTP active của MVP 2.0.
- Chỉ operation phục vụ requirement `MUST` được đưa vào spec active.
- Endpoint `SHOULD/COULD` chỉ được thêm bằng pull request có product decision đưa feature vào release.
- ASP.NET Core route/DTO phải pass conformance test với spec; React/React Native client được generate từ spec, không viết DTO thủ công.

## Quality gate

- OpenAPI 3.1 parse/lint thành công, `operationId` duy nhất và mọi `$ref` resolve.
- Protected operation có Bearer security và `x-permission`/ownership note phù hợp.
- Mutation có `Idempotency-Key`/`expectedVersion` khi contract yêu cầu.
- Mỗi success/error có schema; example parse được.
- Breaking-change diff chặn remove/rename/type/required-field change trong cùng major.

Redocly dùng [`../../../redocly.yaml`](../../../redocly.yaml). Rule bắt buộc explicit `4XX` được tắt có chủ đích vì mọi operation đã dùng `default` trỏ tới cùng `ErrorEnvelope`; không được bỏ `default` khỏi operation.
