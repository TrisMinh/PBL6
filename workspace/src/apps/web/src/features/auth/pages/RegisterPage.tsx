import { useState, type ReactElement } from "react";
import { isMockApi } from "@/shared/api/config";
import { readPendingVerification } from "../lib/pendingVerification";

import { AuthShell } from "@/features/auth/components/AuthShell";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

export function RegisterPage(): ReactElement {
  const [pending, setPending] = useState(() =>
    isMockApi ? null : readPendingVerification(),
  );
  return (
    <AuthShell mode={pending ? "verify" : "register"}>
      <RegisterForm pending={pending} onVerificationChange={setPending} />
    </AuthShell>
  );
}
