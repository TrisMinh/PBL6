# Explore desktop — sửa giao diện tự dựng

Nguồn: Travel v3 OCkWSOZQ8Pq8AejXccajpO, trang Customer Desktop 7:5. Metadata hiện tại không có frame Explore riêng. Không tuyên bố trang mới là bản sao 1:1 của một frame Explore.

Bỏ hero chữ lớn tự dựng, notice mô phỏng chiếm diện tích và các thẻ thống kê kiểu dashboard. Tái sử dụng trực tiếp HomeHero, ProductTruths, PopularRoutes, SupportBanner, HomeFooter đã có trong source, đối chiếu design context và screenshot Home 128:870. Header không đè nội dung khi cuộn. Các khối nguồn giữ kích thước desktop: hero 1280 × 650 tại (80,96), truths 1280 × 96 tại (80,782), route card 308 × 240 tại (80,1026).

Tra cứu tỉnh/thành là phần mở rộng ngoài frame nguồn: giữ tìm kiếm không dấu/URL/reload, danh sách đón/trả và recovery. Thẻ điểm đến dùng bố cục thẻ ảnh có sẵn của Figma thay cho các ô thống kê. Không có tích hợp API thật mới.

Đối chiếu asset SHA256 tải trực tiếp từ URLs get_design_context với source hiện tại:
- hero-bus.png: trùng hoàn toàn.
- route-ho-chi-minh-da-lat.png: trùng hoàn toàn.
- route-ha-noi-sa-pa.png: trùng hoàn toàn.
- route-da-nang-hue.png: trùng hoàn toàn.
- route-nha-trang-da-lat.png: trùng hoàn toàn.

Bằng chứng ảnh: before.png, after.png (production tại 1440 × 1080, full page), figma-home.png (nguồn Figma, không dùng làm asset runtime). Kiểm tra: unit.log, desktop.log, build.log, lint.log, typecheck.log. Footer đặt ngoài main để giữ landmark contentinfo hợp lệ; test accessibility không bỏ rule.
