import type { ReactElement } from "react";
import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import {
  verifyEmail,
  resendVerification,
  resetPassword,
} from "../repositories/backendAuthRepository";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { Button } from "@/shared/ui/Button/Button";
import { z } from "zod";

export function AccountChallengePage({
  reset = false,
}: {
  reset?: boolean;
}): ReactElement {
  const [params] = useSearchParams();
  const [challengeId, setChallengeId] = useState(
    params.get("challengeId") ?? "",
  );
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      reset
        ? resetPassword(challengeId, code, password)
        : verifyEmail(challengeId, code),
    retry: false,
  });
  const resend = useMutation({
    mutationFn: () => resendVerification(email),
    retry: false,
  });
  function submit(event: FormEvent): void {
    event.preventDefault();
    mutation.mutate();
  }
  return (
    <section className="live-api">
      <h1>{reset ? "Đặt lại mật khẩu" : "Xác minh email"}</h1>
      <p>Nhập mã yêu cầu và mã xác minh bạn nhận được trong email.</p>
      <form onSubmit={submit}>
        <label>
          Mã yêu cầu
          <input
            required
            value={challengeId}
            onChange={(e) => setChallengeId(e.target.value.trim())}
          />
        </label>
        <label>
          Mã xác minh
          <input
            required
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.trim())}
          />
        </label>
        {reset && (
          <label>
            Mật khẩu mới
            <input
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        <Button
          type="submit"
          disabled={
            !z.string().uuid().safeParse(challengeId).success ||
            mutation.isSuccess
          }
          isLoading={mutation.isPending}
        >
          Xác nhận
        </Button>
      </form>
      {mutation.isError && <ApiFailure error={mutation.error} />}
      {mutation.isSuccess && (
        <p role="status">Hoàn tất. Bạn có thể đăng nhập.</p>
      )}
      {!reset && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            resend.mutate();
          }}
        >
          <label>
            Email nhận lại mã
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <Button type="submit" isLoading={resend.isPending}>
            Gửi lại mã
          </Button>
        </form>
      )}
      {resend.isError && <ApiFailure error={resend.error} />}
      {resend.isSuccess && (
        <p role="status">Yêu cầu gửi lại mã đã được tiếp nhận.</p>
      )}
      <Link to="/login">Đăng nhập</Link>
    </section>
  );
}
