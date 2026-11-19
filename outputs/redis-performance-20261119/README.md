# So sánh hiệu năng Redis cho Transport

**Môi trường ngày 19/11/2026**. Docker Desktop local, AMD Ryzen 5 7500F, Docker được cấp 12 CPU logic và khoảng 7,6 GiB RAM. Trình tạo tải chạy Python 3.10 trên Windows. Hai cấu hình dùng cùng image Transport, cùng image Gateway YARP và cùng PostgreSQL local. Cấu hình Redis dùng một Redis 7 tách riêng cho phép đo. Các container thử nghiệm được gỡ sau khi chạy.

## Phương pháp

- Gửi GET qua Gateway tới hai API công khai là `/api/v1/trips` và `/api/v1/explore/routes`. Kiểm tra mẫu phản hồi của hai cấu hình có cùng dữ liệu, bỏ qua dấu thời gian do API tạo khi đọc.
- Gửi **25 request/giây**, tối đa **16 request đồng thời**. Mỗi lượt làm nóng 4 giây rồi đo 15 giây. Mỗi kịch bản chạy hai lượt trên mỗi cấu hình. Lượt thứ hai đảo thứ tự bật/tắt Redis.
- **Truy vấn lặp** dùng các tuyến và ngày có thật trong dữ liệu local, hai kích thước trang của danh sách chung và danh sách tuyến. **Truy vấn đa dạng** thay đổi tuyến, ngày, kích thước trang, số trang và sắp xếp. Các truy vấn đổi thứ tự giữa hai lượt và dùng đúng cùng một thứ tự cho hai cấu hình trong từng lượt.
- Độ trễ tính từ lúc gửi đến lúc đọc hết HTTP response. p50, p95 và p99 được tính từ các phản hồi HTTP 200. Tỷ lệ trúng cache lấy từ chênh lệch `keyspace_hits` của Redis riêng sau mỗi lượt.

## Kết quả

| Kịch bản | Cấu hình | p50 (ms) | p95 (ms) | p99 (ms) | Trúng cache | Lỗi / lượt đo |
|---|---|---:|---:|---:|---:|---:|
| Truy vấn lặp | PostgreSQL | 6,47 | 47,57 | 51,75 | — | 0 / 750 |
| Truy vấn lặp | Redis | 2,67 | 4,06 | 9,00 | 97,73% | 0 / 750 |
| Truy vấn đa dạng | PostgreSQL | 6,35 | 8,66 | 10,21 | — | 0 / 750 |
| Truy vấn đa dạng | Redis | 6,45 | 8,92 | 10,35 | 32,13% | 0 / 750 |

Tổng cộng **3.000/3.000** request trả HTTP 200, không có request nào bị bỏ tại trình tạo tải. Cả bốn cấu hình đạt đủ 25 request/giây theo mức tải đã đặt. Kho truy vấn có 9 URL cho kịch bản lặp và 721 URL cho kịch bản đa dạng.

Ở nhóm truy vấn lặp, p95 giảm **91,5%**. Ở nhóm truy vấn đa dạng, p95 tăng **0,26 ms** (3,0%). Redis mang lại lợi ích rõ khi các truy vấn trùng nhau đủ thường xuyên trong thời hạn cache. Phép đo này mô tả độ trễ API ở một mức tải local. Nó chưa đo công suất tối đa hay thời gian tải toàn trang. Trình tạo tải Windows bắt đầu request trễ khoảng 13–15 ms ở p95 so với lịch phát, tương đương giữa hai cấu hình. Phần trễ phát tải được ghi riêng trong JSON.

## Chạy lại

```powershell
python workspace/scripts/benchmark-redis.py --rate 25 --seconds 15 --output outputs/redis-performance-20261119/results.json
```

Chạy từ gốc repository khi Gateway và Transport local đã hoạt động. Script dùng sẵn image đang chạy và tạo các cổng loopback riêng cho phép đo. Windows cần có bộ dữ liệu múi giờ IANA cho Python.

[Kết quả JSON từng lượt](results.json)
