# Architecture Decision Records

> Các ADR Accepted không sửa nội dung. Nếu đổi quyết định, thêm ADR mới và đánh dấu ADR cũ được supersede.

## Chỉ mục

| ID | Quyết định | Trạng thái | Ngày |
|---|---|---|---|
| ADR-001 | React + Vite + TypeScript cho frontend | Accepted | 2026-10-18 |
| ADR-002 | Feature-based SPA với React Router Framework Mode | Accepted | 2026-10-18 |
| ADR-003 | Mock-first bằng MSW và typed contract | Accepted | 2026-10-18 |
| ADR-004 | Tailwind cho utility, BEM cho CSS tùy chỉnh | Accepted | 2026-10-18 |
| ADR-005 | Phân chia state theo ownership | Accepted | 2026-10-18 |
| ADR-006 | Responsive toàn bộ Customer và Admin | Accepted | 2026-10-18 |
| ADR-007 | Một mock session opaque cho auth và account history | Accepted | 2026-10-21 |
| ADR-008 | Hủy vé atomic với dual authority và idempotent refund mock | Accepted | 2026-10-22 |
| ADR-009 | Admin mock dùng fixture bất biến và handler factory có auth trước dữ liệu | Accepted | 2026-10-22 |

## ADR-001: React + Vite + TypeScript

**Bối cảnh**: Thiết kế Figma đã hoàn thiện, cần triển khai frontend nhanh và có type safety.  
**Quyết định**: Dùng React, Vite, TypeScript strict và pnpm.  
**Hệ quả**: Dev/build đơn giản và phù hợp SPA; SEO cần prerender chủ động thay vì dựa vào SSR mặc định.

## ADR-002: Feature-based SPA với React Router Framework Mode

**Bối cảnh**: Ứng dụng có nhiều bước đặt vé và hai khu vực Customer/Admin.  
**Quyết định**: Tổ chức theo feature; dùng React Router Framework Mode với `ssr:false`, prerender route công khai ổn định và SPA fallback cho route động.  
**Hệ quả**: Route/data boundary rõ; phải cấu hình hosting fallback và metadata cẩn thận.

## ADR-003: Mock-first bằng MSW và typed contract

**Bối cảnh**: Toàn bộ luồng frontend phải chạy và kiểm thử được bằng dữ liệu mô phỏng.  
**Quyết định**: UI chỉ gọi typed service interface; MSW triển khai contract và scenario của frontend.  
**Hệ quả**: Màn hình chạy độc lập và tái lập được; fixture, schema và handler phải luôn đồng bộ.

## ADR-004: Tailwind và BEM

**Bối cảnh**: Dự án cần responsive nhanh nhưng người dùng yêu cầu giữ quy tắc BEM.  
**Quyết định**: Tailwind xử lý phần lớn utility/responsive; mọi CSS class tự viết phải theo `block__element--modifier`.  
**Hệ quả**: Giảm CSS rời rạc nhưng code review phải ngăn class tùy ý không theo BEM.

## ADR-005: Phân chia state theo ownership

**Bối cảnh**: Search, booking, auth và admin có vòng đời dữ liệu khác nhau.  
**Quyết định**: TanStack Query quản lý server/mock state; Zustand chỉ giữ booking draft liên màn hình; form state nằm trong React Hook Form; query string giữ filter có thể chia sẻ.  
**Hệ quả**: Tránh store toàn cục phình to; cần chuẩn hóa query key và hydration từ `sessionStorage`.

## ADR-006: Responsive Customer và Admin

**Bối cảnh**: Figma ưu tiên desktop nhưng người dùng có thể mở bằng điện thoại.  
**Quyết định**: Tất cả màn hình hỗ trợ 360, 768, 1024, 1440 và 1920; admin table có phương án card/scroll/column priority tùy ngữ cảnh.  
**Hệ quả**: Mobile web là biến thể responsive của desktop, không dùng màn hình native app trong Figma làm nguồn triển khai.

## ADR-007: Một mock session opaque cho auth và account history

**Bối cảnh**: Task10 cần login customer/một admin và FR-021 history trong khi backend chưa hoàn thiện; guest lookup Task9 đã có quyền riêng.
**Quyết định**: Mở rộng `blue-mock-session` hiện có bằng UUID token một giờ, map server mock tới fixture identity và cấp history/detail qua header. Client không lưu email/password; guest access và account access là hai authority độc lập. Intended redirect dùng canonical allowlist.
**Hệ quả**: Mock refresh trong cùng tab và ownership test được, không tạo auth store cạnh tranh; production vẫn phải thay bằng server auth/authorization/rate limit. History chỉ issued tới khi Task11 thêm lifecycle hủy/hoàn.

## ADR-008: Hủy vé atomic với dual authority và idempotent refund mock

**Bối cảnh**: Task11 cần hủy một phần theo Figma trong khi backend/refund VNPay chưa hoàn thiện; mã đơn hoặc mã vé không đủ làm bằng chứng truy cập.
**Quyết định**: GET/POST cancellation chỉ chấp nhận guest ticket-access scope hoặc customer session ownership. POST yêu cầu key, validate toàn bộ tập1..6 vé issued trước một mutation, chuyển selected sang cancelled và tạo một refund processing bằng100% selected fare. Refund/key archive giới hạn100 và strict cross-reference trong snapshot.
**Hệ quả**: Retry/refresh không tạo refund trùng, lỗi không gây partial state, detail/history phản ánh lifecycle nhất quán. Policy/processing chỉ là estimate mock; production phải thay authority, ledger, refund policy, idempotency storage và VNPay reconciliation phía server.

## ADR-009: Admin mock bất biến và handler factory có auth trước dữ liệu

**Bối cảnh**: Plan05 cần nhiều resource admin dùng chung list/detail và một số mutation trong khi backend chưa hoàn thiện; fixture không được biến thành dữ liệu khách hàng thật hoặc bị test trước sửa ngầm.
**Quyết định**: Dùng frozen fictional fixtures với cross-reference ổn định, clone thành state riêng của handler factory, filter trước pagination và clone payload trả về. Mọi route kiểm tra mock session còn hạn và role admin trước khi đọc dữ liệu hoặc áp scenario. Chỉ organization/staff có create/update strict; IDs/timestamps sinh qua provider injectable.
**Hệ quả**: Test có tính quyết định và không mutate seed; customer/missing session không quan sát resource. State mutation chỉ sống trong instance mock/tab và production phải thay bằng server authorization, persistence, audit log và concurrency control.
