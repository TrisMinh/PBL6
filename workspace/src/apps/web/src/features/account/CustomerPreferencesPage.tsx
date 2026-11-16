import { Toast } from "@/shared/ui/Toast/Toast";
import { useState, type FormEvent, type ReactElement } from "react";
import { Link, NavLink } from "react-router";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { Bell } from "@phosphor-icons/react/dist/csr/Bell";
import { GearSix } from "@phosphor-icons/react/dist/csr/GearSix";
import { ShieldCheck } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { Ticket } from "@phosphor-icons/react/dist/csr/Ticket";
import { UserCircle } from "@phosphor-icons/react/dist/csr/UserCircle";
import { useMockSession } from "@/features/auth/hooks/useMockSession";
import { isMockApi } from "@/shared/api/config";
import { ROUTES } from "@/shared/config/routes";
import { Button } from "@/shared/ui/Button/Button";
import { LiveProfileCard } from "./LiveProfileCard";
import { ProfileEditor } from "./ProfileEditor";
import {
  defaultPreferences,
  preferencesSchema,
  readCustomerData,
  saveCustomerData,
  type CustomerPreferences,
} from "./customerPreferences";
import "./LiveAccountPage.css";
import "./CustomerPreferencesPage.css";

const pages = [
  { label: "Hồ sơ cá nhân", path: ROUTES.accountProfile, Icon: UserCircle },
  { label: "Vé của tôi", path: ROUTES.accountTickets, Icon: Ticket },
  { label: "Cài đặt", path: ROUTES.accountSettings, Icon: GearSix },
];

const notificationOptions = [
  {
    key: "journey",
    title: "Cập nhật hành trình",
    description: "Thay đổi lịch chạy, điểm đón hoặc trạng thái vé.",
  },
  {
    key: "reminder",
    title: "Nhắc giờ khởi hành",
    description: "Nhắc chuẩn bị trước giờ xe chạy.",
  },
  {
    key: "offers",
    title: "Tin ưu đãi",
    description: "Thông tin chương trình và ưu đãi của BLUE.",
  },
] as const;

function AccountSettings({ userId }: { userId: string }): ReactElement {
  const [saved, setSaved] = useState(() =>
    readCustomerData(userId, "settings", preferencesSchema, defaultPreferences),
  );
  const [draft, setDraft] = useState<CustomerPreferences>(saved);
  const [feedback, setFeedback] = useState<"saved" | "error" | null>(null);
  const dirty = notificationOptions.some(
    ({ key }) => saved[key] !== draft[key],
  );

  function save(event: FormEvent): void {
    event.preventDefault();
    if (!saveCustomerData(userId, "settings", draft)) {
      setFeedback("error");
      return;
    }
    setSaved(draft);
    setFeedback("saved");
  }

  return (
    <div className="customer-preferences__stack">
      <section
        className="customer-preferences__panel"
        aria-labelledby="customer-notice-title"
      >
        <h2 id="customer-notice-title">
          <Bell weight="duotone" size={23} aria-hidden /> Tùy chọn thông báo
        </h2>
        <p className="customer-preferences__description">
          Tùy chọn lưu trong phiên trình duyệt. Bản trải nghiệm chưa gửi thông
          báo.
        </p>
        <form onSubmit={save}>
          {notificationOptions.map(({ key, title, description }) => (
            <label className="customer-preferences__toggle" key={key}>
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
              <input
                role="switch"
                type="checkbox"
                aria-label={title}
                checked={draft[key]}
                onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  setDraft((previous) => ({ ...previous, [key]: checked }));
                  setFeedback(null);
                }}
              />
            </label>
          ))}
          <div className="customer-preferences__form-footer">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDraft(defaultPreferences);
                setFeedback(null);
              }}
            >
              Đặt về mặc định
            </Button>
            <Button type="submit" disabled={!dirty}>
              Lưu tùy chọn
            </Button>
          </div>
          {feedback === "saved" && (
            <Toast
              message="Đã lưu tùy chọn."
              onClose={() => setFeedback(null)}
            />
          )}
          {feedback === "error" && (
            <Toast
              tone="error"
              message="Chưa lưu được tùy chọn. Hãy kiểm tra quyền lưu trữ rồi thử lại."
              onClose={() => setFeedback(null)}
            />
          )}
        </form>
      </section>
      <section
        className="customer-preferences__panel"
        aria-labelledby="customer-security-title"
      >
        <h2 id="customer-security-title">
          <ShieldCheck weight="duotone" size={23} aria-hidden /> Bảo mật và
          quyền riêng tư
        </h2>
        <Link
          className="customer-preferences__security"
          to={ROUTES.forgotPassword}
        >
          <span>
            <strong>Đặt lại mật khẩu</strong>
            <small>Xác minh tài khoản để tạo mật khẩu mới.</small>
          </span>
          <ArrowRight size={18} aria-hidden />
        </Link>
        <Link className="customer-preferences__security" to="/privacy">
          <span>
            <strong>Chính sách bảo mật</strong>
            <small>Xem cách BLUE xử lý thông tin của bạn.</small>
          </span>
          <ArrowRight size={18} aria-hidden />
        </Link>
      </section>
    </div>
  );
}

export function CustomerPreferencesPage({
  view,
}: {
  view: "profile" | "settings";
}): ReactElement {
  const { session } = useMockSession();
  return (
    <div className="customer-preferences">
      <header className="customer-preferences__heading">
        <h1>{view === "profile" ? "Hồ sơ cá nhân" : "Cài đặt tài khoản"}</h1>
        <p>
          {view === "profile"
            ? "Quản lý thông tin liên hệ của bạn."
            : "Quản lý thông báo, mật khẩu và quyền riêng tư."}
        </p>
      </header>
      {session ? (
        <div className="customer-preferences__layout">
          <nav
            className="customer-preferences__nav"
            aria-label="Tài khoản của tôi"
          >
            {pages.map(({ label, path, Icon }) => (
              <NavLink key={path} to={path}>
                <Icon size={21} weight="duotone" aria-hidden /> {label}
              </NavLink>
            ))}
          </nav>
          {view === "profile" ? (
            isMockApi ? (
              <ProfileEditor key={session.userId} userId={session.userId} />
            ) : (
              <LiveProfileCard />
            )
          ) : (
            <AccountSettings key={session.userId} userId={session.userId} />
          )}
        </div>
      ) : (
        <p role="status">Đang kiểm tra phiên…</p>
      )}
    </div>
  );
}
