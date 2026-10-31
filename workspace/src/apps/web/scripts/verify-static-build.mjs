import assert from "node:assert/strict";
import { createServer } from "node:http";
import { access, readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import process from "node:process";
import { pathToFileURL, URL } from "node:url";

import { chromium } from "@playwright/test";

const BUILD_DIRECTORY = resolve("build/client");
const SPA_FALLBACK_FILENAME = "__spa-fallback.html";

const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".woff2", "font/woff2"],
]);

async function requireFile(path, message) {
  try {
    await access(path);
  } catch {
    throw new Error(`${message}: ${path}`);
  }
}

export async function verifyStaticBuild(buildDirectory = BUILD_DIRECTORY) {
  const homePath = resolve(buildDirectory, "index.html");
  const fallbackPath = resolve(buildDirectory, SPA_FALLBACK_FILENAME);
  await requireFile(homePath, "Missing prerendered home document");
  await requireFile(fallbackPath, "Missing SPA fallback document");
  return { fallbackPath, homePath };
}

async function resolveStaticPath(buildDirectory, fallbackPath, pathname) {
  if (pathname === "/") return resolve(buildDirectory, "index.html");
  const candidate = resolve(buildDirectory, `.${pathname}`);
  const root = `${resolve(buildDirectory)}${sep}`;
  if (!candidate.startsWith(root)) return fallbackPath;
  try {
    return (await stat(candidate)).isFile() ? candidate : fallbackPath;
  } catch {
    return fallbackPath;
  }
}

async function respond(request, response, buildDirectory, fallbackPath) {
  try {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const filePath = await resolveStaticPath(
      buildDirectory,
      fallbackPath,
      pathname,
    );
    response.writeHead(200, {
      "Content-Type":
        CONTENT_TYPES.get(extname(filePath)) ?? "application/octet-stream",
    });
    response.end(await readFile(filePath));
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(
      error instanceof Error ? error.message : "Static server error",
    );
  }
}

async function startStaticServer(buildDirectory, fallbackPath) {
  const server = createServer((request, response) => {
    void respond(request, response, buildDirectory, fallbackPath);
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  assert(address && typeof address === "object", "Static server did not bind");
  return {
    close: () => new Promise((resolveClose) => server.close(resolveClose)),
    origin: `http://127.0.0.1:${address.port}`,
  };
}

export async function verifyRoute(page, origin, route) {
  const response = await page.goto(`${origin}${route.path}`, {
    waitUntil: "domcontentloaded",
  });
  assert(
    response && response.status() === 200,
    `${route.path} did not return 200`,
  );
  await page.waitForURL(`${origin}${route.expectedPath}`);
  await page.getByRole("heading", { name: route.heading }).waitFor();
  assert(
    !new URL(page.url()).pathname.includes("404"),
    `${route.path} rendered a server 404`,
  );
  process.stdout.write(
    `Verified deep link ${route.path} -> ${route.expectedPath}\n`,
  );
}

export async function verifyDeepLinks(buildDirectory, fallbackPath) {
  const server = await startStaticServer(buildDirectory, fallbackPath);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const routes = [
      {
        expectedPath: "/trips",
        heading: "Thông tin tìm kiếm chưa hợp lệ",
        path: "/trips",
      },
      {
        expectedPath: "/trips?reason=expired",
        heading: "Phiên giữ chỗ đã hết hạn",
        path: "/booking/invalid-session/seats",
      },
      {
        expectedPath: "/login",
        heading: "Hành trình đang chờ bạn",
        path: "/admin/bookings",
      },
    ];
    routes.push(
      {
        expectedPath: "/explore",
        heading: "Mỗi hành trình bắt đầu từ một điểm hẹn.",
        path: "/explore",
      },
      {
        expectedPath: "/explore/lam-dong",
        heading: "Điểm đón và điểm trả",
        path: "/explore/lam-dong",
      },
    );
    for (const route of routes) await verifyRoute(page, server.origin, route);
  } finally {
    await browser.close();
    await server.close();
  }
}

async function main() {
  const artifacts = await verifyStaticBuild();
  process.stdout.write(
    `Verified prerendered home ${artifacts.homePath} and SPA fallback ${artifacts.fallbackPath}\n`,
  );
  await verifyDeepLinks(BUILD_DIRECTORY, artifacts.fallbackPath);
}

const entryPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === entryPath) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
