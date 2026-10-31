import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { verifyRoute, verifyStaticBuild } from "./verify-static-build.mjs";

async function withBuildDirectory(run) {
  const directory = await mkdtemp(join(tmpdir(), "blue-static-build-"));
  await mkdir(directory, { recursive: true });
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("verifyStaticBuild reports a missing prerendered home document", async () => {
  await withBuildDirectory(async (directory) => {
    await writeFile(join(directory, "__spa-fallback.html"), "fallback");

    await assert.rejects(
      verifyStaticBuild(directory),
      /Missing prerendered home document: .*index\.html/,
    );
  });
});

test("verifyStaticBuild reports a missing React Router SPA fallback", async () => {
  await withBuildDirectory(async (directory) => {
    await writeFile(join(directory, "index.html"), "home");

    await assert.rejects(
      verifyStaticBuild(directory),
      /Missing SPA fallback document: .*__spa-fallback\.html/,
    );
  });
});

test("verifyStaticBuild accepts the documented React Router output", async () => {
  await withBuildDirectory(async (directory) => {
    await writeFile(join(directory, "index.html"), "home");
    await writeFile(join(directory, "__spa-fallback.html"), "fallback");

    const result = await verifyStaticBuild(directory);

    assert.equal(result.homePath, join(directory, "index.html"));
    assert.equal(result.fallbackPath, join(directory, "__spa-fallback.html"));
  });
});

function loadedPage(url) {
  return {
    goto: async () => ({ status: () => 200 }),
    waitForURL: async () => {},
    getByRole: () => ({ waitFor: async () => {} }),
    url: () => url,
  };
}

test("verifyRoute accepts a valid route when only the port contains 404", async () => {
  await verifyRoute(
    loadedPage("http://127.0.0.1:40401/trips"),
    "http://127.0.0.1:40401",
    {
      path: "/trips",
      expectedPath: "/trips",
      heading: "Thông tin tìm kiếm chưa hợp lệ",
    },
  );
});

test("verifyRoute still rejects a 404 pathname", async () => {
  await assert.rejects(
    verifyRoute(
      loadedPage("http://127.0.0.1:5173/404"),
      "http://127.0.0.1:5173",
      {
        path: "/trips",
        expectedPath: "/trips",
        heading: "Thông tin tìm kiếm chưa hợp lệ",
      },
    ),
    /rendered a server 404/,
  );
});
