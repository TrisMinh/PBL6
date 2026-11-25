import { useState, type FormEvent, type ReactElement } from "react";
import { Link } from "react-router";
import { z } from "zod";
import { apiJson, refreshAccessToken } from "@/shared/api/client";
import { ApiError } from "@/shared/api/error";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";
import { ROUTES } from "@/shared/config/routes";

const endpoint = "/api/v1/users/me/phone-verification";

export function VerifyBookingPhone({
  onVerified,
}: {
  onVerified: () => void;
}): ReactElement {
  const [challenge, setChallenge] = useState<string>();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");

  async function run(action: "send" | "verify"): Promise<void> {
    setPending(true);
    setNotice("");
    try {
      if (action === "send") {
        const result = await apiJson(
          endpoint,
          z.object({ challengeId: z.guid() }).optional(),
          { method: "POST" },
        );
        if (result) {
          setChallenge(result.challengeId);
          setCode("");
          setNotice(
            "Mã đã được gửi đến số điện thoại trong hồ sơ. Mã có hiệu lực 5 phút.",
          );
          return;
        }
      } else {
        await apiJson(`${endpoint}/verify`, z.unknown(), {
          method: "POST",
          body: { challengeId: challenge, code },
        });
      }
      await refreshAccessToken();
      onVerified();
    } catch (error) {
      setNotice(
        error instanceof ApiError && error.status === 429
          ? "Bạn đã yêu cầu nhiều mã. Vui lòng đợi rồi thử lại."
          : action === "verify"
            ? "Mã chưa đúng, đã hết hạn hoặc số này đã được xác minh trên tài khoản khác."
            : "Chưa gửi được mã. Kiểm tra số điện thoại trong hồ sơ rồi thử lại.",
      );
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!pending) void run("verify");
  }

  return (
    <section
      className="seat-selection__feedback"
      aria-label="Xác minh số điện thoại"
    >
      <p>Xác minh số điện thoại trong hồ sơ để tiếp tục giữ ghế.</p>
      {challenge && (
        <form onSubmit={submit}>
          <Input
            label="Mã SMS"
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          />
          <Button type="submit" disabled={pending || code.length !== 6}>
            Xác nhận mã
          </Button>
        </form>
      )}
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() => void run("send")}
      >
        {challenge ? "Gửi lại mã SMS" : "Gửi mã SMS"}
      </Button>{" "}
      <Link to={ROUTES.accountProfile}>Kiểm tra số điện thoại</Link>
      <p role="status">{notice}</p>
    </section>
  );
}
