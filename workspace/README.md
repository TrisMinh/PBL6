# Development Workspace

Thư mục này chứa source code và cấu hình phục vụ build/test/runtime. Tài liệu nằm tại [`../docs/`](../docs/README.md); roadmap và tiến độ nằm tại [`../task-tracking/`](../task-tracking/README.md).

## Cấu trúc mục tiêu

```text
workspace/
├── BusTicketPlatform.sln
├── global.json
├── Directory.Build.props
├── Directory.Packages.props
├── package.json
├── package-lock.json
├── tsconfig.base.json
├── redocly.yaml
└── src/
    ├── apps/
    ├── gateway/
    ├── services/
    ├── building-blocks/
    ├── infra/
    └── tests/
```

Hiện `src/` chưa có source. Sprint 0 sẽ scaffold theo [repository structure](../docs/implementation/01-repository-structure.md) và [Sprint 0 checklist](../task-tracking/board/sprint-00-foundation.md).

Mọi lệnh build/npm/contract chạy với working directory là `workspace/`, trừ lệnh Git chạy ở repository root.
