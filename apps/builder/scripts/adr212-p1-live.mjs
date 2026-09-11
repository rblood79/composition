#!/usr/bin/env node
// adr212-p1-live.mjs — ADR-212 Phase 1 (표면 골격) live: 실제 빌더 Data 패널에서
//   목록 = RAC GridList 행 (키보드 Enter 로 편집기 열림, lazy chunk) · 배지 (필드·행·소스·
//   사용처·0행·마지막 실행 오류) · 탭 아이콘 모드 (< 360) · role=status 영역 · native dialog 0.
// 사용: node apps/builder/scripts/adr212-p1-live.mjs [--headed]   (dev 서버 5173 · .auth-session.json)
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR212_OUT ?? "/private/tmp/adr212-p1";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[ADR-212 p1 live]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};

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
async function setPanel(page, panelId, open) {
  const button = page
    .locator(".panel-toggle-rail button")
    .nth(RAIL_ORDER.indexOf(panelId));
  if (((await button.getAttribute("aria-pressed")) === "true") !== open) {
    await button.click();
    await page.waitForTimeout(900);
  }
}

async function idbPut(page, store, row) {
  return page.evaluate(
    async ({ store, row }) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("composition");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).put(row);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { store, row },
  );
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
let dialogs = 0;
page.on("dialog", (d) => {
  dialogs += 1;
  d.dismiss().catch(() => {});
});

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr212-p1-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  log("project", projectId);
  const now = new Date().toISOString();
  const usersId = crypto.randomUUID();
  const ordersId = crypto.randomUUID();
  const epId = crypto.randomUUID();
  await idbPut(page, "collections", {
    id: usersId,
    name: "Users",
    project_id: projectId,
    schema: [
      { key: "id", type: "string", required: true },
      { key: "name", type: "string" },
    ],
    mockData: [
      { id: "u1", name: "User 1" },
      { id: "u2", name: "User 2" },
    ],
    useMockData: true,
    created_at: now,
    updated_at: now,
  });
  await idbPut(page, "collections", {
    id: ordersId,
    name: "Orders",
    project_id: projectId,
    schema: [{ key: "id", type: "string", required: true }],
    mockData: [],
    useMockData: false,
    created_at: now,
    updated_at: now,
  });
  await idbPut(page, "api_endpoints", {
    id: epId,
    name: "orders-api",
    project_id: projectId,
    method: "GET",
    baseUrl: BASE_URL,
    path: "/adr212-missing-endpoint",
    headers: [],
    queryParams: [],
    bodyType: "none",
    bodyTemplate: "",
    responseMapping: {},
    targetCollectionId: ordersId,
    targetCollection: "Orders",
    timeout: 5000,
    created_at: now,
    updated_at: now,
  });
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  await setPanel(page, "datatable", true);

  const panel = page.locator(".datatable-panel");
  await panel
    .locator('[role="grid"] [role="row"]')
    .first()
    .waitFor({ timeout: 15_000 });

  // 1) 제목 · GridList · 배지
  const header =
    (await panel.locator(".panel-header").first().textContent()) ?? "";
  record(
    "패널 제목 Data/데이터",
    /^(Data|데이터)/.test(header.trim()),
    header.trim().slice(0, 20),
  );
  const rows = panel.locator('[role="grid"] [role="row"]');
  record(
    "GridList 행 2 (role=row)",
    (await rows.count()) === 2,
    String(await rows.count()),
  );
  const usersRow = rows.filter({ hasText: "Users" });
  const ordersRow = rows.filter({ hasText: "Orders" });
  const usersText = (await usersRow.textContent()) ?? "";
  record(
    "Users 배지: 2 필드 · 2 행 · 샘플 · 사용처 0",
    /2/.test(usersText) &&
      /(샘플|Sample)/.test(usersText) &&
      /(사용처 0|used by 0)/.test(usersText),
    usersText,
  );
  record(
    "Orders: 0 행 → data-empty · orders-api 연결",
    (await ordersRow.getAttribute("data-empty")) === "true" &&
      /orders-api/.test((await ordersRow.textContent()) ?? ""),
    (await ordersRow.textContent()) ?? "",
  );

  // 2) 탭 아이콘 모드 — 기본 폭 233 < 360 이면 라벨은 시각만 숨김 (이름 유지)
  const tabInfo = await panel.evaluate((el) => {
    const width = el.getBoundingClientRect().width;
    const tab = el.querySelector(".panel-tab");
    const label = tab?.querySelector(".panel-tab-label");
    return {
      width,
      labelPos: label ? getComputedStyle(label).position : null,
      name: tab?.textContent,
      title: tab?.querySelector(".panel-tab-icon")?.getAttribute("title"),
    };
  });
  record(
    "탭 아이콘 모드 (< 360): 라벨 visually-hidden · 이름 · title 유지",
    tabInfo.width < 360 &&
      tabInfo.labelPos === "absolute" &&
      !!tabInfo.name &&
      tabInfo.title === tabInfo.name,
    JSON.stringify(tabInfo),
  );
  const wideInfo = await panel.evaluate((el) => {
    const frame = el.closest('[data-panel-id="datatable"]');
    const prev = frame ? frame.style.width : "";
    if (frame) frame.style.width = "420px";
    el.style.width = "420px";
    el.style.maxWidth = "none";
    const label = el.querySelector(".panel-tab .panel-tab-label");
    const pos = label ? getComputedStyle(label).position : null;
    const width = el.getBoundingClientRect().width;
    el.style.width = "";
    el.style.maxWidth = "";
    if (frame) frame.style.width = prev;
    return { pos, width };
  });
  record(
    "탭 폭 420: 라벨 표시",
    wideInfo.pos === "static",
    JSON.stringify(wideInfo),
  );

  // 3) 키보드 열림 — 행 포커스 → Enter → lazy 편집기
  await usersRow.focus();
  await page.keyboard.press("Enter");
  const editorTitle = page
    .locator('[data-panel-id="datatableEditor"] .panel-header')
    .first();
  await editorTitle.waitFor({ timeout: 15_000 });
  await page.waitForFunction(
    () =>
      !document.querySelector(
        '[data-panel-id="datatableEditor"] .panel-lazy-fallback',
      ),
    null,
    { timeout: 15_000 },
  );
  const editorText = (await editorTitle.textContent()) ?? "";
  record(
    "Enter 로 편집기 열림 (lazy chunk 로드, 제목 = Users)",
    /Users/.test(editorText),
    editorText.trim().slice(0, 30),
  );
  const railHasField = await page.evaluate(() =>
    [...document.querySelectorAll(".panel-toggle-rail button")].some((b) =>
      /^(Field|필드)$/.test(b.getAttribute("aria-label") ?? ""),
    ),
  );
  record(
    "필드 패널은 rail 에 없음 (hiddenFromRail)",
    !railHasField,
    String(railHasField),
  );

  // 4) API 탭 — Test 실행 (404 via dev proxy) → 배지에 마지막 실행 · Tables 에 오류
  await panel.locator('.panel-tab[id$="endpoints"], .panel-tab').nth(1).click();
  const apiRow = panel
    .locator('[role="grid"] [role="row"]')
    .filter({ hasText: "orders-api" });
  await apiRow.waitFor({ timeout: 10_000 });
  await apiRow
    .locator('button[aria-label^="Test"], button[aria-label^="테스트"]')
    .click();
  await page.waitForTimeout(3000);
  const apiText = (await apiRow.textContent()) ?? "";
  record(
    "API 배지: method · 마지막 실행 (status · ms · 상대 시각) · 연결 테이블",
    /GET/.test(apiText) &&
      /ms/.test(apiText) &&
      /(방금|just now)/.test(apiText) &&
      /Orders/.test(apiText),
    apiText,
  );
  await panel.locator(".panel-tab").nth(0).click();
  const ordersRow2 = panel
    .locator('[role="grid"] [role="row"]')
    .filter({ hasText: "Orders" });
  await ordersRow2.waitFor({ timeout: 10_000 });
  record(
    "Orders: 마지막 실행 실패 → data-error + 오류 배지",
    (await ordersRow2.getAttribute("data-error")) === "true" &&
      (await ordersRow2.locator(".list-item-badge.error").count()) === 1,
    (await ordersRow2.textContent()) ?? "",
  );

  // 5) 삭제 → ConfirmDialog (native 0) → role=status
  await ordersRow2
    .locator('button[aria-label^="Delete"], button[aria-label^="삭제"]')
    .click();
  const confirm = page.locator('[role="alertdialog"]');
  await confirm.waitFor({ timeout: 5000 });
  await confirm.locator("button").last().click();
  const status = panel.locator('[role="status"]');
  await page.waitForFunction(
    () =>
      /Orders/.test(
        document.querySelector('.datatable-panel [role="status"]')
          ?.textContent ?? "",
      ),
    null,
    { timeout: 5000 },
  );
  record(
    "삭제 후 role=status 문구 (Orders)",
    true,
    (await status.textContent()) ?? "",
  );

  // 6) 생성 진입 6종 — Add Table → 방법 radio 6 → 붙여넣기로 만들기 → 편집기 · status
  const addTable = panel.locator(
    'button:has-text("Add Table"), button:has-text("테이블 추가")',
  );
  await addTable.click();
  const creator = page.locator(".datatable-creator");
  await creator.waitFor({ timeout: 10_000 });
  const radios = creator.locator(".creator-method");
  record(
    "생성 패널: 시작 방법 radio 6",
    (await radios.count()) === 6,
    String(await radios.count()),
  );
  await radios.nth(2).click();
  await creator.locator('input[type="text"]').first().fill("Members");
  await creator
    .locator("textarea")
    .fill("name\temail\nAna\tana@x.test\nBo\tbo@x.test");
  await creator.locator(".creator-footer button").last().click();
  await page.waitForFunction(
    () =>
      /Members/.test(
        document.querySelector(
          '[data-panel-id="datatableEditor"] .panel-header',
        )?.textContent ?? "",
      ),
    null,
    { timeout: 10_000 },
  );
  const membersRow = panel
    .locator('[role="grid"] [role="row"]')
    .filter({ hasText: "Members" });
  await membersRow.waitFor({ timeout: 5000 });
  record(
    "붙여넣기 생성: 목록에 Members (2 필드 · 2 행) + 편집기로 전환 + status",
    /2/.test((await membersRow.textContent()) ?? "") &&
      /Members/.test((await status.textContent()) ?? ""),
    `${await membersRow.textContent()} | ${await status.textContent()}`,
  );

  // AI 로 설명 → AI 패널 입력창에 초안 (전송 0)
  await addTable.click();
  await creator.waitFor({ timeout: 10_000 });
  await creator.locator(".creator-method").nth(5).click();
  await creator.locator('input[type="text"]').first().fill("Posts");
  await creator.locator("textarea").fill("blog posts with title and tags");
  await creator.locator(".creator-footer button").last().click();
  const composer = page.locator(".ai-composer textarea");
  await composer.waitFor({ timeout: 10_000 });
  await page.waitForFunction(
    () =>
      /Posts/.test(
        document.querySelector(".ai-composer textarea")?.value ?? "",
      ),
    null,
    { timeout: 5000 },
  );
  record(
    "AI 로 설명: AI 패널 열림 + 입력창 초안 (전송 0)",
    true,
    (await composer.inputValue()).slice(0, 60),
  );
  record("native dialog 0", dialogs === 0, String(dialogs));
  record("page error 0", errors.length === 0, errors.join(" | ").slice(0, 200));
  await page.screenshot({ path: resolve(OUT_DIR, "p1-final.png") });
} finally {
  writeFileSync(
    resolve(OUT_DIR, "findings.json"),
    JSON.stringify({ findings, errors }, null, 2),
  );
  const passed = findings.filter((f) => f.pass).length;
  log(`${passed}/${findings.length} PASS`);
  await browser.close();
  process.exitCode = passed === findings.length ? 0 : 1;
}
