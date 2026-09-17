#!/usr/bin/env node
// adr201-g5-jsp-live.mjs — ADR-201 G5 (JSP 축): 참조 서버에 동봉된 upload.jsp 에서 IIFE
// (`CompositionUpload.create`) 로 ≥1GB 실파일 업로드 → 일시정지/재개 (버튼) → 네트워크 단절 → 완료.
// same-origin (CORS 0 · 쿠키 자동) · CSRF 는 meta 태그 → getHeaders.
//
// 사전: examples/upload-server-spring `mvn package && mvn cargo:run` (JSP·IIFE 는 webapp 에 동봉)
// 사용: node apps/builder/scripts/adr201-g5-jsp-live.mjs [--headed] [--server=http://localhost:8080/upload] [--file=…]
import { mkdirSync, writeFileSync, statSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const arg = (name, fallback) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : fallback;
};
const SERVER = arg("server", "http://localhost:8080/upload");
const FILE = arg("file", "/tmp/adr201-g5/g5-1g.zip");
const STORAGE_DIR = arg("storage-dir", "/tmp/adr201-g5/uploads");
const OUT_DIR = process.env.ADR201_OUT ?? "/private/tmp/adr201-g5-live";
const headed = process.argv.includes("--headed");
const CHUNK = 8 * 1024 * 1024;
const log = (...a) => console.log("[ADR-201 G5 JSP]", ...a);
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  log(ok ? "PASS" : "FAIL", "—", name, "::", detail);
};

mkdirSync(OUT_DIR, { recursive: true });
const fileSize = statSync(FILE).size;
const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({
  viewport: { width: 1200, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console:" + m.text());
});
const t0 = Date.now();
const stamp = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
const wire = [];
page.on("requestfinished", async (req) => {
  if (!req.url().startsWith(SERVER)) return;
  const res = await req.response();
  wire.push({
    t: stamp(),
    m: req.method(),
    url: req.url().slice(SERVER.length),
    status: res?.status() ?? 0,
    csrf: req.headers()["x-csrf-token"] ? "yes" : "no",
    upOffset: res?.headers()["upload-offset"] ?? null,
  });
});
page.on("requestfailed", (req) => {
  if (!req.url().startsWith(SERVER)) return;
  wire.push({
    t: stamp(),
    m: req.method(),
    url: req.url().slice(SERVER.length),
    failed: req.failure()?.errorText ?? "failed",
  });
});

const readItem = () =>
  page.evaluate(() => {
    const li = document.querySelector(".composition-upload-item");
    if (!li) return null;
    const bar = li.querySelector("progress");
    return {
      text: li.textContent ?? "",
      status:
        li.querySelector(".composition-upload-status")?.textContent ?? null,
      value: bar ? Number(bar.value) : null,
      max: bar ? Number(bar.max) : null,
      log: document.getElementById("log")?.textContent ?? "",
    };
  });
const pct = (it) =>
  it && it.max ? Math.floor((it.value / it.max) * 100) : null;
const waitFor = async (pred, timeoutMs, label) => {
  const s = Date.now();
  let last = null;
  while (Date.now() - s < timeoutMs) {
    last = await readItem();
    if (pred(last)) return last;
    await page.waitForTimeout(300);
  }
  throw new Error(`${label}: timeout — last ${JSON.stringify(last)}`);
};
const resumeEntries = () =>
  page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith("cu:"))
      .map((k) => JSON.parse(localStorage.getItem(k))),
  );
const serverHead = (url) =>
  page.evaluate(async (url) => {
    const r = await fetch(url, {
      method: "HEAD",
      credentials: "same-origin",
      headers: { "Tus-Resumable": "1.0.0" },
    });
    return {
      status: r.status,
      offset: Number(r.headers.get("Upload-Offset")),
      length: Number(r.headers.get("Upload-Length")),
    };
  }, url);
const lastLogLine = (it, re) =>
  (it?.log ?? "")
    .split("\n")
    .filter((l) => re.test(l))
    .pop() ?? null;

try {
  await page.goto(`${SERVER}/session/dev-login?owner=jsp-${Date.now()}`);
  await page.goto(`${SERVER}/upload.jsp`, { waitUntil: "networkidle" });
  const boot = await page.evaluate(() => ({
    global: typeof window.CompositionUpload,
    meta:
      document.querySelector('meta[name="_csrf"]')?.getAttribute("content")
        ?.length ?? 0,
    login: document.querySelector(".status code")?.textContent ?? null,
    input: !!document.querySelector('#uploader input[type="file"]'),
    log: document.getElementById("log")?.textContent ?? "",
  }));
  check(
    "upload.jsp — IIFE global CompositionUpload · meta _csrf 토큰 · 로그인 표시 · 파일 input",
    boot.global === "object" &&
      boot.meta > 20 &&
      boot.login?.startsWith("jsp-") &&
      boot.input &&
      boot.log.includes("ready"),
    JSON.stringify(boot),
  );

  await page.locator('#uploader input[type="file"]').setInputFiles(FILE);
  const started = await waitFor((it) => (pct(it) ?? 0) >= 3, 60_000, "시작");
  const url = (await resumeEntries())[0]?.u;
  const head0 = url ? await serverHead(url) : null;
  check(
    "1GB 선택 → POST 생성 (X-CSRF-TOKEN = meta) → PATCH 진행 · 서버 HEAD Upload-Length == 파일 크기",
    Boolean(url) &&
      head0?.status === 200 &&
      head0.length === fileSize &&
      head0.offset > 0,
    JSON.stringify({ at: stamp(), pct: pct(started), url, head: head0 }),
  );

  // 일시정지 / 재개 (JSP 버튼 → queue.pause()/resume())
  await waitFor((it) => (pct(it) ?? 0) >= 15, 300_000, "15%");
  await page.click("#pause");
  await page.waitForTimeout(1500);
  const pausedHead1 = await serverHead(url);
  await page.waitForTimeout(2500);
  const pausedHead2 = await serverHead(url);
  const pausedItem = await readItem();
  await page.click("#resume");
  const resumed = await waitFor(
    (it) => (pct(it) ?? 0) > (pct(pausedItem) ?? 0) + 3,
    120_000,
    "재개",
  );
  check(
    "일시정지 → 서버 offset 정지 (2.5s 동안 증가 0) → 재개 → 같은 URL 로 계속",
    pausedHead1.offset === pausedHead2.offset &&
      /paused|일시정지/.test(pausedItem?.status ?? "") &&
      (await resumeEntries())[0]?.u === url,
    JSON.stringify({
      at: stamp(),
      pausedStatus: pausedItem?.status,
      offsetPaused: pausedHead1.offset,
      offsetStill: pausedHead2.offset,
      resumedPct: pct(resumed),
    }),
  );

  // 네트워크 단절
  await waitFor((it) => (pct(it) ?? 0) >= 40, 300_000, "40%");
  const headCut = await serverHead(url);
  await context.setOffline(true);
  await page.waitForTimeout(3500);
  await context.setOffline(false);
  const afterCut = await waitFor(
    (it) => (pct(it) ?? 0) > Math.floor((headCut.offset / fileSize) * 100) + 3,
    120_000,
    "단절 후 재개",
  );
  const headAfter = await serverHead(url);
  check(
    "네트워크 단절 3.5s → backoff → HEAD 재동기 → 계속 (URL 불변 · offset 단조 증가)",
    headAfter.offset > headCut.offset && (await resumeEntries())[0]?.u === url,
    JSON.stringify({
      at: stamp(),
      offsetBefore: headCut.offset,
      offsetAfter: headAfter.offset,
      pctAfter: pct(afterCut),
    }),
  );

  const done = await waitFor(
    (it) => /done|완료/.test(it?.status ?? ""),
    600_000,
    "완료",
  );
  const headDone = await serverHead(url);
  const stored = readdirSync(STORAGE_DIR)
    .map((f) => ({ f, size: statSync(resolve(STORAGE_DIR, f)).size }))
    .find((s) => s.f === url.split("/").pop());
  check(
    "완료 — 서버 Upload-Offset == Upload-Length == 1GB · 저장 파일 실물 · 항목 완료 · 재개 정보 forget",
    headDone.offset === fileSize &&
      stored?.size === fileSize &&
      (await resumeEntries()).length === 0,
    JSON.stringify({
      at: stamp(),
      head: headDone,
      stored,
      lastLog: lastLogLine(done, /done|완료/),
    }),
  );
  const patches = wire.filter((w) => w.m === "PATCH");
  const posts = wire.filter((w) => w.m === "POST" && w.url === "/upload");
  check(
    "wire — POST 생성 1회 · 204 PATCH ≤ ceil(size / 8MB) (클라이언트가 응답을 못 받은 PATCH 도 서버는 적용할 수 있다 — Upload-Offset 이 진실) · 실패 PATCH ≤ 2 (pause abort + 단절) · 전부 X-CSRF-TOKEN",
    posts.length === 1 &&
      patches.filter((p) => p.status === 204).length <=
        Math.ceil(fileSize / CHUNK) &&
      patches.filter((p) => p.status === 204).length +
        patches.filter((p) => p.failed).length >=
        Math.ceil(fileSize / CHUNK) &&
      patches.every((p) => p.csrf === "yes" || p.failed) &&
      patches.filter((p) => p.failed).length <= 2,
    JSON.stringify({
      posts: posts.length,
      patchOk: patches.filter((p) => p.status === 204).length,
      patchFailed: patches.filter((p) => p.failed).length,
      expected: Math.ceil(fileSize / CHUNK),
    }),
  );
  const real = errors.filter(
    (e) => !/ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED/.test(e),
  );
  check(
    "page error 0 · console error 0 (오프라인 구간 제외)",
    real.length === 0,
    JSON.stringify(real.slice(0, 5)),
  );
} catch (e) {
  check("실행 오류 없음", false, String(e?.stack ?? e));
} finally {
  writeFileSync(
    resolve(OUT_DIR, "result-jsp.json"),
    JSON.stringify(
      {
        when: new Date().toISOString(),
        server: SERVER,
        file: { path: FILE, size: fileSize },
        chromium: browser.version(),
        elapsedSec: (Date.now() - t0) / 1000,
        results,
        errors,
        wire,
      },
      null,
      2,
    ),
  );
  const pass = results.filter((r) => r.ok).length;
  log(
    `결과 ${pass}/${results.length} PASS — ${resolve(OUT_DIR, "result-jsp.json")}`,
  );
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
}
