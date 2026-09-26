#!/usr/bin/env node
// mock-preset-live.mjs — Add Table preset (자체 mock 모듈) live: 실제 빌더 Data 패널에서
//   1) 생성 패널 preset 카테고리 9 · 카드 28
//   2) Profiles 카드 → 스키마 미리보기 22 필드 · 생성 조건 (seed · blank %) 컨트롤
//   3) seed "live" · blank 20 → Create → 편집기 열림 · IndexedDB 행 10 · 성별 ↔ 초상 일관 ·
//      required 는 전부 채움 · 비필수 null 비율 5~40%
//   4) 같은 seed 로 한 번 더 → 같은 행 (재현) · Images preset → picsum id URL
//   5) page error 0 · native dialog 0
//   --ko: 저장 locale 을 ko-KR 로 두고 부팅 — 라벨 (이름 · 성별) 과 한국어 이름 풀 (성+이름) 확인
// 사용: node apps/builder/scripts/mock-preset-live.mjs [--headed] [--ko]   (dev 서버 5173 · .auth-session.json)
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = process.env.BUILDER_URL ?? "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.MOCK_PRESET_OUT ?? "/private/tmp/mock-preset-live";
const headed = process.argv.includes("--headed");
const ko = process.argv.includes("--ko");
const log = (...a) => console.log("[mock-preset live]", ...a);
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

async function idbCollections(page, projectId) {
  return page.evaluate(async (projectId) => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("composition");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const rows = await new Promise((res, rej) => {
      const r = db
        .transaction("collections", "readonly")
        .objectStore("collections")
        .getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    db.close();
    return rows.filter((row) => row.project_id === projectId);
  }, projectId);
}

/** 생성 패널에서 preset 카드 하나로 테이블을 만든다 */
async function createFromPreset(page, panel, { card, seed, blank, name }) {
  const addTable = panel.locator(
    'button:has-text("Add Table"), button:has-text("테이블 추가")',
  );
  await addTable.click();
  const creator = page.locator(".datatable-creator");
  await creator.waitFor({ timeout: 10_000 });
  await creator.locator(".creator-method").nth(1).click();
  if (name) await creator.locator('input[type="text"]').first().fill(name);
  await creator.locator(".preset-card", { hasText: card }).first().click();
  const seedInput = creator.locator(
    'input[aria-label="Seed"], input[aria-label="시드"]',
  );
  const blankInput = creator.locator(
    'input[aria-label="Blank %"], input[aria-label="빈 값 %"]',
  );
  await seedInput.waitFor({ timeout: 5000 });
  if (seed !== undefined) await seedInput.fill(seed);
  if (blank !== undefined) await blankInput.fill(String(blank));
  const schemaRows = await creator.locator(".creator-schema-field").count();
  await creator.locator(".creator-footer button").last().click();
  const expected = name ?? card;
  await page.waitForFunction(
    (expected) =>
      (
        document.querySelector('[data-panel-id="datatableEditor"] .panel-header')
          ?.textContent ?? ""
      ).includes(expected),
    expected,
    { timeout: 15_000 },
  );
  return { creator, schemaRows };
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
if (ko) {
  await page.addInitScript(() =>
    localStorage.setItem("composition-locale", "ko-KR"),
  );
}
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
  await input.fill(`mock-preset-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  log("project", projectId);
  await setPanel(page, "datatable", true);
  const panel = page.locator(".datatable-panel");
  await panel.waitFor({ timeout: 15_000 });

  // 1) 카테고리 · 카드
  const addTable = panel.locator(
    'button:has-text("Add Table"), button:has-text("테이블 추가")',
  );
  await addTable.click();
  const creator = page.locator(".datatable-creator");
  await creator.waitFor({ timeout: 10_000 });
  await creator.locator(".creator-method").nth(1).click();
  const groups = await creator.locator(".list-subgroup").count();
  const cards = await creator.locator(".preset-card").count();
  record("preset 카테고리 9 · 카드 28", groups === 9 && cards === 28, `${groups} / ${cards}`);
  const groupTitles = await creator
    .locator(".list-subgroup-title")
    .allTextContents();
  record(
    "새 카테고리 People · Content · Finance · Media 노출",
    ["People", "Content", "Finance", "Media"].every((g) => groupTitles.includes(g)),
    groupTitles.join(" · "),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "1-creator-presets.png") });

  // 2) Profiles 카드 → 미리보기 · 생성 조건 컨트롤
  await creator.locator(".preset-card", { hasText: "Profiles" }).first().click();
  const seedInput = creator.locator(
    'input[aria-label="Seed"], input[aria-label="시드"]',
  );
  const blankInput = creator.locator(
    'input[aria-label="Blank %"], input[aria-label="빈 값 %"]',
  );
  await seedInput.waitFor({ timeout: 5000 });
  const previewRows = await creator.locator(".creator-schema-field").count();
  const controlSizes = await page.evaluate(() => {
    const seed = document.querySelector(
      '.datatable-creator input[aria-label="Seed"], .datatable-creator input[aria-label="시드"]',
    );
    const blank = document.querySelector(
      '.datatable-creator input[aria-label="Blank %"], .datatable-creator input[aria-label="빈 값 %"]',
    );
    const group = (el) => el?.closest(".react-aria-Group")?.getBoundingClientRect();
    return { seed: group(seed)?.height, blank: group(blank)?.height };
  });
  record(
    "Profiles 미리보기 22 필드 · Seed/Blank % 컨트롤 28 티어",
    previewRows === 22 &&
      Math.round(controlSizes.seed) === 28 &&
      Math.round(controlSizes.blank) === 28,
    `${previewRows} / ${JSON.stringify(controlSizes)}`,
  );
  await page.screenshot({ path: resolve(OUT_DIR, "2-profiles-preview.png") });

  // 3) seed live · blank 20 → Create
  await seedInput.fill("live");
  await blankInput.fill("20");
  await creator.locator(".creator-footer button").last().click();
  await page.waitForFunction(
    () =>
      /Profiles/.test(
        document.querySelector('[data-panel-id="datatableEditor"] .panel-header')
          ?.textContent ?? "",
      ),
    null,
    { timeout: 15_000 },
  );
  let collections = await idbCollections(page, projectId);
  const profiles = collections.find((c) => c.name === "Profiles");
  const rows = profiles?.mockData ?? [];
  const consistent = rows.every(
    (r) =>
      (r.gender === "male" || r.gender === "female") &&
      (r.picture === null ||
        String(r.picture).includes(r.gender === "male" ? "/men/" : "/women/")) &&
      r.firstName !== null &&
      r.lastName !== null,
  );
  const optionalKeys = profiles?.schema
    .filter((f) => !f.required)
    .map((f) => f.key) ?? [];
  const optionalCells = rows.length * optionalKeys.length;
  const nullCells = rows.reduce(
    (n, r) => n + optionalKeys.filter((k) => r[k] === null).length,
    0,
  );
  const nullRatio = optionalCells ? nullCells / optionalCells : 0;
  record(
    "Profiles 생성: 행 10 · 스키마 라벨 해소 · 성별↔초상 일관 · 비필수 null 5~40%",
    rows.length === 10 &&
      consistent &&
      profiles.schema.every((f) => f.label && !f.label.startsWith("presetField.")) &&
      nullRatio > 0.05 &&
      nullRatio < 0.4,
    `rows ${rows.length} · null ${(nullRatio * 100).toFixed(1)}% · ${profiles?.schema.map((f) => f.label).slice(0, 4).join("/")}`,
  );
  await page.screenshot({ path: resolve(OUT_DIR, "3-profiles-editor.png") });
  if (ko) {
    const firstLabel = profiles?.schema.find((f) => f.key === "firstName")?.label;
    // blank 20% 라 비필수 (fullName · phone) 는 null 일 수 있다 — 값이 있는 행만
    const koreanNames = rows.every(
      (r) =>
        (r.fullName === null || /^[가-힣]{2,4}$/.test(String(r.fullName))) &&
        (r.phone === null || String(r.phone).startsWith("02-")),
    );
    record(
      "ko-KR: 라벨 「이름」 · 성+이름 붙여 쓴 한국어 이름 · 02 전화 형식",
      firstLabel === "이름" && koreanNames,
      `${firstLabel} · ${rows[0]?.fullName} · ${rows[0]?.phone}`,
    );
  }

  // 4) 같은 seed 재현 · Images preset
  await createFromPreset(page, panel, {
    card: "Profiles",
    seed: "live",
    blank: 20,
    name: "Profiles2",
  });
  collections = await idbCollections(page, projectId);
  const again = collections.find((c) => c.name === "Profiles2")?.mockData ?? [];
  record(
    "같은 seed 로 다시 만들면 같은 행",
    again.length === 10 && JSON.stringify(again) === JSON.stringify(rows),
    `${again.length} rows · equal ${JSON.stringify(again) === JSON.stringify(rows)}`,
  );
  await createFromPreset(page, panel, { card: "Images", name: "Images" });
  collections = await idbCollections(page, projectId);
  const images = collections.find((c) => c.name === "Images")?.mockData ?? [];
  record(
    "Images: picsum id URL · previewUrl 효과 파라미터",
    images.length === 12 &&
      images.every((r) =>
        String(r.url).startsWith(`https://picsum.photos/id/${r.picsumId}/`),
      ) &&
      images.some((r) => /grayscale|blur=/.test(String(r.previewUrl))),
    `${images.length} rows · ${images[0]?.url}`,
  );
  await page.screenshot({ path: resolve(OUT_DIR, "4-images-editor.png") });

  record("native dialog 0", dialogs === 0, String(dialogs));
  record("page error 0", errors.length === 0, errors.join(" | ").slice(0, 200));
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
