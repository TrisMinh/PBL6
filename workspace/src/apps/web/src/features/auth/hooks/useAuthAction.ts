import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isMockApi } from "@/shared/api/config";
import { useEffect, useRef, type RefObject } from "react";
import { useLocation, useNavigate } from "react-router";

import type {
  AuthSession,
  LoginInput,
  RegisterInput,
  ForgotInput,
  OAuthInput,
} from "@/features/auth/repositories/authRepository";
import { httpAuthRepository } from "@/features/auth/repositories/httpAuthRepository";
import { writeMockSession } from "@/features/auth/lib/sessionStorage";
import { safeIntendedRedirect } from "@/features/auth/lib/intendedRedirect";
import { workspaceRedirect } from "@/features/auth/lib/workspaceAccess";
import { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";

type Action =
  | { kind: "login"; input: LoginInput }
  | { kind: "register"; input: RegisterInput }
  | { kind: "forgot"; input: ForgotInput }
  | { kind: "oauth"; input: OAuthInput };
interface Attempt {
  mounted: boolean;
  locked: boolean;
  action?: Action;
  controller?: AbortController;
}
function useAttempt(): RefObject<Attempt> {
  const ref = useRef<Attempt>({ mounted: false, locked: false });
  useEffect(() => {
    const state = ref.current;
    state.mounted = true;
    return () => {
      state.mounted = false;
      state.locked = false;
      delete state.action;
      state.controller?.abort();
    };
  }, []);
  return ref;
}
async function execute(
  ref: RefObject<Attempt>,
): Promise<AuthSession | undefined> {
  const action = ref.current.action,
    signal = ref.current.controller?.signal;
  delete ref.current.action;
  if (!action) throw new BookingRepositoryError("VALIDATION_ERROR");
  let session: AuthSession | undefined;
  switch (action.kind) {
    case "login":
      session = await httpAuthRepository.login(action.input, signal);
      break;
    case "oauth":
      session = await httpAuthRepository.oauth(action.input, signal);
      break;
    case "register":
      await httpAuthRepository.register(action.input, signal);
      break;
    case "forgot":
      await httpAuthRepository.forgot(action.input, signal);
      break;
  }
  if (!ref.current.mounted) throw new BookingRepositoryError("ABORTED");
  if (session && !writeMockSession(session))
    throw new BookingRepositoryError("STORAGE_UNAVAILABLE");
  return session;
}
function fromState(state: unknown): unknown {
  return typeof state === "object" && state !== null && "from" in state
    ? state.from
    : undefined;
}
interface AuthActionResult {
  isPending: boolean;
  isSuccess: boolean;
  error: BookingRepositoryError | null;
  submit: (action: Action) => void;
}
export function useAuthAction(): AuthActionResult {
  const ref = useAttempt(),
    navigate = useNavigate(),
    location = useLocation(),
    client = useQueryClient();
  const mutation = useMutation<
    AuthSession | undefined,
    BookingRepositoryError,
    void
  >({
    retry: false,
    mutationFn: () => execute(ref),
    onSuccess: (session) => {
      if (session && ref.current.mounted) {
        client.removeQueries({ queryKey: ["account-tickets"] });
        client.removeQueries({ queryKey: ["ticket-detail"] });
        const target = isMockApi
          ? safeIntendedRedirect(fromState(location.state), session.role)
          : workspaceRedirect(fromState(location.state));
        const state = location.state as { bookingIntent?: unknown } | null;
        void navigate(target, {
          replace: true,
          state:
            !isMockApi &&
            target === fromState(location.state) &&
            target.startsWith("/trips")
              ? { bookingIntent: state?.bookingIntent }
              : null,
        });
      }
    },
    onSettled: (_data, error) => {
      if (error) ref.current.locked = false;
    },
  });
  return {
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
    submit: (action: Action) => {
      const state = ref.current;
      if (!state.mounted || state.locked) return;
      state.locked = true;
      state.action = action;
      state.controller = new AbortController();
      mutation.mutate();
    },
  };
}
