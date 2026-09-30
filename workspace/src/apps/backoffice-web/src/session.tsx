import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { createClient, createSessionStore, type Session } from "@busticket/api-client";

const store = createSessionStore("busticket.session.backoffice");
const SessionContext = createContext<{
  session: Session | null;
  api: ReturnType<typeof createClient>;
} | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(() => store.read());
  const api = useMemo(
    () =>
      createClient({
        session: {
          read: () => store.read(),
          write: (next) => {
            store.write(next);
            setSessionState(next);
          },
        },
      }),
    [],
  );
  return <SessionContext.Provider value={{ session, api }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("SessionProvider missing");
  return value;
}
