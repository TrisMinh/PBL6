# 02 — Khởi tạo workspace

Chương này tạo khung dùng chung. Chưa viết nghiệp vụ.

## 1. Tạo thư mục và solution

Từ root `PBL6`:

```powershell
New-Item -ItemType Directory -Force workspace, workspace/src, workspace/scripts
Set-Location workspace
dotnet new sln -n BusTicketPlatform
```

File cần có sau bước này:

```text
workspace/
├─ BusTicketPlatform.sln
├─ global.json
├─ Directory.Build.props
├─ Directory.Packages.props
├─ package.json
├─ redocly.yaml
├─ README.md
├─ scripts/
└─ src/
```

## 2. Khóa .NET SDK

Tạo `workspace/global.json`:

```json
{
  "sdk": {
    "rollForward": "latestPatch",
    "version": "10.0.401"
  }
}
```

Kiểm tra:

```powershell
dotnet --version
```

## 3. Cấu hình build chung

Tạo `workspace/Directory.Build.props`. File này tự áp dụng cho mọi `.csproj` bên dưới:

```xml
<Project>
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <LangVersion>latest</LangVersion>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <AnalysisLevel>latest</AnalysisLevel>
    <EnableNETAnalyzers>true</EnableNETAnalyzers>
    <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
    <Deterministic>true</Deterministic>
    <NeutralLanguage>en</NeutralLanguage>
    <CentralPackageTransitivePinningEnabled>true</CentralPackageTransitivePinningEnabled>
  </PropertyGroup>
  <PropertyGroup Condition="'$(IsTestProject)' == 'true'">
    <IsPackable>false</IsPackable>
  </PropertyGroup>
</Project>
```

Ý nghĩa quan trọng:

- không lặp `TargetFramework` ở mọi project;
- nullable và analyzer bắt lỗi sớm;
- warning trở thành lỗi build;
- version package chỉ được khai báo ở một nơi.

## 4. Tạo danh mục package trung tâm

Tạo `workspace/Directory.Packages.props` theo [phụ lục thư viện](./PHU-LUC-A-THU-VIEN.md). Trong `.csproj`, chỉ ghi:

```xml
<PackageReference Include="Npgsql" />
```

Không ghi `Version` trong từng `.csproj`.

## 5. Tạo npm workspace

Tạo `workspace/package.json`:

```json
{
  "name": "busticket-platform",
  "private": true,
  "workspaces": ["src/apps/*", "src/packages/*"],
  "scripts": {
    "dev:customer": "npm run dev -w @busticket/customer-web",
    "dev:backoffice": "npm run dev -w @busticket/backoffice-web",
    "build:web": "npm run build -w @busticket/customer-web && npm run build -w @busticket/backoffice-web",
    "dev:host": "powershell -File scripts/dev-host.ps1",
    "dev:docker": "powershell -File scripts/dev-docker.ps1"
  }
}
```

`private: true` ngăn publish nhầm package gốc. `workspaces` cho phép app dùng package local `@busticket/*` mà không phải publish npm.

## 6. Chuẩn bị cấu trúc source

```powershell
New-Item -ItemType Directory -Force `
  src/apps, `
  src/building-blocks, `
  src/gateway, `
  src/infra, `
  src/packages, `
  src/services, `
  src/tests
```

Tạo `workspace/src/README.md` mô tả trách nhiệm từng thư mục. Không đặt code production trực tiếp trong `src`; luôn đặt trong project con.

## 7. Nguyên tắc thêm project

Mỗi lần tạo project:

```powershell
dotnet new classlib -n Ten.Project -o path/to/Ten.Project
dotnet sln BusTicketPlatform.sln add path/to/Ten.Project/Ten.Project.csproj
```

API dùng:

```powershell
dotnet new web -n Ten.Project.Api -o path/to/Ten.Project.Api
```

Test dùng:

```powershell
dotnet new xunit -n Ten.Project.Tests -o path/to/Ten.Project.Tests
```

Sau scaffold, xóa `Class1.cs`, `UnitTest1.cs`, `WeatherForecast.cs` và controller mẫu nếu không dùng.

## Checkpoint 02

```powershell
dotnet sln BusTicketPlatform.sln list
dotnet restore
dotnet build
```

Ở thời điểm chưa có project, solution có thể trống nhưng ba lệnh phải không báo cấu hình sai.
