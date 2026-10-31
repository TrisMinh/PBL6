import type { ReactElement } from "react";

import { AuthShell } from "@/features/auth/components/AuthShell";
import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";

export function ForgotPasswordPage(): ReactElement {
  return (
    <AuthShell mode="forgot">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
