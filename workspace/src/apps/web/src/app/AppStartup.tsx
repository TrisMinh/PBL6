import {
  useEffect,
  useState,
  type PropsWithChildren,
  type ReactElement,
} from "react";
import { BrandLoading } from "@/shared/ui/BrandLogo/BrandLoading";
import { hasSeenStartup, STARTUP_SESSION_KEY } from "./startupSession";
import "./AppStartup.css";

const DISPLAY_MS = 2000;
const EXIT_MS = 240;
type Phase = "loading" | "leaving" | "ready";

export function StartupScreen({
  leaving = false,
}: {
  leaving?: boolean;
}): ReactElement {
  return (
    <div className="app-startup__screen" data-leaving={leaving}>
      <BrandLoading title="Đang mở BLUE" />
    </div>
  );
}

export function AppStartup({ children }: PropsWithChildren): ReactElement {
  const [alreadySeen] = useState(hasSeenStartup);
  const [phase, setPhase] = useState<Phase>("loading");
  useEffect(() => {
    try {
      window.sessionStorage.setItem(STARTUP_SESSION_KEY, "1");
    } catch {
      // The current page can still finish loading when storage is unavailable.
    }
    const leave = window.setTimeout(
      () => setPhase(alreadySeen ? "ready" : "leaving"),
      alreadySeen ? 0 : DISPLAY_MS,
    );
    const finish = window.setTimeout(
      () => setPhase("ready"),
      alreadySeen ? 0 : DISPLAY_MS + EXIT_MS,
    );
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(finish);
    };
  }, [alreadySeen]);

  return (
    <>
      <div
        className="app-startup__content"
        data-loading={phase === "loading"}
        inert={phase !== "ready"}
        aria-hidden={phase !== "ready" || undefined}
      >
        {children}
      </div>
      {phase !== "ready" && <StartupScreen leaving={phase === "leaving"} />}
    </>
  );
}
