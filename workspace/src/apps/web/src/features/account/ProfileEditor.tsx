import { Toast } from "@/shared/ui/Toast/Toast";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";
import { Camera } from "@phosphor-icons/react/dist/csr/Camera";
import { findDemoAccount } from "@/mocks/state/customerAccounts";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";
import { prepareCustomerAvatar } from "./customerAvatar";
import {
  customerProfileSchema,
  readCustomerData,
  saveCustomerData,
  type CustomerProfile,
} from "./customerPreferences";
export function ProfileEditor({
  userId,
  accountInfo,
  onSave,
}: {
  userId: string;
  accountInfo?: { fullName: string; email: string; phone: string };
  onSave?: (profile: CustomerProfile) => Promise<void>;
}): ReactElement {
  const account = accountInfo ?? findDemoAccount(userId, true);
  const [saved, setSaved] = useState(() => {
    const stored = readCustomerData(userId, "profile", customerProfileSchema, {
      fullName:
        account?.fullName ??
        (userId === "mock-customer" ? "Nguyễn Minh An" : ""),
      phone: account?.phone ?? "",
      province: "",
      avatar: "",
    });
    return accountInfo
      ? {
          ...stored,
          fullName: accountInfo.fullName,
          phone: accountInfo.phone.replace(/^\+84/, "0"),
        }
      : stored;
  });
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

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
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
    if (onSave) {
      setProcessing(true);
      try {
        await onSave(parsed.data);
      } catch (error) {
        setImageError(
          error instanceof Error ? error.message : "Chưa lưu được hồ sơ.",
        );
        return;
      } finally {
        setProcessing(false);
      }
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
          <p>
            {onSave
              ? "Thông tin liên hệ lưu trong tài khoản. Ảnh và tỉnh thành lưu trên trình duyệt này."
              : "Hồ sơ mẫu được lưu trong phiên trình duyệt này."}
          </p>
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
