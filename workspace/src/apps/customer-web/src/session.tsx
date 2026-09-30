import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { browserSession, createClient, type Session } from "@busticket/api-client";

const SessionContext = createContext<{
  session: Session | null;
  api: ReturnType<typeof createClient>;
  setSession: (session: Session | null) => void;
} | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(() => browserSession.read());
  const api = useMemo(
    () =>
      createClient({
        session: {
          read: () => browserSession.read(),
          write: (next) => {
            browserSession.write(next);
            setSessionState(next);
          },
        },
      }),
    [],
  );
  return (
    <SessionContext.Provider
      value={{
        session,
        api,
        setSession: (next) => {
          browserSession.write(next);
          setSessionState(next);
        },
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("SessionProvider missing");
  return value;
}
