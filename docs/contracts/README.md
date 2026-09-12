# Executable Contracts — MVP 2.0

Đây là contract machine-readable dùng để khóa biên triển khai C# ASP.NET Core, React và React Native:

- [OpenAPI HTTP contract](./openapi/platform-mvp.openapi.yaml): 74 operation active, chỉ scope `MUST`.
- [AsyncAPI message catalog](./asyncapi/platform-mvp.asyncapi.yaml): 20 channel/message active.
- [JSON Schema envelope/payload](./schemas/platform-message.schema.json): schema runtime cho message v1.

Detailed Design giải thích semantics; các file trong thư mục này quyết định tên route, field và message dùng để generate/validate code. Nếu hai nguồn khác nhau, sửa cả thiết kế lẫn executable contract trong cùng pull request và chứng minh requirement ID bị ảnh hưởng.

## Gate trước khi code

- OpenAPI/AsyncAPI/YAML và JSON Schema parse được; toàn bộ `$ref` nội bộ resolve.
- `operationId` duy nhất; route P1 không xuất hiện.
- Event type, routing key và schema khớp 1:1.
- ASP.NET API conformance test, generated TypeScript client và consumer schema test chạy trong CI.
