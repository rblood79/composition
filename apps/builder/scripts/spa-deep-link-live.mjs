#!/usr/bin/env node
/**
 * GitHub Pages 깊은 링크 live — production 빌드를 Pages 처럼 제공하고 (있는 파일은 200,
 * 없는 경로는 `404.html` 을 404 상태로) 주소창 직접 진입을 확인한다.
 *
 *   node apps/builder/scripts/spa-deep-link-live.mjs --dist <빌드 outDir> [--no-fallback] [--browser chromium|webkit]
 *
 * `--no-fallback` 은 대조군 — 404.html 이 없는 지금의 Pages 처럼 없는 경로에 빈 404 를 준다.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { chromium, webkit } from "playwright";
import { loadStorageState } from "./perf-baseline.mjs";

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const DIST = resolve(arg("--dist") ?? "apps/builder/dist");
const FALLBACK = !argv.includes("--no-fallback");
const BROWSER = arg("--browser") === "webkit" ? webkit : chromium;
const BASE = "/composition/";

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
};

const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (!path.startsWith(BASE)) {
    res.writeHead(404).end();
    return;
  }
  let file = normalize(join(DIST, path.slice(BASE.length)));
  if (existsSync(file) && statSync(file).isDirectory())
    file = join(file, "index.html");
  if (file.startsWith(DIST) && existsSync(file)) {
    res.writeHead(200, {
      "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    });
    res.end(readFileSync(file));
    return;
  }
  const fallback = join(DIST, "404.html");
  if (FALLBACK && existsSync(fallback)) {
    res.writeHead(404, { "content-type": "text/html" });
    res.end(readFileSync(fallback));
    return;
  }
  res.writeHead(404, { "content-type": "text/html" }).end("<h1>404</h1>");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

// 인증 (localStorage) 을 이 서버 origin 으로 옮긴다.
const auth = loadStorageState(
  resolve("apps/builder/scripts/.auth-session.json"),
);
const storageState = {
  cookies: [],
  origins: auth.origins.map((o) => ({ ...o, origin: ORIGIN })),
};

const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass });
  process.stdout.write(
    `${pass ? "✓" : "✗"} ${name} ${JSON.stringify(detail)}\n`,
  );
};

const CANVAS = '[data-testid="skia-canvas-unified"]';
const browser = await BROWSER.launch();
try {
  const context = await browser.newContext({ storageState });
  const errors = [];
  context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));

  // 1) 루트에서 들어가 프로젝트를 만든다 (루트는 index.html 200 — 대조군에서도 동작).
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${ORIGIN}${BASE}`, { waitUntil: "networkidle" });
  const rootPath = new URL(page.url()).pathname;
  await page.goto(`${ORIGIN}${BASE}dashboard`, { waitUntil: "networkidle" });
  const dashboard = {
    path: new URL(page.url()).pathname,
    createVisible: await page
      .locator("button.dashboard-create-button")
      .first()
      .isVisible()
      .catch(() => false),
  };
  record(
    "D1 주소창 /composition/dashboard 직접 진입 → 대시보드",
    dashboard.createVisible,
    { rootPath, ...dashboard },
  );

  let projectUrl = null;
  if (dashboard.createVisible) {
    await page.locator("button.dashboard-create-button").first().click();
    const input = page.locator("#new-project-name");
    await input.waitFor({ state: "visible", timeout: 10_000 });
    await input.fill(`deep-link-${Date.now()}`);
    await input.press("Enter");
    await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60_000 });
    await page.locator(CANVAS).waitFor({ timeout: 90_000 });
    projectUrl = page.url();
  }

  // 2) 새 탭 · 주소창으로 builder URL 에 바로 들어간다.
  const direct = await context.newPage();
  direct.on("pageerror", (e) => errors.push(e.message));
  const target = projectUrl ?? `${ORIGIN}${BASE}builder/unknown-project`;
  const response = await direct.goto(target, { waitUntil: "networkidle" });
  const booted = await direct
    .locator(CANVAS)
    .waitFor({ timeout: 90_000 })
    .then(() => true)
    .catch(() => false);
  record(
    "B1 주소창 /composition/builder/<id> 직접 진입 → 캔버스 부팅",
    booted,
    {
      status: response?.status(),
      path: new URL(direct.url()).pathname,
    },
  );

  // 3) builder 에서 새로고침 — 옛 탭 복구 (ADR-244) 가 기대는 동작.
  if (booted) {
    await direct.reload({ waitUntil: "networkidle" });
    const reloaded = await direct
      .locator(CANVAS)
      .waitFor({ timeout: 90_000 })
      .then(() => true)
      .catch(() => false);
    record("B2 builder 새로고침 → 같은 프로젝트로 다시 부팅", reloaded, {
      path: new URL(direct.url()).pathname,
    });
  }
  record("E0 page error 0", errors.length === 0, errors.slice(0, 5));
} finally {
  await browser.close();
  server.close();
}
const failed = results.filter((r) => !r.pass).length;
process.stdout.write(
  `\n[spa-deep-link ${FALLBACK ? "fallback" : "no-fallback"}] ${results.length - failed}/${results.length}\n`,
);
process.exit(failed ? 1 : 0);
