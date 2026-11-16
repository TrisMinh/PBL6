import { Toast } from "@/shared/ui/Toast/Toast";
import { apiJson } from "@/shared/api/client";
import { isMockApi } from "@/shared/api/config";
import { z } from "zod";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { operatorOrigin } from "@/shared/config/portalOrigins";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";
import "./PartnerSalesPage.css";

const benefits = [
  {
    title: "Đưa chuyến xe đến hành khách",
    copy: "Hành khách có thể tìm chuyến theo tỉnh, ngày đi và điểm đón trả, rồi chọn ghế và đặt vé trực tuyến.",
  },
  {
    title: "Quản lý lịch chạy và chỗ bán",
    copy: "Thiết lập tuyến, phương tiện, giờ xuất bến và giá vé trên cổng điều hành của nhà xe.",
  },
  {
    title: "Theo dõi đơn và đối soát",
    copy: "Xem danh sách hành khách, trạng thái thanh toán, yêu cầu hoàn vé và kỳ đối soát theo chuyến.",
  },
];

const steps = [
  [
    "Đăng ký thông tin",
    "Điền tên nhà xe, đầu mối liên hệ và tuyến dự kiến mở bán.",
  ],
  [
    "Thống nhất phạm vi",
    "Xác định các tuyến, khung giờ và số ghế muốn đưa lên kênh trực tuyến.",
  ],
  [
    "Thiết lập chuyến",
    "Nhập lịch chạy, điểm đón trả, giá và sơ đồ ghế trong cổng nhà xe.",
  ],
  [
    "Kiểm tra và mở bán",
    "Xem lại thông tin hiển thị cho hành khách trước khi công bố chuyến.",
  ],
];

const questions = [
  [
    "Tôi cần chuẩn bị thông tin gì?",
    "Hãy chuẩn bị tên nhà xe, người liên hệ và các tuyến muốn mở bán. Khi thiết lập chuyến, bạn sẽ cần giờ khởi hành, giá vé, phương tiện và các điểm đón trả.",
  ],
  [
    "Có thể bắt đầu với một tuyến không?",
    "Có. Bạn có thể thiết lập một tuyến và một số chuyến trước để kiểm tra cách hiển thị và trải nghiệm đặt vé.",
  ],
  [
    "Nhà xe đã có tài khoản cần làm gì?",
    "Chọn Vào cổng nhà xe để đăng nhập vào web Operator và quản lý các chuyến của đơn vị mình.",
  ],
  [
    "Đăng ký trên trang này được gửi đi đâu?",
    "Trong bản trải nghiệm, thông tin chỉ được lưu trong phiên trình duyệt và bạn nhận một mã đăng ký. Biểu mẫu không gửi email hoặc tự mở bán chuyến.",
  ],
];

function PartnerStoryPhoto({ index }: { index: number }): ReactElement {
  return (
    <div className="partner-sales__story-photo">
      <img
        src="/images/partners/operations.webp"
        alt=""
        loading="lazy"
        width={1536}
        height={1024}
        style={{
          left: `${-100 * (index % 2)}%`,
          top: `${-100 * Math.floor(index / 2)}%`,
        }}
      />
    </div>
  );
}

type FieldName = "operator" | "contact" | "phone" | "email";
type FieldErrors = Partial<Record<FieldName, string>>;

function PartnerRegistration(): ReactElement {
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const section = useRef<HTMLElement>(null);
  const refocusForm = useRef(false);

  useEffect(() => {
    if (reference)
      section.current?.querySelector<HTMLElement>("[role=status]")?.focus();
    else if (refocusForm.current) {
      section.current
        ?.querySelector<HTMLInputElement>("[name=operator]")
        ?.focus();
      refocusForm.current = false;
    }
  }, [reference]);

  const [sending, setSending] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const field = (name: string): string => String(data.get(name) ?? "").trim();
    const operator = field("operator");
    const contact = field("contact");
    const phone = field("phone").replace(/[\s.-]/g, "");
    const email = form.elements.namedItem("email");
    const nextErrors: FieldErrors = {};
    if (!operator) nextErrors.operator = "Nhập tên nhà xe.";
    if (!contact) nextErrors.contact = "Nhập tên người liên hệ.";
    if (!/^(?:\+84|0)\d{9}$/.test(phone)) {
      nextErrors.phone =
        "Nhập số điện thoại Việt Nam hợp lệ, ví dụ 0912 345 678.";
    }
    if (email instanceof HTMLInputElement && email.validity.typeMismatch) {
      nextErrors.email = "Nhập email đúng định dạng.";
    }
    setErrors(nextErrors);
    setMessage("");
    const invalidName = Object.keys(nextErrors)[0];
    if (invalidName) {
      const invalidInput = form.elements.namedItem(invalidName);
      if (invalidInput instanceof HTMLInputElement) invalidInput.focus();
      return;
    }
    if (!isMockApi) {
      if (sending) return;
      setSending(true);
      void apiJson(
        "/api/v1/customer-requests/partner",
        z.object({ reference: z.string() }),
        {
          method: "POST",
          body: {
            operator,
            contact,
            phone,
            email: field("email"),
            route: field("route"),
          },
        },
      )
        .then((response) => setReference(response.reference))
        .catch(() => setMessage("Chưa gửi được đăng ký. Vui lòng thử lại."))
        .finally(() => setSending(false));
      return;
    }
    try {
      const code = `BLUE-NX-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      sessionStorage.setItem(
        `blue-partner:${code}`,
        JSON.stringify({
          operator,
          contact,
          phone,
          email: field("email"),
          route: field("route"),
          createdAt: new Date().toISOString(),
        }),
      );
      setReference(code);
    } catch {
      setMessage(
        "Chưa lưu được đăng ký. Kiểm tra quyền lưu trữ của trình duyệt và thử lại.",
      );
    }
  }

  return (
    <section
      className="partner-sales__registration"
      ref={section}
      id="dang-ky"
      aria-labelledby="partner-registration-title"
      tabIndex={-1}
    >
      <h2 id="partner-registration-title">Đăng ký mở bán</h2>
      {reference ? (
        <div className="partner-sales__success">
          <div role="status" tabIndex={-1}>
            <CheckCircle size={32} weight="duotone" aria-hidden />
            <p>
              <strong>
                {isMockApi
                  ? "Đã lưu đăng ký trải nghiệm"
                  : "Đã nhận đăng ký mở bán"}
              </strong>
            </p>
            <p>
              Mã đăng ký <strong>{reference}</strong>
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              refocusForm.current = true;
              setReference("");
            }}
          >
            Đăng ký khác
          </Button>
        </div>
      ) : (
        <form
          onSubmit={submit}
          noValidate
          onChange={(event) => {
            if (!(event.target instanceof HTMLInputElement)) return;
            const name = event.target.name as FieldName;
            if (errors[name])
              setErrors((previous) => ({ ...previous, [name]: undefined }));
          }}
          aria-labelledby="partner-registration-title"
          aria-describedby="partner-request-note"
        >
          <Input
            label="Tên nhà xe"
            name="operator"
            placeholder="Ví dụ: Nhà xe An Phú"
            autoComplete="organization"
            error={errors.operator}
            maxLength={120}
            required
          />
          <div className="partner-sales__fields">
            <Input
              label="Người liên hệ"
              name="contact"
              autoComplete="name"
              error={errors.contact}
              maxLength={100}
              required
            />
            <Input
              label="Số điện thoại"
              name="phone"
              autoComplete="tel"
              type="tel"
              inputMode="tel"
              placeholder="0912 345 678"
              error={errors.phone}
              maxLength={20}
              required
            />
          </div>
          <Input
            label="Email (không bắt buộc)"
            name="email"
            type="email"
            autoComplete="email"
            error={errors.email}
            maxLength={150}
          />
          <Input
            label="Tuyến dự kiến (không bắt buộc)"
            name="route"
            placeholder="Ví dụ: TP. Hồ Chí Minh → Đà Lạt"
            maxLength={200}
          />
          {message && (
            <Toast
              tone="error"
              message={message}
              onClose={() => setMessage("")}
            />
          )}
          <Button type="submit" isLoading={sending}>
            Lưu đăng ký <ArrowRight size={17} aria-hidden />
          </Button>
          <p className="partner-sales__note" id="partner-request-note">
            {isMockApi
              ? "Bản trải nghiệm lưu đăng ký trong phiên trình duyệt này."
              : "Giữ mã đăng ký để tiện trao đổi với BLUE."}
          </p>
        </form>
      )}
    </section>
  );
}

export function PartnerSalesPage(): ReactElement {
  return (
    <div className="partner-sales">
      <div className="partner-sales__hero">
        <div className="partner-sales__intro">
          <img
            className="partner-sales__photo"
            src="/images/partners/terminal.webp"
            alt=""
            width={1536}
            height={1024}
            fetchPriority="high"
          />
          <div className="partner-sales__intro-copy">
            <h1>
              Mở bán vé
              <br />
              trên BLUE
            </h1>
            <p>
              Đưa chuyến xe của bạn lên kênh đặt vé trực tuyến và quản lý lịch
              chạy, ghế bán, đơn vé trong cổng dành cho nhà xe.
            </p>
            <a
              className="partner-sales__portal-link"
              href={`${operatorOrigin()}/login`}
            >
              Vào cổng nhà xe <ArrowRight size={16} aria-hidden />
            </a>
          </div>
        </div>
        <PartnerRegistration />
      </div>

      <section
        className="partner-sales__benefits"
        aria-labelledby="partner-benefits-title"
      >
        <h2 id="partner-benefits-title">Nhà xe có thể làm gì trên BLUE?</h2>
        <div className="partner-sales__benefit-grid">
          {benefits.map(({ title, copy }, index) => (
            <article key={title}>
              <PartnerStoryPhoto index={index} />
              <div className="partner-sales__benefit-copy">
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        className="partner-sales__process"
        aria-labelledby="partner-process-title"
      >
        <PartnerStoryPhoto index={3} />
        <div className="partner-sales__process-copy">
          <h2 id="partner-process-title">Quy trình mở bán</h2>
          <ol>
            {steps.map(([title, copy]) => (
              <li key={title}>
                <h3>{title}</h3>
                <p>{copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        className="partner-sales__faq"
        aria-labelledby="partner-faq-title"
      >
        <h2 id="partner-faq-title">Câu hỏi thường gặp</h2>
        <div>
          {questions.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="partner-sales__closing">
        <h2>Đăng ký tuyến đầu tiên của nhà xe</h2>
        <a href="#dang-ky">
          Đăng ký mở bán <ArrowRight size={18} aria-hidden />
        </a>
      </div>
    </div>
  );
}
