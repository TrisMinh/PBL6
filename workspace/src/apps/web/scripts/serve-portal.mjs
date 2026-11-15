import http from "node:http";
import process from "node:process";
import console from "node:console";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import { resolve, extname, sep } from "node:path";
const [target, port = "5173"] = process.argv.slice(2);
if (!["customer", "operator", "admin"].includes(target))
  throw new Error("Invalid portal");
const root = resolve(
  fileURLToPath(new URL(`../../${target}-web/dist/client/`, import.meta.url)),
);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};
http
  .createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const candidate = resolve(root, `.${path}`);
      const boundary = root.endsWith(sep) ? root : root + sep;
      if (candidate !== root && !candidate.startsWith(boundary)) {
        res.writeHead(403).end();
        return;
      }
      let file = candidate;
      try {
        if (!(await stat(file)).isFile()) file = resolve(file, "index.html");
        await stat(file);
      } catch {
        file = resolve(root, "__spa-fallback.html");
      }
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type": types[extname(file)] ?? "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(body);
    } catch {
      res.writeHead(404).end("Not found");
    }
  })
  .listen(Number(port), "127.0.0.1", () =>
    console.log(`BLUE ${target}: http://127.0.0.1:${port}`),
  );
