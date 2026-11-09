/**
 * ADR-305 G4 — production `dist` 를 배포 base 아래 정적 서버로 띄워 Publish 별도 진입을 확인한다.
 *
 *   node apps/builder/scripts/adr305-g4-dist.mjs <distDir> <outDir> [port]
 *
 * 서버 = gh-pages 형태: `/composition/` → dist, 디렉터리는 `index.html`, 없는 경로는 404 + `404.html`
 * (rewrite 없음). 확인:
 *   (a) `/composition/publish/?project=…` 가 200 으로 `publish/index.html` · 새로고침 뒤에도 같은 문서
 *   (c) 빌더 (대시보드 → 새 프로젝트 — Body 노드) 에서 헤더 「Preview」 → 새 탭이 base 를 포함한
 *       `/composition/publish/?project=blob:…` 로 가서 catalog 노드를 그린다 · 그 문서에 빌더 시트 0
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { extname, join, normalize } from "node:path";

const [dist, outDir, portArg] = process.argv.slice(2);
const port = Number(portArg ?? 4305);
mkdirSync(outDir, { recursive: true });
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".png": "image/png",
};
const log = [];
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  let status = 200;
  let file = null;
  if (url.pathname.startsWith("/composition/")) {
    const rel = normalize(
      decodeURIComponent(url.pathname.slice("/composition/".length)),
    );
    const p = join(dist, rel);
    if (existsSync(p) && statSync(p).isFile()) file = p;
    else if (existsSync(join(p, "index.html")) && url.pathname.endsWith("/"))
      file = join(p, "index.html");
  }
  if (!file) {
    status = 404;
    file = join(dist, "404.html");
  }
  log.push(`${status} ${url.pathname}`);
  res.writeHead(status, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
  });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(port, r));
const base = `http://localhost:${port}/composition`;
const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(
    `${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${JSON.stringify(detail).slice(0, 200)}` : ""}`,
  );
};
const browser = await chromium.launch({ channel: "chrome", headless: false });
try {
  // (a)
  const r = await fetch(`${base}/publish/?project=x`);
  const body = await r.text();
  check(
    "(a) /composition/publish/?project= → 200 publish 진입",
    r.status === 200 && body.includes("composition Publish"),
    { status: r.status },
  );
  const plain = await browser.newPage();
  await plain.goto(`${base}/publish/?project=x`);
  const t1 = await plain.title();
  await plain.reload();
  check(
    "(a) 새로고침 뒤 같은 문서 · query 보존",
    (await plain.title()) === t1 &&
      t1 === "composition Publish" &&
      plain.url().endsWith("/publish/?project=x"),
    { title: t1, url: plain.url() },
  );
  await plain.close();

  // (c)
  const auth = JSON.parse(
    readFileSync("apps/builder/scripts/.auth-session.json", "utf8"),
  );
  auth.origins = auth.origins.map((o) => ({
    ...o,
    origin: `http://localhost:${port}`,
  }));
  const context = await browser.newContext({
    storageState: auth,
    viewport: { width: 1600, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/dashboard`);
  await page
    .getByRole("button", { name: "New project", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Project name" })
    .fill("ADR305 G4 dist");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.waitForURL(/\/builder\//);
  await page.waitForFunction(
    () =>
      window.__COMPOSITION_CATALOG__?.workspace ??
      document.querySelector("canvas"),
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);
  const docAttr = await page.evaluate(
    () => document.documentElement.dataset.document,
  );
  check('빌더 문서 <html data-document="builder">', docAttr === "builder", {
    docAttr,
  });
  const [pub] = await Promise.all([
    context.waitForEvent("page"),
    page.getByRole("button", { name: "Preview", exact: true }).click(),
  ]);
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.waitForURL(/\/publish\//, { timeout: 20000 });
  await pub.waitForFunction(
    () => document.querySelectorAll("[data-catalog-id]").length > 0,
    null,
    { timeout: 20000 },
  );
  const url = pub.url();
  check(
    "(c) 빌더 → Publish 가 base 포함 /composition/publish/?project=blob: 로",
    /\/composition\/publish\/\?project=blob%3A|\/composition\/publish\/\?project=blob:/.test(
      url,
    ),
    { url: url.replace(/blob[^&]+/, "blob…") },
  );
  const sheets = await pub.evaluate(() =>
    [...document.querySelectorAll("link[rel=stylesheet], style")].map(
      (s) => s.getAttribute("href") ?? `style#${s.id}`,
    ),
  );
  const text = await pub.evaluate(() =>
    [...document.styleSheets]
      .map((s) => {
        try {
          return [...s.cssRules].map((r) => r.cssText).join("\n");
        } catch {
          return "";
        }
      })
      .join("\n"),
  );
  check(
    "(c) Publish 문서에 빌더 시트 0 (builder-system · Tailwind · 고정 시트 예외)",
    !/data-builder-theme|--tw-|publish-app \*|builder-catalog/.test(text),
    { sheets },
  );
  await pub.screenshot({ path: join(outDir, "publish-dist.png") });
  await pub.close();
  check("console · page 오류 0", errors.length === 0, errors);
} catch (e) {
  check("G4 dist 실행", false, String(e).split("\n")[0]);
} finally {
  await browser.close();
  server.close();
}
writeFileSync(
  join(outDir, "g4-dist.json"),
  JSON.stringify(
    {
      results,
      log: log.filter((l) => !l.startsWith("200 /composition/assets")),
    },
    null,
    1,
  ),
);
process.exitCode = results.every((r) => r.pass) ? 0 : 1;
