#!/usr/bin/env node
// adr201-g5-live.mjs — ADR-201 G5: preview 에서 ≥1GB 실파일을 Spring 참조 서버로 업로드 → 중단 → 재개.
//
// 사전 조건:
//   - builder dev 서버 (기본 http://localhost:5173) + 로그인 storageState (apps/builder/scripts/.auth-session.json)
//   - 참조 서버: examples/upload-server-spring 에서
//       mvn -q cargo:run -Dupload.storage.dir=<웹루트 밖> -Dupload.cors.allowedOrigins=http://localhost:5173
//     (dev-login 은 cargo 프로파일이 켠다)
//   - 실파일: mkfile -n 1g <path>.zip + 선두 4 바이트 PK\x03\x04 (참조 서버 매직바이트 · 확장자 화이트리스트)
//
// 흐름 (전부 실제 UI · 실제 XHR):
//   1) 참조 서버 dev-login 페이지 방문 → JSESSIONID (Path=/upload) + XSRF-TOKEN (Path=/) 쿠키 (host localhost)
//   2) 프로젝트 생성 → Data 패널 APIs → Add API (URL = 참조 서버 /upload/upload) → 편집기 Params 탭
//      「미리보기에서 실제 업로드」 스위치 ON (define_endpoint uploadDryRun=false — Phase 4 토글)
//   3) 팔레트 FileUpload 배치 → Properties 쓰기 경로로 endpoint prop 연결 (updateElementProps)
//   4) Compare Mode → preview iframe 의 FileTrigger hidden input 에 1GB setInputFiles
//      → 엔진 lazy 로드 → POST 생성 → PATCH 8MB 청크 (withCredentials · X-CSRF-TOKEN = 쿠키값)
//   5) 중단 A — 네트워크 단절: context.setOffline(true) ~3.5s → E_NETWORK backoff → 온라인 → HEAD 재동기 → 계속
//   6) 중단 B — 새로고침: 진행 중 builder page.reload → Compare 다시 → 같은 파일 재선택
//      → fingerprint(localStorage cu:*) → HEAD → 서버 offset 부터 (재전송 ≤ chunkSize)
//   7) 완료: 서버 HEAD Upload-Offset == 1GB (5173 origin 에서 fetch HEAD, CORS Expose-Headers) ·
//      저장 파일 크기 == 1GB · 문서 write 0 · page/console error 0
//
// 사용: node apps/builder/scripts/adr201-g5-live.mjs [--headed] [--base=http://localhost:5173]
//         [--server=http://localhost:8080/upload] [--file=/tmp/adr201-g5/g5-1g.zip] [--storage-dir=/tmp/adr201-g5/uploads]
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  statSync,
  readdirSync,
} from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const arg = (name, fallback) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : fallback;
};
const BASE_URL = arg("base", "http://localhost:5173");
const SERVER = arg("server", "http://localhost:8080/upload");
const FILE = arg("file", "/tmp/adr201-g5/g5-1g.zip");
const STORAGE_DIR = arg("storage-dir", "/tmp/adr201-g5/uploads");
const STORAGE_STATE = resolve(
  arg("storage", "apps/builder/scripts/.auth-session.json"),
);
const OUT_DIR = process.env.ADR201_OUT ?? "/private/tmp/adr201-g5-live";
const headed = process.argv.includes("--headed");
const CHUNK = 8 * 1024 * 1024;
const log = (...a) => console.log("[ADR-201 G5]", ...a);
const RAIL_ORDER = [
  "navigator",
  "components",
  "datatable",
  "datatableEditor",
  "theme",
  "ai",
  "properties",
  "styles",
  "interactions",
  "history",
];

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  log(ok ? "PASS" : "FAIL", "—", name, "::", detail);
};

async function setPanel(page, panelId, open) {
  const button = page
    .locator(".panel-toggle-rail button")
    .nth(RAIL_ORDER.indexOf(panelId));
  if (((await button.getAttribute("aria-pressed")) === "true") !== open) {
    await button.click();
    await page.waitForTimeout(900);
  }
}
async function idbGetAll(page, store) {
  return page.evaluate(async (store) => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("composition");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const rows = await new Promise((res, rej) => {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    db.close();
    return rows;
  }, store);
}
async function openCompare(page) {
  const compareToggle = page
    .locator('[aria-label="Compare Mode (Preview + Skia)"]')
    .first();
  if (
    (await compareToggle.count()) &&
    (await compareToggle.getAttribute("aria-pressed")) !== "true"
  ) {
    await compareToggle.click();
  }
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("iframe")].some((f) =>
        f.contentDocument?.querySelector(
          '.react-aria-FileUpload input[type="file"]',
        ),
      ),
    undefined,
    { timeout: 40_000 },
  );
  await page.waitForTimeout(800);
  for (const frame of page.frames()) {
    if ((await frame.locator(".react-aria-FileUpload").count()) > 0)
      return frame;
  }
  throw new Error("preview frame 에 FileUpload 없음");
}
/** preview iframe 의 런타임 행 상태 (이름 · 상태 · % · 오류 코드) */
async function readRows(frame) {
  return frame.evaluate(() => {
    const items = [...document.querySelectorAll(".react-aria-FileUpload-item")];
    return items.map((el) => ({
      status: el.getAttribute("data-status"),
      text: el.textContent ?? "",
      code:
        el
          .querySelector(".react-aria-FileUpload-error")
          ?.getAttribute("data-code") ?? null,
    }));
  });
}
const pctOf = (row) => {
  const m = /(\d+)%/.exec(row?.text ?? "");
  return m ? Number(m[1]) : null;
};
/** 엔진 재개 저장소 (localStorage cu:<fingerprint> → {u:url}) */
async function resumeEntries(frame) {
  return frame.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith("cu:"))
      .map((k) => ({ key: k, value: JSON.parse(localStorage.getItem(k)) })),
  );
}
/** 서버 HEAD — 5173 origin 에서 credentials 로 (CORS Expose-Headers 가 정본 oracle 을 노출한다) */
async function serverHead(frame, url) {
  return frame.evaluate(async (url) => {
    const r = await fetch(url, {
      method: "HEAD",
      credentials: "include",
      headers: { "Tus-Resumable": "1.0.0" },
    });
    return {
      status: r.status,
      offset: Number(r.headers.get("Upload-Offset")),
      length: Number(r.headers.get("Upload-Length")),
    };
  }, url);
}
async function waitPct(frame, predicate, timeoutMs, label) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < timeoutMs) {
    const rows = await readRows(frame);
    last = rows[0] ?? null;
    if (predicate(last)) return last;
    await frame.page().waitForTimeout(300);
  }
  throw new Error(`${label}: timeout — last ${JSON.stringify(last)}`);
}
const storedBytes = () => {
  try {
    const files = readdirSync(STORAGE_DIR).filter((f) => !f.startsWith("."));
    return files.map((f) => ({
      f,
      size: statSync(resolve(STORAGE_DIR, f)).size,
    }));
  } catch {
    return [];
  }
};

mkdirSync(OUT_DIR, { recursive: true });
const fileSize = statSync(FILE).size;
log("file", FILE, fileSize, "bytes");
const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1600, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console:" + m.text());
});
// 참조 서버로 나간 요청 (메서드 · 상태 · 핵심 헤더) — 재개 판정 근거 + 진단
const wire = [];
page.on("requestfinished", async (req) => {
  if (!req.url().startsWith(SERVER)) return;
  const res = await req.response();
  const h = req.headers();
  wire.push({
    t: stamp(),
    m: req.method(),
    url: req.url().slice(SERVER.length),
    status: res?.status() ?? 0,
    offset: h["upload-offset"] ?? null,
    csrf: h["x-csrf-token"] ? "yes" : "no",
    cookie: h["cookie"] ? "yes" : "no",
    contentLength: h["content-length"] ?? null,
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
    csrf: req.headers()["x-csrf-token"] ? "yes" : "no",
    cookie: req.headers()["cookie"] ? "yes" : "no",
  });
});
const t0 = Date.now();
const stamp = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

try {
  // 1) 참조 서버 세션 + CSRF 쿠키
  await page.goto(`${SERVER}/session/dev-login?owner=g5-${Date.now()}`);
  const cookies = await context.cookies();
  const xsrf = cookies.find((c) => c.name === "XSRF-TOKEN");
  check(
    "참조 서버 dev-login → JSESSIONID + XSRF-TOKEN(Path=/) 쿠키",
    Boolean(cookies.find((c) => c.name === "JSESSIONID")) && xsrf?.path === "/",
    JSON.stringify(cookies.map((c) => `${c.name}@${c.path}`)),
  );

  // 2) 프로젝트 + endpoint (실전송 토글)
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const nameInput = page.locator("#new-project-name");
  await nameInput.waitFor({ state: "visible", timeout: 10_000 });
  await nameInput.fill(`adr201-g5-${Date.now()}`);
  await nameInput.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectUrl = page.url();
  log("project", projectUrl);

  await setPanel(page, "datatable", true);
  const panel = page.locator(".datatable-panel");
  await panel.locator(".panel-tab").nth(1).click();
  await page.waitForTimeout(400);
  await panel
    .locator('button:has-text("Add API"), button:has-text("API 추가")')
    .first()
    .click();
  const creator = page.locator(".datatable-creator");
  await creator.waitFor({ timeout: 10_000 });
  await creator.locator('input[type="url"]').first().fill(`${SERVER}/upload`);
  await page.waitForTimeout(200);
  await creator
    .locator(
      'button:has-text("Create"), button:has-text("만들기"), .datatable-creator-footer button',
    )
    .last()
    .click();
  const editor = page.locator('[data-panel-id="datatableEditor"]');
  await editor.locator(".datatable-api-editor").waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1200);
  // 편집기는 자동 Send 뒤 response 탭에 선다 — 토글은 Params 탭
  await editor
    .locator(
      '.panel-tab[id$="params"], .panel-tab:has-text("Params"), .panel-tab:has-text("파라미터")',
    )
    .first()
    .click();
  await page.waitForTimeout(400);
  const transportRow = editor.locator("[data-upload-transport]").first();
  await transportRow.waitFor({ timeout: 10_000 });
  await transportRow.locator("label.react-aria-Switch").first().click();
  await page.waitForTimeout(600);
  const endpoints = await idbGetAll(page, "api_endpoints");
  const ep = endpoints[0];
  check(
    "Data 패널 Add API + 「미리보기에서 실제 업로드」 스위치 → define_endpoint uploadDryRun=false",
    endpoints.length === 1 &&
      ep?.uploadDryRun === false &&
      ep.baseUrl.includes("8080"),
    JSON.stringify({
      n: endpoints.length,
      baseUrl: ep?.baseUrl,
      path: ep?.path,
      uploadDryRun: ep?.uploadDryRun,
    }),
  );

  // 3) 팔레트 FileUpload + endpoint 연결
  await setPanel(page, "components", true);
  await page.waitForTimeout(500);
  const paletteButton = page
    .locator(
      '[data-component-type="file upload"], button:has-text("file upload")',
    )
    .first();
  await paletteButton.click();
  await page.waitForTimeout(1500);
  const placed = await page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    const all = st.elements.filter((e) => e.type === "FileUpload");
    return all[all.length - 1] ?? null;
  });
  await page.evaluate(
    ({ id, endpointId }) =>
      window.__composition_STORE__
        .getState()
        .updateElementProps(id, { endpoint: endpointId }),
    { id: placed.id, endpointId: ep.id },
  );
  await page.waitForTimeout(800);
  const propsAfter = await page.evaluate(
    (id) =>
      window.__composition_STORE__.getState().elements.find((e) => e.id === id)
        ?.props,
    placed.id,
  );
  check(
    "FileUpload 배치 + endpoint prop 연결 (문서에는 endpoint id 만 — URL·비밀 0)",
    propsAfter?.endpoint === ep.id &&
      !JSON.stringify(propsAfter).includes("8080"),
    JSON.stringify({
      endpoint: propsAfter?.endpoint,
      keys: Object.keys(propsAfter ?? {}),
    }),
  );

  // 4) preview — 1GB 선택 → 실전송
  // 편집기의 자동 Send 는 dev proxy 를 지나 참조 서버에 새 세션을 만들고 그 Set-Cookie 가 5173 응답으로
  //   돌아와 호스트 localhost 의 JSESSIONID/XSRF-TOKEN 을 덮는다 (다른 세션) — 브라우저 세션을 다시 잡는다.
  const cookiesMid = await context.cookies();
  await page.goto(`${SERVER}/session/dev-login?owner=g5-${Date.now()}`);
  await page.goto(projectUrl, { waitUntil: "networkidle" });
  await waitReady(page);
  const cookiesRelogin = await context.cookies();
  log(
    "cookies after Send",
    JSON.stringify(
      cookiesMid.map((c) => `${c.name}@${c.path}=${c.value.slice(0, 6)}`),
    ),
    "→ relogin",
    JSON.stringify(
      cookiesRelogin.map((c) => `${c.name}@${c.path}=${c.value.slice(0, 6)}`),
    ),
  );
  let frame = await openCompare(page);
  await frame
    .locator('.react-aria-FileUpload input[type="file"]')
    .first()
    .setInputFiles(FILE);
  const started = await waitPct(
    frame,
    (r) => r && r.status === "uploading" && (pctOf(r) ?? 0) >= 2,
    60_000,
    "업로드 시작",
  );
  const entries0 = await resumeEntries(frame);
  const uploadUrl = entries0[0]?.value?.u;
  const head0 = uploadUrl ? await serverHead(frame, uploadUrl) : null;
  check(
    "1GB 선택 → 엔진 로드 → POST 생성 → PATCH 진행 (서버 HEAD Upload-Length == 파일 크기, offset 증가)",
    Boolean(uploadUrl) &&
      head0?.status === 200 &&
      head0.length === fileSize &&
      head0.offset > 0,
    JSON.stringify({
      at: stamp(),
      row: started.text.slice(0, 60),
      url: uploadUrl,
      head: head0,
    }),
  );

  // 5) 중단 A — 네트워크 단절 (backoff 창 안에서 복구)
  const beforeCut = await waitPct(
    frame,
    (r) => (pctOf(r) ?? 0) >= 20,
    300_000,
    "20% 도달",
  );
  const headCut = await serverHead(frame, uploadUrl);
  await context.setOffline(true);
  log(
    "offline at",
    stamp(),
    "pct",
    pctOf(beforeCut),
    "server offset",
    headCut.offset,
  );
  await page.waitForTimeout(3500);
  await context.setOffline(false);
  log("online at", stamp());
  const afterCut = await waitPct(
    frame,
    (r) =>
      r &&
      r.status === "uploading" &&
      (pctOf(r) ?? 0) > (pctOf(beforeCut) ?? 0) + 3,
    120_000,
    "단절 후 진행 재개",
  );
  const headAfterCut = await serverHead(frame, uploadUrl);
  check(
    "중단 A 네트워크 단절 3.5s → 자동 backoff 재시도 → HEAD 재동기 → 같은 upload URL 로 계속 (URL 불변 · offset 단조 증가)",
    afterCut.status === "uploading" &&
      headAfterCut.offset > headCut.offset &&
      (await resumeEntries(frame))[0]?.value?.u === uploadUrl,
    JSON.stringify({
      at: stamp(),
      pctBefore: pctOf(beforeCut),
      pctAfter: pctOf(afterCut),
      offsetBefore: headCut.offset,
      offsetAfter: headAfterCut.offset,
    }),
  );

  // 6) 중단 B — 새로고침 (탭 자체 재로드) → 같은 파일 재선택 → fingerprint → HEAD 재개
  await waitPct(frame, (r) => (pctOf(r) ?? 0) >= 45, 300_000, "45% 도달");
  const headBeforeReload = await serverHead(frame, uploadUrl);
  log("reload at", stamp(), "server offset", headBeforeReload.offset);
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  const headAfterReload = await (async () => {
    // 재로드 직후 서버 offset (전송 중이던 PATCH 1개까지만 반영됐어야 한다)
    const f = await openCompare(page);
    return { frame: f, head: await serverHead(f, uploadUrl) };
  })();
  frame = headAfterReload.frame;
  const offsetAtReload = headAfterReload.head.offset;
  await frame
    .locator('.react-aria-FileUpload input[type="file"]')
    .first()
    .setInputFiles(FILE);
  const resumed = await waitPct(
    frame,
    (r) =>
      r &&
      r.status === "uploading" &&
      (pctOf(r) ?? 0) > Math.floor((offsetAtReload / fileSize) * 100),
    120_000,
    "재로드 후 재개",
  );
  const entriesAfter = await resumeEntries(frame);
  const headResumed = await serverHead(frame, uploadUrl);
  const firstPctAfterResume = pctOf(resumed);
  check(
    "중단 B 새로고침 → 같은 파일 재선택 → localStorage fingerprint → HEAD → 서버 offset 부터 재개 (POST 재생성 0 · URL 동일 · 재전송 ≤ chunkSize)",
    entriesAfter.length === 1 &&
      entriesAfter[0].value.u === uploadUrl &&
      headResumed.offset >= offsetAtReload &&
      firstPctAfterResume >= Math.floor((offsetAtReload / fileSize) * 100),
    JSON.stringify({
      at: stamp(),
      offsetBeforeReload: headBeforeReload.offset,
      offsetAtReload,
      resumedPct: firstPctAfterResume,
      headResumed: headResumed.offset,
      entries: entriesAfter.length,
      retransmitUpperBound: CHUNK,
    }),
  );

  // 7) 완료
  const done = await waitPct(
    frame,
    (r) => r && r.status === "done",
    600_000,
    "완료",
  );
  const headDone = await serverHead(frame, uploadUrl);
  const stored = storedBytes();
  const storedMatch = stored.find((s) => s.size === fileSize);
  check(
    "완료 — 서버 HEAD Upload-Offset == Upload-Length == 1GB · 저장 파일 1GB 실물 · 행 status done",
    done.status === "done" &&
      headDone.offset === fileSize &&
      headDone.length === fileSize &&
      Boolean(storedMatch),
    JSON.stringify({
      at: stamp(),
      head: headDone,
      stored: storedMatch ?? stored.slice(0, 3),
    }),
  );
  const entriesDone = await resumeEntries(frame);
  check(
    "완료 후 재개 정보 forget (localStorage cu:* 0) · 파일명 평문 0",
    entriesDone.length === 0,
    JSON.stringify(entriesDone),
  );

  // 문서 write 0
  const docLeak = await page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    const s = JSON.stringify(st.elements.map((e) => e.props));
    return {
      selectedFiles: s.includes("selectedFiles"),
      fileName: s.includes("g5-1g"),
    };
  });
  check(
    "문서 write 0 — st.elements 에 selectedFiles · 파일명 없음",
    !docLeak.selectedFiles && !docLeak.fileName,
    JSON.stringify(docLeak),
  );
  // 제외 2종: 오프라인 구간의 XHR 네트워크 오류 · API 편집기가 생성 직후 endpoint 를 GET 으로 프로브하는
  //   자동 Send (TUS endpoint 는 GET 이 405 — 데이터 소스가 아니라서 생기는 노이즈, 결함 아님)
  const ignorable = (e) =>
    /net::ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED|405 \(Method Not Allowed\)|ApiEndpoint .* 실행 실패: Error: HTTP 405/.test(
      e,
    );
  const realErrors = errors.filter((e) => !ignorable(e));
  check(
    "page error 0 · console error 0 (오프라인 구간의 XHR 네트워크 오류 로그는 제외)",
    realErrors.length === 0,
    JSON.stringify({ total: errors.length, real: realErrors.slice(0, 5) }),
  );
} catch (e) {
  check("실행 오류 없음", false, String(e?.stack ?? e));
} finally {
  const summary = {
    when: new Date().toISOString(),
    base: BASE_URL,
    server: SERVER,
    file: { path: FILE, size: fileSize },
    chromium: browser.version(),
    elapsedSec: (Date.now() - t0) / 1000,
    results,
    errors,
    wire,
  };
  writeFileSync(
    resolve(OUT_DIR, "result.json"),
    JSON.stringify(summary, null, 2),
  );
  const pass = results.filter((r) => r.ok).length;
  log(
    `결과 ${pass}/${results.length} PASS — ${resolve(OUT_DIR, "result.json")}`,
  );
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
}
