# Khám phá tỉnh thành và điểm đón, trả

## Phạm vi và nguồn thiết kế

TASK-014 được người dùng duyệt ngày 2026-10-29: tách Khám phá khỏi kết quả tìm chuyến, thêm danh mục tỉnh/thành và chi tiết điểm đón/trả. **Không có canonical Figma frame cho hai trang này.** Đây là giao diện mới theo official BLUE logo, header/footer, Bricolage Grotesque, Be Vietnam Pro và semantic tokens hiện hữu; không tuyên bố pixel-match Figma.

Hướng thiết kế là danh mục hành trình sáng, thoáng và dễ tra cứu: tiêu đề lớn, card tỉnh/thành có số điểm, hai vùng đón/trả tách rõ. Không có ảnh trang trí hoặc bản đồ không có dữ liệu. MapPin/ArrowRight lấy từ Phosphor leaf imports hiện hữu; official logo dùng `BrandLogo` dùng chung.

## Route và navigation

| URL | Route module | Nội dung |
| --- | --- | --- |
| `/explore` | `src/routes/explore/index.tsx` | Danh mục tỉnh/thành, tìm theo tên hoặc vùng |
| `/explore?q=lam+dong` | cùng route | Search URL-owned, không dấu cũng tìm được Lâm Đồng |
| `/explore/:provinceSlug` | `src/routes/explore/detail.tsx` | Tỉnh/thành, nhà xe, điểm đón và điểm trả |

Header `src/shared/layouts/CustomerLayout.tsx` có Trang chủ `/` exact, Khám phá `/explore` và descendants, Điểm đến `/trips` exact, Vé xe `/tickets/lookup` exact. Query string không quyết định active nav. `/trips?view=destinations` vẫn chỉ active Điểm đến. Drawer dùng cùng danh sách route, đóng sau navigation và Escape giữ focus return.

Search submit đưa `q` tối đa100 ký tự vào query string bằng `URLSearchParams`, giữ key ngoài ownership. Bộ lọc local trên response đã validate; chuẩn hóa dấu và chữ hoa/thường, không đổi fixture/cache. Card là một link semantic lớn; breadcrumb “Tất cả tỉnh, thành” về `/explore`. Browser back/forward giữ URL trước đó. Unknown slug có recovery về danh mục, không retry404.

## Mapping source → component → CSS

| Source | Trách nhiệm | CSS/BEM |
| --- | --- | --- |
| `src/features/explore/ExplorePages.tsx` — `ExplorePage` | Hook danh mục, introduction, notice, loading/error/catalog | `explore`, `explore__intro`, `explore__eyebrow`, `explore__notice` |
| `ProvinceCatalog`, `ProvinceCard` | Search, số kết quả, tỉnh/thành và counts, empty/reset | `explore__search`, `explore__province-grid`, `explore__province-card`, `explore__card-counts`, `explore__card-action`, `explore__state` |
| `ProvincePage`, `ProvinceLocations`, `PointCard` | Breadcrumb, chi tiết, hai vùng đón/trả, địa chỉ/nhà xe | `explore__breadcrumb`, `explore__province-intro`, `explore__locations-grid`, `explore__location-section`, `explore__point-card`, `explore__address`, `explore__operators` |
| `src/features/explore/ExplorePages.css` | Layout, spacing, typography, responsive, focus/reduced-motion | Chỉ dùng semantic color/font/radius/shadow hiện hữu, không thêm primitive màu |
| `src/features/explore/useExplore.ts` | TanStack Query, request AbortSignal | Keys `explore/provinces` và `explore/province/slug`; không Zustand |
| `src/features/explore/exploreRepository.ts` | HTTP + runtime validation + lỗi typed/safe | UI không fetch hoặc import fixture |
| `src/features/explore/explore.schema.ts` | Strict response schemas và coordinate/count/reference integrity | Types derive từ schema |
| `src/mocks/fixtures/explore.ts` | Bốn province fixtures,12 physical point records | Chỉ mock layer đọc fixture |
| `src/mocks/handlers/exploreHandlers.ts` | Hai GET endpoints và dev/test scenarios | Đăng ký qua `src/mocks/handlers.ts` |

## Tọa độ layout và responsive

Các số dưới là tọa độ CSS layout trong viewport, **không phải latitude/longitude địa lý**. Đơn vịpx; chiều cao nội dung tự tăng theo copy/font.

| Vùng | Desktop1440 | Mobile360 |
| --- | --- | --- |
| Shared header | width1280, x80, y18; giữ shell hiện hữu | width328, x16; drawer dưới768 |
| Nội dung Explore | max-width1120, x160; page padding top40 sau main inset24 | width328, x16; page padding top24 sau main inset24 |
| H1 danh mục | clamp32..52, line-height1.15, max intro800 |32px, tự wrap; explicit break chia hai vế |
| H1 tỉnh/thành |48px, line-height1.2 |36px |
| Danh mục |2 cột, gap24; mỗi card548px ở1440 |1 cột, gap20; card328px |
| Card tỉnh/thành |padding28, radius16; counts3 cột |padding24; counts vẫn3 cột có minmax0 |
| Search |max-width680; input/button cùng hàng, gap12; input>=48 |input/button xếp dọc dưới420, button full width |
| Điểm đón / Điểm trả |2 cột544px, gap32; đón bên trái, trả bên phải |1 cột; toàn bộ điểm đón trước điểm trả, gap20 |
| Point card |padding24, icon24 + gap16 + text min-width0 |padding20; địa chỉ/nhà xe wrap tự nhiên |

768/1024/1920 dùng cùng max-width/grid co giãn, không fixed page height hoặc absolute positioning. Media query768 chuyển grid hai cột thành một. Link card/breadcrumb/Button giữ target>=44px; search48px; focus-visible3px; reduced-motion bỏ card transition. Header/footer là shell hiện hữu, không clone logo hoặc dựng shell riêng.

## Dữ liệu điểm và provenance địa lý

| Field | Nguồn/quy tắc |
| --- | --- |
| Province slug/name/region | Các nhãn địa lý quen thuộc chỉ làm bối cảnh mô phỏng; không tuyên bố danh mục hành chính đầy đủ hoặc coverage thật |
| `operators` | Reuse fictional operators BLUE Express/Sao Mai từ mock operator fixture; relation phục vụ được tạo cho demo |
| Point `name`, `address` | Tên điểm và địa chỉ cấp khu vực được tác giả fixture đặt để mô phỏng; không có số nhà/địa chỉ bưu chính được xác minh |
| `services` | `pickup`, `dropoff` hoặc cả hai; cùng một physical point có thể xuất hiện trong cả hai vùng |
| `operatorIds` | Phải thuộc `province.operators`; strict schema kiểm tra reference |
| `latitude`, `longitude`, `coordinateSource` | **Tất cả hiện là `null`**, vì chưa có nguồn tọa độ xác minh. Schema chỉ cho cả ba null hoặc đủ cặp tọa độ + source URL; không suy diễn/geocode ngầm |
| Counts | `pickupCount`/`dropoffCount` tính từ services; `operatorCount` bằng số operator; schema reject sai count/duplicate point/reference |
| `isMock` | Literal `true`, response bắt buộc; notice “Dữ liệu mô phỏng” luôn nhìn thấy trên success pages |

UI không vẽ marker trên bản đồ, không tạo directions link, không khẳng định các điểm là bến/văn phòng hoạt động thật. Địa chỉ card có nhãn “Địa chỉ khu vực mô phỏng”; detail nêu “Chưa có tọa độ được xác minh”. Khi có nguồn thật trong tương lai, cần cập nhật fixture/provenance/schema/repository/docs đồng bộ trước khi thêm chức năng chỉ đường.

## States và verification

Loading dùng `role=status`; danh mục rỗng khác search không khớp; search có Xóa tìm kiếm. Network/503/invalid response có thông báo tĩnh và Thử lại;404/invalid slug terminal có Về Khám phá. Raw response/error/slug không được echo thành thông báo lỗi.

`ExplorePages.test.tsx` kiểm tra search không dấu, reset, tách đón/trả, operator/provenance, loading/error/retry/empty/404 qua MSW boundary. `exploreRepository.test.ts` kiểm tra count/reference/coordinate integrity, malformed payload/JSON, wrong resource, abort và safe errors. CustomerLayout test khóa một active nav cho năm route states; route tests khóa public metadata và thin modules.

`tests/e2e/explore.spec.ts` cùng POM kiểm tra15executions tại360/768/1024/1440/1920: tìm tỉnh→keyboard card→detail→breadcrumb→deep link/reload; năm route nav ownership; pending/error/retry/empty/404. Axe quét không exclude rule, document không overflow. Evidence list/detail và bốn state tại360/1440 lưu ở `docs/quality/evidence/explore/`; đây là screenshot implementation để review, không baseline Figma.

## Gate của Worker ngày 2026-10-29

Worker đã inspect trực tiếp 12 ảnh danh mục, chi tiết Lâm Đồng, loading, error, empty và404 tại360/1440: nội dung có nhãn mô phỏng, official BLUE logo, hierarchy card và hai vùng đón/trả đọc được; không có ảnh trắng hoặc clipping. Matrix browser chạy đủ5width, không dùng claim Figma fidelity. Scoped format, lint, typecheck và focused64tests đạt. Static verifier đã mở rộng `/explore` và `/explore/lam-dong`, cùng ba route cũ: HTTP200, tải SPA fallback và đúng heading; build/prerender2/2 và verifier contracts5/5 đạt.

Production vẫn giữ chính sách MSW chỉ khởi động development hiện hữu: static deep-link gate chứng minh app/route tải đúng, không tuyên bố API production hoặc dữ liệu nhà xe thật đã tồn tại. Kết quả coverage/browser cuối và giới hạn formatter của Task9 được ghi trong báo cáo Worker `.superpowers/explore-report.md`. TASK-014 giữ `in_progress`, chờ Supervisor nghiệm thu độc lập.