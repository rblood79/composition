#!/usr/bin/env node
// adr242-live.mjs — ADR-242 live (초기 화면 밖 패널 lazy 분리, production 빌드 `vite preview` :4173).
//
//   L1 레일 클릭으로 lazy 패널 4 (history · events · theme · datatable) 열기 → 실제 내용 (fallback 아님)
//   L2 단축키 (Alt+8 · Alt+7 · Alt+4 · Alt+3) 토글 · Cmd+, 설정
//   L3 커맨드 팔레트 (Cmd+/) 로 history
//   L4 상태 유지 — datatable 패널 탭 전환 → 닫기 → 다시 열기 → 같은 탭
//   L5 폰트 관리 대화상자 — Styles Typography → Font Family → "폰트 관리" → 모달 (첫 열림 로드)
//   L6 로드 실패 격리 (G3) — history chunk 요청 차단 → 그 패널 안 오류 · Canvas · 다른 패널 동작 → 차단 해제 → 다시 시도 → 내용
//   L7 page error 0
//   --latency: L8 첫 열림 지연 (G4) — cold (HTTP 캐시 비움 + 새로고침) 5 · warm 5, CPU 1x · 4x, 레일 클릭 → 내용
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createIsolatedProject, waitReady } from "./perf-baseline.mjs";

const BASE = "http://localhost:4173/composition";
const out = "/private/tmp/adr242-live";
mkdirSync(out, { recursive: true });
const storageState = JSON.parse(
  readFileSync(resolve("apps/builder/scripts/.auth-session.json"), "utf8"),
);
const auth =
  storageState.origins?.find((o) => o.origin.includes("localhost:5173"))
    ?.localStorage ?? [];
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 420)}\n`,
  );
};

const PANELS = {
  history: { label: /^(History|작업 내역)$/, key: "Alt+8", palette: "History" },
  events: { label: /^(Interactions|인터랙션)$/, key: "Alt+7" },
  theme: { label: /^(Theme|테마)$/, key: "Alt+4" },
  datatable: { label: /^(Data|DataTable|데이터)$/, key: "Alt+3" },
};
/** 지연 측정 대상 + 대조군 properties (정적 패널 — mount 비용 기준) */
const LAT_PANELS = {
  ...PANELS,
  properties: { label: /^(Properties|속성)$/, key: "Alt+5" },
};
const content = (id) =>
  `[data-panel="${id}"] .panel:not(.panel-lazy-fallback) .panel-contents, [data-panel="${id}"] .panel:not(.panel-lazy-fallback) .panel-tabrow`;
const rail = (page, id) =>
  page.getByRole("button", { name: PANELS[id].label }).first();
const isOpen = (page, id) =>
  page.evaluate((sel) => !!document.querySelector(sel), content(id));

async function newContext(browser, opts = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ...opts,
  });
  await context.addInitScript((entries) => {
    for (const { name, value } of entries)
      if (!localStorage.getItem(name)) localStorage.setItem(name, value);
  }, auth);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return { context, page, errors };
}

const browser = await chromium.launch({
  channel: "chrome",
  headless: !process.argv.includes("--headed"),
});
try {
  if (process.argv.includes("--latency")) {
    await latency(browser);
  } else {
    await behavior(browser);
  }
} finally {
  await browser.close();
}
writeFileSync(
  resolve(
    out,
    `${process.argv.includes("--latency") ? "latency" : "live"}-${Date.now()}.json`,
  ),
  JSON.stringify(results, null, 2),
);
const failed = results.filter((r) => !r.pass);
process.stdout.write(
  `\n${results.length - failed.length}/${results.length} PASS\n`,
);
process.exit(failed.length ? 1 : 0);

async function behavior(browser) {
  const { page, errors } = await newContext(browser);
  const { projectUrl } = await createIsolatedProject(page, BASE);
  if (process.argv.includes("--only-l6")) {
    const l6 = await failureIsolation(browser, projectUrl);
    record("L6 (only)", l6.retried, l6);
    return;
  }

  // L1 — 레일 클릭
  const l1 = {};
  for (const id of Object.keys(PANELS)) {
    await rail(page, id).click();
    await page
      .waitForSelector(content(id), { timeout: 15_000 })
      .catch(() => {});
    l1[id] = await isOpen(page, id);
    await rail(page, id).click(); // 닫기
  }
  record(
    "L1 레일 클릭 → lazy 패널 4 내용 표시",
    Object.values(l1).every(Boolean),
    l1,
  );

  // L2 — 단축키 토글 (열기 → 닫기) · Cmd+, 설정
  const l2 = {};
  for (const [id, { key }] of Object.entries(PANELS)) {
    await page.keyboard.press(key);
    await page
      .waitForSelector(content(id), { timeout: 15_000 })
      .catch(() => {});
    const opened = await isOpen(page, id);
    await page.keyboard.press(key);
    await page.waitForTimeout(300);
    const closed = await page.evaluate((id) => {
      const wrapper = document.querySelector(`[data-panel="${id}"]`);
      return (
        !wrapper ||
        !wrapper.checkVisibility?.() ||
        wrapper.closest("[hidden]") !== null
      );
    }, id);
    l2[id] = { opened, closed };
  }
  await page.keyboard.press("Meta+,");
  await page
    .waitForSelector(content("settings"), { timeout: 15_000 })
    .catch(() => {});
  l2.settings = await isOpen(page, "settings");
  await page.keyboard.press("Meta+,");
  record(
    "L2 단축키 토글 4 · Cmd+, 설정",
    Object.values(l2).every((v) =>
      typeof v === "boolean" ? v : v.opened && v.closed,
    ),
    l2,
  );

  // L3 — 커맨드 팔레트
  await page.keyboard.press("Meta+/");
  const paletteInput = page.locator(".command-palette-modal input").first();
  let l3 = { palette: false, opened: false };
  if (await paletteInput.isVisible().catch(() => false)) {
    l3.palette = true;
    await paletteInput.fill("history");
    await page.keyboard.press("Enter");
    await page
      .waitForSelector(content("history"), { timeout: 15_000 })
      .catch(() => {});
    l3.opened = await isOpen(page, "history");
    if (l3.opened) await page.keyboard.press("Alt+8");
  }
  // 팔레트 오버레이가 남아 있으면 레일 클릭을 가로막는다 — 입력 포커스 Escape → 닫기 버튼 순
  const overlay = page.locator(".command-palette-overlay");
  if (await overlay.count()) {
    await paletteInput.focus().catch(() => {});
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
  if (await overlay.count()) {
    await page
      .locator(".command-palette-modal button")
      .first()
      .click()
      .catch(() => {});
  }
  await overlay.waitFor({ state: "detached", timeout: 5_000 }).catch(() => {});
  l3.overlayClosed = (await overlay.count()) === 0;
  record(
    "L3 커맨드 팔레트 → history · 팔레트 닫힘",
    l3.palette && l3.opened && l3.overlayClosed,
    l3,
  );

  // L4 — 상태 유지 (datatable 탭)
  await rail(page, "datatable").click();
  await page.waitForSelector(content("datatable"), { timeout: 15_000 });
  const tabs = page.locator('[data-panel="datatable"] .panel-tab');
  const tabCount = await tabs.count();
  let l4 = { tabCount, before: null, after: null };
  if (tabCount >= 2) {
    await tabs.nth(1).click();
    l4.before = await tabs.nth(1).getAttribute("aria-selected");
    await rail(page, "datatable").click();
    await page.waitForTimeout(300);
    await rail(page, "datatable").click();
    await page.waitForSelector(content("datatable"), { timeout: 15_000 });
    l4.after = await page
      .locator('[data-panel="datatable"] .panel-tab')
      .nth(1)
      .getAttribute("aria-selected");
    await rail(page, "datatable").click();
  }
  record(
    "L4 닫았다 다시 열어도 탭 상태 유지 (Activity)",
    l4.before === "true" && l4.after === "true",
    l4,
  );

  // L5 — 폰트 관리 대화상자
  let l5 = {
    textAdded: false,
    typography: false,
    picker: false,
    manage: false,
    modal: false,
  };
  try {
    l5.textAdded = await page.evaluate(async () => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find(
        (e) => e.page_id === st.currentPageId && e.type === "body",
      );
      const now = new Date().toISOString();
      const id = "adr242-text";
      await st.addComplexElement(
        {
          id,
          customId: id,
          type: "Text",
          parent_id: body.id,
          page_id: st.currentPageId,
          created_at: now,
          updated_at: now,
          props: { children: "lazy", style: {} },
        },
        [],
      );
      const s2 = window.__composition_STORE__.getState();
      (s2.setSelectedElements ?? s2.selectElement ?? (() => {}))([id]);
      if (s2.setSelectedElement) s2.setSelectedElement(id);
      return s2.elements.some((e) => e.id === id);
    });
    await page.keyboard.press("Alt+6");
    await page.waitForSelector('[data-panel="styles"]', { timeout: 15_000 });
    // 탭은 아이콘 모드 (aria-label) — styles.text
    const typoTab = page
      .locator('[data-panel="styles"]')
      .getByRole("tab", { name: /^(Text|텍스트|Typography|타이포그래피)$/ })
      .first();
    await typoTab.waitFor({ state: "visible", timeout: 10_000 });
    await typoTab.click();
    l5.typography = true;
    const picker = page.locator(".font-picker-trigger").first();
    await picker.waitFor({ state: "visible", timeout: 10_000 });
    l5.picker = true;
    await picker.click();
    const manage = page
      .getByRole("button", {
        name: /Manage fonts|폰트 관리|Add font|폰트 추가/,
      })
      .first();
    await manage.waitFor({ state: "visible", timeout: 10_000 });
    l5.manage = true;
    await manage.click();
    await page.waitForSelector(".font-manager-modal", { timeout: 15_000 });
    l5.modal = true;
    await page.keyboard.press("Escape");
  } catch (error) {
    l5.error = String(error).slice(0, 160);
  }
  record(
    "L5 Styles Typography → 폰트 관리 대화상자 (첫 열림 로드)",
    l5.modal,
    l5,
  );

  // L6 — 로드 실패 격리 (새 페이지 · history chunk 차단)
  const l6 = await failureIsolation(browser, projectUrl);
  record(
    "L6 chunk 로드 실패 → 그 패널 안 오류 · Canvas · 다른 패널 동작 → 다시 시도 → 내용 (G3)",
    l6.alert && l6.canvas && l6.otherPanel && l6.retried && l6.pageErrors === 0,
    l6,
  );

  record("L7 page error 0", errors.length === 0, errors.slice(0, 3));
}

async function failureIsolation(browser, projectUrl) {
  const { context, page, errors } = await newContext(browser);
  let blocked = 0;
  let passed = 0;
  let blocking = true;
  await context.route(/\/assets\/HistoryPanel-[^/]+\.js$/, (route) => {
    if (blocking) {
      blocked += 1;
      return route.abort("failed");
    }
    passed += 1;
    return route.continue();
  });
  await page.goto(projectUrl, { waitUntil: "networkidle" });
  await waitReady(page);
  await rail(page, "history").click();
  const alert = await page
    .waitForSelector('[data-panel="history"] [role="alert"]', {
      timeout: 15_000,
    })
    .then(() => true)
    .catch(() => false);
  const canvas = await page.evaluate(
    () => !!document.querySelector('[data-testid="skia-canvas-unified"]'),
  );
  await page.keyboard.press("Alt+5");
  const otherPanel = await page
    .waitForSelector('[data-panel="properties"] .panel-contents', {
      timeout: 15_000,
    })
    .then(() => true)
    .catch(() => false);
  blocking = false;
  const warnings = [];
  page.on("console", (m) => {
    if (m.type() === "warning" || m.type() === "error")
      warnings.push(m.text().slice(0, 160));
  });
  const retryButton = page
    .locator('[data-panel="history"] [role="alert"] button')
    .first();
  const retryVisible = await retryButton.isVisible().catch(() => false);
  const requestsBefore = blocked + passed;
  await retryButton
    .click()
    .catch((e) => warnings.push("click: " + String(e).slice(0, 100)));
  const retried = await page
    .waitForSelector(content("history"), { timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  const alertAfter = await page
    .locator('[data-panel="history"] [role="alert"]')
    .count();
  const result = {
    blocked,
    passed,
    requestsBefore,
    retryVisible,
    alertAfter,
    alert,
    canvas,
    otherPanel,
    retried,
    warnings: warnings.slice(0, 4),
    pageErrors: errors.length,
    errors: errors.slice(0, 2),
  };
  await context.close();
  return result;
}

async function latency(browser) {
  const { context, page } = await newContext(browser);
  const { projectUrl } = await createIsolatedProject(page, BASE);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  const measure = async (id) =>
    page.evaluate(
      ([label, sel]) => {
        const btn = [...document.querySelectorAll("button")].find((b) =>
          new RegExp(label).test(b.getAttribute("aria-label") ?? ""),
        );
        const visible = () =>
          [...document.querySelectorAll(sel)].some((el) =>
            el.checkVisibility(),
          );
        if (visible())
          return Promise.reject(
            new Error(
              "already open: " +
                [...document.querySelectorAll(sel)]
                  .map((el) =>
                    el.closest("[data-panel]")?.outerHTML.slice(0, 160),
                  )
                  .join(" || "),
            ),
          );
        const t0 = performance.now();
        btn.click();
        return new Promise((res, rej) => {
          const deadline = t0 + 20_000;
          const tick = () => {
            if (visible()) res(performance.now() - t0);
            else if (performance.now() > deadline) rej(new Error("timeout"));
            else requestAnimationFrame(tick);
          };
          tick();
        });
      },
      [LAT_PANELS[id].label.source, content(id)],
    );
  /** 측정 뒤 닫는다 — 레이아웃이 열림 상태를 저장하면 다음 새로고침에서 이미 열려 있다 */
  const close = async (id) => {
    await page
      .getByRole("button", { name: LAT_PANELS[id].label })
      .first()
      .click();
    await page.waitForFunction(
      (sel) =>
        ![...document.querySelectorAll(sel)].some((el) => el.checkVisibility()),
      content(id),
      { timeout: 10_000 },
    );
    // 레이아웃 persist (debounce) 가 새로고침 전에 끝나야 다음 회차가 닫힌 채 시작한다
    await page.waitForTimeout(1_000);
  };
  const p95 = (xs) =>
    [...xs].sort((a, b) => a - b)[
      Math.min(xs.length - 1, Math.ceil(xs.length * 0.95) - 1)
    ];
  const summary = {};
  for (const rate of [1, 4]) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    for (const id of Object.keys(LAT_PANELS)) {
      const cold = [];
      const warm = [];
      for (let i = 0; i < 10; i += 1) {
        const isCold = i < 5;
        if (isCold) await cdp.send("Network.clearBrowserCache");
        await page.goto(projectUrl, { waitUntil: "networkidle" });
        await waitReady(page);
        (isCold ? cold : warm).push(await measure(id));
        await close(id);
      }
      summary[`${rate}x/${id}`] = {
        coldP95: Math.round(p95(cold)),
        coldMedian: Math.round([...cold].sort((a, b) => a - b)[2]),
        warmP95: Math.round(p95(warm)),
        warmMedian: Math.round([...warm].sort((a, b) => a - b)[2]),
      };
      process.stdout.write(
        `${rate}x ${id} cold p95 ${summary[`${rate}x/${id}`].coldP95} ms · warm p95 ${summary[`${rate}x/${id}`].warmP95} ms\n`,
      );
    }
  }
  // 대조군 properties (정적) 는 판정 밖 — lazy 몫 = lazy 패널 − 정적 패널 mount 비용
  const worst4x = Math.max(
    ...Object.entries(summary)
      .filter(([k]) => k.startsWith("4x") && !k.endsWith("/properties"))
      .map(([, v]) => v.coldP95),
  );
  record("L8 첫 열림 cold p95 ≤ 300 ms (CPU 4x, 전 패널)", worst4x <= 300, {
    worst4x,
    ...summary,
  });
  await context.close();
}
