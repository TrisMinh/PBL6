/* global console, setTimeout, URL */
// Isolated Docker regression: no published ports or changes to platform containers.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const suffix = Date.now();
const network = `pbl6-proxy-check-${suffix}`;
const proxy = `${network}-proxy`;
const servers = [`${network}-first`, `${network}-second`];
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "pbl6-proxy-check-"));
const config = fileURLToPath(new URL("../docker/nginx.conf", import.meta.url));
const image = "nginxinc/nginx-unprivileged:1.27-alpine";
function docker(...args) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0)
    throw new Error(`docker ${args[0]} failed: ${result.stderr}`);
  return result.stdout.trim();
}
async function reachable(expected) {
  let actual;
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      actual = docker(
        "exec",
        proxy,
        "wget",
        "-qO-",
        "http://127.0.0.1:8080/api/probe?foo=bar",
      );
      if (actual === expected) return;
    } catch {
      /* A DNS cache entry can live for five seconds. */
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.equal(actual, expected);
}
try {
  docker("network", "create", network);
  function upstream(index, ip) {
    const stub = path.join(temp, `upstream-${index}.conf`);
    fs.writeFileSync(
      stub,
      `server { listen 8080; location / { return 200 "${index}|$request_uri"; } }`,
    );
    docker(
      "create",
      "--name",
      servers[index],
      "--network",
      network,
      "--network-alias",
      "gateway",
      ...(ip ? ["--ip", ip] : []),
      image,
    );
    docker("cp", stub, `${servers[index]}:/etc/nginx/conf.d/default.conf`);
    docker("start", servers[index]);
    return docker(
      "inspect",
      "--format",
      "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}",
      servers[index],
    );
  }
  const first = upstream(0);
  docker(
    "run",
    "-d",
    "--name",
    proxy,
    "--network",
    network,
    "--mount",
    `type=bind,src=${config},dst=/etc/nginx/conf.d/default.conf,readonly`,
    image,
  );
  docker("exec", proxy, "nginx", "-t");
  await reachable("0|/api/probe?foo=bar");
  docker("stop", servers[0]);
  const second = upstream(1, first.replace(/\.[0-9]+$/, ".100"));
  assert.notEqual(
    first,
    second,
    "Gateway IP must change for a meaningful regression check",
  );
  await reachable("1|/api/probe?foo=bar");
  console.log(
    "PASS: nginx follows a changed gateway IP without restarting; request path and query preserved",
  );
} finally {
  for (const name of [proxy, ...servers])
    spawnSync("docker", ["rm", "-f", name], { windowsHide: true });
  spawnSync("docker", ["network", "rm", network], { windowsHide: true });
  for (const entry of fs.readdirSync(temp))
    fs.unlinkSync(path.join(temp, entry));
  fs.rmdirSync(temp);
}
