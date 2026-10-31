import { createMeta } from "@/shared/config/seo";
export function meta(): ReturnType<typeof createMeta> { return createMeta({ title: "Đặt lại mật khẩu", description: "Xác thực tài khoản của bạn.", noIndex: true }); }
import type { ReactElement } from "react";
import { AccountChallengePage } from "@/features/auth/pages/AccountChallengePage";
export default function ResetPasswordRoute() : ReactElement { return <AccountChallengePage reset />; }
