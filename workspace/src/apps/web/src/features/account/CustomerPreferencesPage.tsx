import { Toast } from "@/shared/ui/Toast/Toast";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";
import { Camera } from "@phosphor-icons/react/dist/csr/Camera";
import { Link, NavLink } from "react-router";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { Bell } from "@phosphor-icons/react/dist/csr/Bell";
import { GearSix } from "@phosphor-icons/react/dist/csr/GearSix";
import { ShieldCheck } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { Ticket } from "@phosphor-icons/react/dist/csr/Ticket";
import { UserCircle } from "@phosphor-icons/react/dist/csr/UserCircle";
import { useMockSession } from "@/features/auth/hooks/useMockSession";
import { findDemoAccount } from "@/mocks/state/customerAccounts";
import { isMockApi } from "@/shared/api/config";
import { ROUTES } from "@/shared/config/routes";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";
import { LiveProfileCard } from "./LiveProfileCard";
import { prepareCustomerAvatar } from "./customerAvatar";
import {
  customerProfileSchema,
  defaultPreferences,
  preferencesSchema,
  readCustomerData,
  saveCustomerData,
  type CustomerProfile,
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

function ProfileEditor({ userId }: { userId: string }): ReactElement {
  const account = findDemoAccount(userId, true);
  const [saved, setSaved] = useState(() =>
    readCustomerData(userId, "profile", customerProfileSchema, {
      fullName:
        account?.fullName ??
        (userId === "mock-customer" ? "Nguyễn Minh An" : ""),
      phone: account?.phone ?? "",
      province: "",
      avatar: "",
    }),
  );
  const [draft, setDraft] = useState<CustomerProfile>(saved);
  const [errors, setErrors] = useState<Partial<CustomerProfile>>({});
  const [feedback, setFeedback] = useState<"saved" | "error" | null>(null);
  const [imageError, setImageError] = useState("");
  const [processing, setProcessing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const imageRequest = useRef(0);
  useEffect(
    () => () => {
      imageRequest.current++;
    },
    [],
  );
  const dirty =
    draft.fullName !== saved.fullName ||
    draft.phone !== saved.phone ||
    draft.province !== saved.province ||
    draft.avatar !== saved.avatar;

  function edit(field: keyof CustomerProfile, value: string): void {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: "" }));
    setFeedback(null);
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = customerProfileSchema.safeParse(draft);
    if (!parsed.success) {
      const { fieldErrors } = parsed.error.flatten();
      setErrors({
        fullName: fieldErrors.fullName?.[0] ?? "",
        phone: fieldErrors.phone?.[0] ?? "",
        province: fieldErrors.province?.[0] ?? "",
      });
      const field = form.elements.namedItem(
        String(parsed.error.issues[0].path[0]),
      );
      if (field instanceof HTMLInputElement) field.focus();
      return;
    }
    if (!saveCustomerData(userId, "profile", parsed.data)) {
      setFeedback("error");
      return;
    }
    setSaved(parsed.data);
    setDraft(parsed.data);
    setFeedback("saved");
  }

  const initials =
    saved.fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(-2)
      .map((word) => word[0])
      .join("")
      .toLocaleUpperCase("vi") || "BL";
  return (
    <section
      className="customer-preferences__panel"
      aria-labelledby="customer-profile-heading"
    >
      <div className="customer-preferences__identity">
        <span aria-hidden className="customer-preferences__avatar">
          {draft.avatar ? <img src={draft.avatar} alt="" /> : initials}
        </span>
        <div>
          <h2 id="customer-profile-heading">
            {saved.fullName || "Thông tin cá nhân"}
          </h2>
          <p>{account?.email ?? "Tài khoản khách hàng"}</p>
          <div className="customer-preferences__avatar-actions">
            <input
              ref={fileInput}
              hidden
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Chọn ảnh đại diện"
              onChange={async (event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (!file) return;
                const request = ++imageRequest.current;
                setProcessing(true);
                setImageError("");
                try {
                  const avatar = await prepareCustomerAvatar(file);
                  if (request === imageRequest.current) edit("avatar", avatar);
                } catch (error) {
                  if (request === imageRequest.current)
                    setImageError(
                      error instanceof Error
                        ? error.message
                        : "Chưa đọc được ảnh. Hãy chọn ảnh khác.",
                    );
                } finally {
                  if (request === imageRequest.current) setProcessing(false);
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={processing}
              onClick={() => fileInput.current?.click()}
            >
              <Camera size={16} aria-hidden />{" "}
              {processing ? "Đang xử lý…" : "Đổi ảnh"}
            </Button>
            {draft.avatar && (
              <Button
                type="button"
                variant="ghost"
                disabled={processing}
                onClick={() => edit("avatar", "")}
              >
                Xóa ảnh
              </Button>
            )}
            <small>JPG, PNG, WebP · tối đa 5 MB</small>
          </div>
          {imageError && (
            <Toast
              tone="error"
              message={imageError}
              onClose={() => setImageError("")}
            />
          )}
        </div>
      </div>
      <form className="customer-preferences__form" onSubmit={submit} noValidate>
        <Input
          name="fullName"
          label="Họ và tên"
          autoComplete="name"
          required
          maxLength={100}
          value={draft.fullName}
          error={errors.fullName}
          onChange={(e) => edit("fullName", e.target.value)}
        />
        <Input
          label="Email đăng nhập"
          type="email"
          value={account?.email ?? ""}
          placeholder="Chưa có địa chỉ email"
          readOnly
        />
        <Input
          name="phone"
          label="Số điện thoại liên hệ"
          type="tel"
          autoComplete="tel"
          maxLength={24}
          placeholder="Chưa cập nhật"
          value={draft.phone}
          error={errors.phone}
          onChange={(e) => edit("phone", e.target.value)}
        />
        <Input
          name="province"
          label="Tỉnh, thành đang sống"
          autoComplete="address-level1"
          maxLength={100}
          placeholder="Chưa cập nhật"
          value={draft.province}
          error={errors.province}
          onChange={(e) => edit("province", e.target.value)}
        />
        <div className="customer-preferences__form-footer">
          <p>Hồ sơ mẫu được lưu trong phiên trình duyệt này.</p>
          <Button
            type="button"
            variant="secondary"
            disabled={!dirty || processing}
            onClick={() => {
              setDraft(saved);
              setErrors({});
              setFeedback(null);
              setImageError("");
            }}
          >
            Bỏ thay đổi
          </Button>
          <Button type="submit" disabled={!dirty || processing}>
            Lưu hồ sơ
          </Button>
        </div>
        {feedback === "saved" && (
          <Toast message="Đã lưu hồ sơ." onClose={() => setFeedback(null)} />
        )}
        {feedback === "error" && (
          <Toast
            tone="error"
            message="Chưa lưu được hồ sơ. Hãy kiểm tra quyền lưu trữ rồi thử lại."
            onClose={() => setFeedback(null)}
          />
        )}
      </form>
    </section>
  );
}

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
