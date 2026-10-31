import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type PropsWithChildren, type ReactElement, useState } from "react";
import { isMockApi } from "@/shared/api/config";
import { useAccountSession } from "@/features/auth/hooks/useAccountSession";

function SessionLifecycle(): null {
  useAccountSession();
  return null;
}

export function AppProviders({ children }: PropsWithChildren): ReactElement {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30_000 },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {!isMockApi && <SessionLifecycle />}
      {children}
    </QueryClientProvider>
  );
}
