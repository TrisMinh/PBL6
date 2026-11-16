import type { ReactElement, ReactNode } from "react";
import {
  isRouteErrorResponse,
  Links,
  Link,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import { AppProviders } from "@/app/AppProviders";
import { ROUTES } from "@/shared/config/routes";
import { PageState } from "@/shared/ui/PageState/PageState";
import { AppStartup, StartupScreen } from "@/app/AppStartup";
import { STARTUP_BOOTSTRAP_SCRIPT } from "@/app/startupSession";
import "@/styles/app.css";

import type { Route } from "./+types/root";

export const links: Route.LinksFunction = () => [
  {
    rel: "preload",
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
    href: "/fonts/be-vietnam-pro-400-latin.woff2",
  },
  {
    rel: "preload",
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
    href: "/fonts/be-vietnam-pro-400-vietnamese.woff2",
  },
  {
    rel: "preload",
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
    href: "/fonts/be-vietnam-pro-600-latin.woff2",
  },
  {
    rel: "preload",
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
    href: "/fonts/be-vietnam-pro-600-vietnamese.woff2",
  },
];

export function Layout({ children }: { children: ReactNode }): ReactElement {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script
          dangerouslySetInnerHTML={{ __html: STARTUP_BOOTSTRAP_SCRIPT }}
        />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function HydrateFallback(): ReactElement {
  return <StartupScreen />;
}

export default function App(): ReactElement {
  return (
    <AppProviders>
      <AppStartup>
        <Outlet />
      </AppStartup>
    </AppProviders>
  );
}

export function ErrorBoundary({
  error,
}: Pick<Route.ErrorBoundaryProps, "error">): ReactElement {
  const status = isRouteErrorResponse(error) ? error.status : null;
  const title =
    status === 403
      ? "Bạn không có quyền truy cập"
      : status === 404
        ? "Không tìm thấy trang"
        : "Không thể tải trang";
  const description =
    status === 403
      ? "Tài khoản hiện tại không được phép xem nội dung này."
      : status === 404
        ? "Đường dẫn có thể đã thay đổi hoặc không còn tồn tại."
        : "Trang gặp sự cố khi tải. Về trang chủ và thử lại sau.";

  return (
    <main>
      <title>{title} | BLUE</title>
      <meta name="robots" content="noindex, nofollow" />
      <PageState
        title={title}
        description={description}
        action={<Link to={ROUTES.home}>Về trang chủ</Link>}
      />
    </main>
  );
}
