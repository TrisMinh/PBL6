import { Toast } from "@/shared/ui/Toast/Toast";
import { apiJson } from "@/shared/api/client";
import { isMockApi } from "@/shared/api/config";
import { z } from "zod";
import { useState, type FormEvent, type ReactElement } from "react";
import { Link, useLocation } from "react-router";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";
import "./InformationPage.css";

const documents: Record<
  string,
  {
    title: string;
    intro: string;
    sections: readonly (readonly [
      title: string,
      copy: string,
      anchor?: string,
    ])[];
  }
> = {
  "/terms": {
    title: "Điều khoản dịch vụ",
    intro: "Thông tin để bạn chủ động trước, trong và sau mỗi hành trình.",
    sections: [
      [
        "Đặt vé và giữ chỗ",
        "Kiểm tra tuyến, ngày đi, điểm đón/trả và thông tin hành khách trước khi xác nhận. Thời hạn giữ chỗ được hiển thị trong quá trình đặt vé; hết thời hạn, bạn cần chọn lại ghế.",
      ],
      [
        "Thanh toán và vé",
        isMockApi
          ? "Giá và tổng tiền được trình bày trước bước thanh toán. Trong bản trải nghiệm này, thanh toán và vé là dữ liệu mô phỏng, không thu tiền thật."
          : "Kiểm tra tổng tiền trước khi thanh toán qua SePay. Vé được phát hành sau khi hệ thống xác nhận giao dịch.",
      ],
      [
        "Thay đổi và hủy vé",
        "Mức phí và số tiền dự kiến hoàn được hiển thị trước khi bạn xác nhận hủy. Hủy vé và hoàn tiền là hai trạng thái riêng; bạn có thể theo dõi tiến trình trong tài khoản.",
      ],
      [
        "Trách nhiệm hành khách",
        "Cung cấp thông tin chính xác, có mặt tại điểm đón theo hướng dẫn của nhà xe và bảo quản mã vé. Không chia sẻ mã xác minh hoặc thông tin đăng nhập.",
      ],
    ],
  },
  "/privacy": {
    title: "Chính sách bảo mật",
    intro: "Minh bạch về thông tin bạn dùng trong trải nghiệm BLUE.",
    sections: [
      [
        isMockApi ? "Dữ liệu trong bản demo" : "Thông tin dùng khi đặt vé",
        isMockApi
          ? "Bản trải nghiệm dùng dữ liệu giả. Tài khoản Google/Facebook và SePay trong demo đều được mô phỏng."
          : "BLUE lưu thông tin tài khoản, liên hệ và hành trình cần thiết để xử lý đặt vé. Thông tin thanh toán được nhập trên cổng SePay.",
      ],
      [
        "Lưu trữ trên thiết bị",
        isMockApi
          ? "Phiên đăng nhập và thao tác demo được lưu trong sessionStorage của trình duyệt, tách biệt theo từng web. Xóa dữ liệu trang hoặc đóng phiên trình duyệt để đặt lại trải nghiệm."
          : "Trình duyệt lưu phiên truy cập, lựa chọn tìm kiếm và bản nháp cho đến khi bạn hoàn tất đặt vé.",
      ],
      [
        "Sử dụng thông tin",
        isMockApi
          ? "Thông tin hành khách được dùng để minh họa đặt vé, vé điện tử và hủy/hoàn. Bản demo không gửi yêu cầu hỗ trợ, email hoặc giao dịch tới ngân hàng thật."
          : "Thông tin hành khách được dùng để phát hành vé, phục vụ hành trình và xử lý các yêu cầu hỗ trợ, hủy hoặc hoàn tiền.",
      ],
      [
        "Quyền kiểm soát",
        isMockApi
          ? "Bạn có thể đăng xuất và xóa dữ liệu demo bất kỳ lúc nào."
          : "Bạn có thể cập nhật thông tin liên hệ trong hồ sơ và gửi yêu cầu về dữ liệu qua Trung tâm hỗ trợ.",
      ],
    ],
  },
  "/about": {
    title: "Cùng BLUE đi xa hơn",
    intro:
      "Một trải nghiệm đặt vé rõ ràng, từ lúc tìm chuyến đến khi hoàn thành hành trình.",
    sections: [
      [
        "Rõ ràng trước khi đi",
        "Tìm tuyến, so sánh lịch chạy, chọn ghế và kiểm tra tổng tiền trong cùng một hành trình.",
      ],
      [
        "Chủ động khi kế hoạch đổi",
        "Tra cứu vé và theo dõi yêu cầu hủy, hoàn tiền bằng các trạng thái dễ hiểu.",
      ],
      [
        "Không gian riêng cho từng vai trò",
        "Khách hàng đặt vé trên BLUE Customer. Nhà xe vận hành trong BLUE Operator. Quản trị nền tảng dùng BLUE Admin, với đăng nhập và điều hướng riêng.",
      ],
    ],
  },
  "/offers": {
    title: "Ưu đãi cho hành trình mới",
    intro: "Khám phá những lựa chọn cho chuyến đi sắp tới.",
    sections: [
      [
        "Đi giữa tuần",
        "So sánh lịch chạy và giá theo ngày để tìm chuyến phù hợp. Giá hiển thị trong kết quả là giá của từng chuyến, không tự áp dụng khuyến mại chưa được xác nhận.",
        "di-giua-tuan",
      ],
      [
        "Chủ động đặt sớm",
        "Các chuyến có nhiều loại xe, khung giờ và số ghế trống khác nhau. Chọn chuyến để xem trạng thái ghế hiện tại.",
        "dat-som",
      ],
      [
        "Thanh toán SePay",
        isMockApi
          ? "Kiểm tra tổng tiền ở bước xem lại đơn, sau đó chọn SePay để thử luồng thanh toán mô phỏng."
          : "Kiểm tra tổng tiền ở bước xem lại đơn và tiếp tục tới SePay để thanh toán theo phương thức đang được hỗ trợ.",
        "thanh-toan",
      ],
      [
        "So sánh nhà xe trên cùng một tuyến",
        "Mở một tuyến trong Khám phá rồi chọn Giá thấp nhất. Dùng bộ lọc để thu hẹp theo giờ đi, loại xe, nhà xe hoặc điểm đón trả. Giá mỗi chuyến được hiển thị trước khi chọn ghế.",
        "so-sanh-tuyen",
      ],
    ],
  },
};
const faqs = [
  [
    "Tôi giữ ghế được bao lâu?",
    "Thời gian còn lại hiển thị trong tóm tắt đặt vé. Khi hết hạn, hệ thống hướng dẫn bạn chọn lại ghế; không gửi thanh toán nhiều lần.",
  ],
  [
    "Thanh toán chưa có kết quả thì làm gì?",
    "Mở lại trang kết quả và chọn kiểm tra trạng thái. Chỉ thử thanh toán lại khi giao diện cho phép và đơn vẫn còn hiệu lực.",
    "thanh-toan",
  ],
  [
    "Tìm vé ở đâu?",
    "Mở Tra cứu vé và nhập thông tin đặt vé, hoặc đăng nhập và chọn Hành trình của tôi để xem vé thuộc tài khoản.",
  ],
  [
    "Hủy vé có được hoàn toàn bộ không?",
    "Phí và số tiền hoàn dự kiến được hiển thị trước khi xác nhận. Sau khi hủy, theo dõi yêu cầu hoàn tiền riêng; hủy thành công không đồng nghĩa ngân hàng đã hoàn tiền.",
    "huy-ve",
  ],
  [
    isMockApi
      ? "Demo có thu tiền thật không?"
      : "Tôi nhập thông tin thanh toán ở đâu?",
    isMockApi
      ? "Không. Các tài khoản, Google/Facebook, SePay, vé và yêu cầu hỗ trợ đều phục vụ mô phỏng trải nghiệm."
      : "Chọn phương thức ở bước thanh toán. SePay sẽ mở trang xác thực phù hợp với phương thức bạn chọn.",
  ],
];
export function InformationPage(): ReactElement {
  const { pathname, hash } = useLocation();
  const doc = documents[pathname];
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  function submit(event: FormEvent): void {
    event.preventDefault();
    setError("");
    if (!email.trim() || message.trim().length < 10) {
      setError("Nhập email và nội dung ít nhất 10 ký tự.");
      return;
    }
    if (!isMockApi) {
      if (sending) return;
      setSending(true);
      void apiJson(
        "/api/v1/customer-requests/support",
        z.object({ reference: z.string() }),
        {
          method: "POST",
          body: { email: email.trim(), message: message.trim() },
        },
      )
        .then((response) => setReference(response.reference))
        .catch(() => setError("Chưa thể gửi yêu cầu. Vui lòng thử lại."))
        .finally(() => setSending(false));
      return;
    }
    const code = `BLUE-SUP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    try {
      sessionStorage.setItem(
        `blue-support:${code}`,
        JSON.stringify({
          email: email.trim(),
          message: message.trim(),
          createdAt: new Date().toISOString(),
        }),
      );
      setReference(code);
    } catch {
      setError(
        "Không lưu được yêu cầu trên thiết bị. Hãy cho phép lưu trữ rồi thử lại.",
      );
    }
  }
  return (
    <article className="information-page">
      <header>
        <p className="information-page__eyebrow">BLUE · ĐỒNG HÀNH CÙNG BẠN</p>
        <h1>{doc?.title ?? "Trung tâm hỗ trợ"}</h1>
        <p>
          {doc?.intro ?? "Tìm câu trả lời hoặc gửi nội dung bạn cần hỗ trợ."}
        </p>
      </header>
      {doc ? (
        <>
          <div className="information-page__sections">
            {doc.sections.map(([title, copy, anchor]) => (
              <section key={title} id={anchor}>
                <h2>{title}</h2>
                <p>{copy}</p>
              </section>
            ))}
          </div>
          <Link to="/support">Liên hệ hỗ trợ</Link>
        </>
      ) : (
        <div className="information-page__support">
          <section>
            <h2>Câu hỏi thường gặp</h2>
            <Input
              label="Tìm câu trả lời"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {faqs
              .filter((pair) =>
                pair
                  .join(" ")
                  .toLocaleLowerCase("vi")
                  .includes(search.toLocaleLowerCase("vi")),
              )
              .map(([title, copy, anchor]) => (
                <details
                  key={title}
                  id={anchor}
                  open={anchor && hash === `#${anchor}` ? true : undefined}
                >
                  <summary>{title}</summary>
                  <p>{copy}</p>
                </details>
              ))}
            {!faqs.some((pair) =>
              pair
                .join(" ")
                .toLocaleLowerCase("vi")
                .includes(search.toLocaleLowerCase("vi")),
            ) && (
              <p>
                Chưa có câu trả lời phù hợp. Bạn có thể gửi yêu cầu bên cạnh.
              </p>
            )}
          </section>
          <section>
            <h2>Gửi yêu cầu hỗ trợ</h2>
            <p>
              {isMockApi
                ? "Yêu cầu demo chỉ được lưu trên trình duyệt, không gửi email hoặc liên hệ nhân viên thật."
                : "Giữ mã yêu cầu để tiện liên hệ về nội dung đã gửi."}
            </p>
            {reference ? (
              <div role="status">
                <h3>
                  {isMockApi
                    ? "Đã lưu yêu cầu trải nghiệm"
                    : "Đã nhận yêu cầu hỗ trợ"}
                </h3>
                <p>
                  Mã yêu cầu: <strong>{reference}</strong>
                </p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setReference("");
                    setMessage("");
                  }}
                >
                  Tạo yêu cầu khác
                </Button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <Input
                  label="Email liên hệ"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <label htmlFor="support-message">Nội dung cần hỗ trợ</label>
                <textarea
                  id="support-message"
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={6}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
                {error && (
                  <Toast
                    tone="error"
                    message={error}
                    onClose={() => setError("")}
                  />
                )}
                <Button type="submit" isLoading={sending}>
                  Gửi yêu cầu
                </Button>
              </form>
            )}
          </section>
        </div>
      )}
      <nav aria-label="Thông tin dịch vụ">
        <Link to="/terms">Điều khoản</Link>
        <Link to="/privacy">Bảo mật</Link>
        <Link to="/support">Hỗ trợ</Link>
        <Link to="/trips">Tìm chuyến xe</Link>
      </nav>
    </article>
  );
}
