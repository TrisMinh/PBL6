import { createMeta } from "@/shared/config/seo";
export function meta(): ReturnType<typeof createMeta> { return createMeta({ title: "Xác minh email", description: "Xác thực tài khoản của bạn.", noIndex: true }); }
import type { ReactElement } from "react";
import { AccountChallengePage } from "@/features/auth/pages/AccountChallengePage";
export default function VerifyEmailRoute() : ReactElement { return <AccountChallengePage />; }
