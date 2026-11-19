import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  type PropsWithChildren,
  type ReactElement,
  useState,
  useEffect,
} from "react";
import { isMockApi } from "@/shared/api/config";
import { SessionLifecycle } from "@/features/auth/components/SessionLifecycle";
import { ApiError } from "@/shared/api/error";
function DemoHistoryLifecycle({ client }: { client: QueryClient }): null {
  useEffect(() => {
    if (
      !isMockApi ||
      import.meta.env.VITE_APP_TARGET !== "customer" ||
      import.meta.env.VITE_DEMO_HISTORY === "off"
    )
      return;
    let active = true;
    void import("@/mocks/seedCustomerHistory")
      .then((module) => module.seedCustomerHistory())
      .then(() => {
        if (active)
          return client.invalidateQueries({ queryKey: ["account-tickets"] });
      })
      .catch(() => {
        // An optional demo archive must never prevent navigation or hydration.
        // Its idempotent seed resumes on the next mount/reload.
      });
    return () => {
      active = false;
    };
  }, [client]);
  return null;
}

export function AppProviders({ children }: PropsWithChildren): ReactElement {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failures, error) =>
              failures < 1 &&
              !(error instanceof ApiError && error.status === 401),
            staleTime: 30_000,
          },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {!isMockApi && <SessionLifecycle />}
      <DemoHistoryLifecycle client={queryClient} />
      {children}
    </QueryClientProvider>
  );
}
