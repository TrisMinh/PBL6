import { spawn } from "node:child_process";
import process from "node:process";
import console from "node:console";
import { fileURLToPath, URL } from "node:url";
import { resolve } from "node:path";
import { cp, mkdir } from "node:fs/promises";
const [target, command = "dev", ...extra] = process.argv.slice(2);
const ports = { customer: 5173, operator: 5174, admin: 5175 };
if (
  !(target in ports) ||
  !["dev", "build", "preview", "typecheck"].includes(command)
) {
  throw new Error(
    "Usage: portal.mjs customer|operator|admin dev|build|preview|typecheck",
  );
}
const cwd = fileURLToPath(new URL("..", import.meta.url));
const env = {
  ...process.env,
  BLUE_APP_TARGET: target,
};
function run(file, args) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [resolve(cwd, file), ...args], {
      cwd,
      env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? done() : reject(new Error(`${command} exited with ${code}`)),
    );
    process.once("SIGINT", () => child.kill("SIGINT"));
    process.once("SIGTERM", () => child.kill("SIGTERM"));
  });
}
if (command === "preview") {
  await run("scripts/serve-portal.mjs", [
    target,
    String(ports[target]),
    ...extra,
  ]);
} else if (command === "typecheck") {
  await run("node_modules/@react-router/dev/bin.cjs", ["typegen"]);
  await run("node_modules/typescript/bin/tsc", ["--noEmit"]);
} else {
  await run(
    "node_modules/@react-router/dev/bin.cjs",
    command === "dev"
      ? [
          "dev",
          "--host",
          "127.0.0.1",
          "--port",
          String(ports[target]),
          "--strictPort",
          ...extra,
        ]
      : ["build", ...extra],
  );
  if (command === "build") {
    const destination = resolve(cwd, `../${target}-web/dist/client`);
    await mkdir(destination, { recursive: true });
    await cp(resolve(cwd, `build/${target}/client`), destination, {
      recursive: true,
    });
    console.log(`Built independent ${target} web at ${destination}`);
  }
}
