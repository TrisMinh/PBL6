import type { ReactElement } from "react";

import { AuthShell } from "@/features/auth/components/AuthShell";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

export function RegisterPage(): ReactElement {
  return (
    <AuthShell mode="register">
      <RegisterForm />
    </AuthShell>
  );
}
