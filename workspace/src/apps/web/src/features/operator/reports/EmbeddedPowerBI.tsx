import { useEffect, useRef, useState, type ReactElement, type Ref } from "react";
import type { Report } from "powerbi-client";
import type { EmbedSession } from "./powerBIEmbed";

export function EmbeddedPowerBI({
  session,
  frameRef,
}: {
  session: EmbedSession;
  frameRef: Ref<HTMLDivElement>;
}): ReactElement {
  const container = useRef<HTMLDivElement>(null);
  const report = useRef<Report>(null);
  const latestToken = useRef(session.token);
  const [failed, setFailed] = useState(false);
  const { reportId, embedUrl, token } = session;

  useEffect(() => {
    latestToken.current = token;
    if (report.current) {
      void report.current.setAccessToken(token).catch(() => setFailed(true));
    }
  }, [token]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let disposed = false;
    let reset: (() => void) | undefined;
    void import("powerbi-client")
      .then(({ service, factories, models }) => {
        if (disposed) return;
        const sdk = new service.Service(factories.hpmFactory, factories.wpmpFactory, factories.routerFactory);
        reset = () => sdk.reset(element);
        const embedded = sdk.embed(element, {
          type: "report",
          id: reportId,
          embedUrl,
          accessToken: latestToken.current,
          tokenType: models.TokenType.Embed,
          permissions: models.Permissions.Read,
          viewMode: models.ViewMode.View,
        }) as Report;
        report.current = embedded;
        embedded.setComponentTitle("Power BI báo cáo nhà xe");
        embedded.on("error", () => setFailed(true));
        embedded.on("loaded", () => setFailed(false));
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      reset?.();
      report.current = null;
    };
  }, [reportId, embedUrl]);

  return (
    <>
      {failed && <p role="alert">Power BI chưa tải được báo cáo. Hãy tải lại trang để thử lại.</p>}
      <div className="revenue-report__power-frame" ref={frameRef}>
        <div ref={container} />
      </div>
    </>
  );
}
