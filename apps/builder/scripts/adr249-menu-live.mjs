#!/usr/bin/env node
// adr249-menu-live.mjs — ADR-249 G1 · G3 live (headed Playwright · dev 5173).
//
//   G1 (활성 대조 — oracle 은 메뉴가 아니라 선택 수 · COMMAND_META 최소 선택 상수 · store 결과):
//     A) 헤더 버튼을 마우스로 연다 (포커스가 캔버스를 떠남) · Properties+Styles 열림 ·
//        선택 없음 / 단일 / 다중 3 상태의 항목 활성 = 기대값
//     B) Properties · Styles 닫고 인터랙션만 열림 → 스타일/속성/포커스 모드 비활성 ·
//        메뉴 복사 → 메뉴 붙여넣기 → 요소 수 +1 (scope 인자 없으면 Events placeholder 로 가 불변)
//     C) Styles 다시 열면 스타일 복사 활성
//   G3 (명령 5 · 작업 공간 5 · 헤더 동작 3 · 검색 2) + 사용자 요청 (패널 아이콘 · 방향 머리글 없음)
//
// 사용: node apps/builder/scripts/adr249-menu-live.mjs [--headed] [--only=scope]
//   (dev 5173 · .auth-session.json · BUILDER_URL 로 대상 서버 지정)
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = process.env.BUILDER_URL ?? "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR249_OUT ?? "/private/tmp/adr249-menu-live";
const headed = process.argv.includes("--headed");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];
const log = (...a) => console.log("[adr249]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};

// 레일 버튼 aria-label (ko-KR) — 테마 · 작업 내역은 레일에 없다 (사용자 2026-09-29, 메뉴 전용)
const RAIL_LABELS = { properties: "속성", styles: "스타일", events: "인터랙션" };
const FRAMES = ["m249-a", "m249-b", "m249-c"];

const state = (page, fn, arg) => page.evaluate(fn, arg);
const store = (page, fn, arg) =>
  page.evaluate(
    ([source, a]) =>
      new Function("st", "arg", `return (${source})(st, arg)`)(
        window.__composition_STORE__.getState(),
        a,
      ),
    [fn.toString(), arg],
  );

async function setPanel(page, panelId, open) {
  const visible = await store(
    page,
    (st, id) => st.panelWorkspaceLayout?.visibility[id] === true,
    panelId,
  );
  if (visible === open) return;
  await page
    .locator(`.panel-toggle-rail button[aria-label="${RAIL_LABELS[panelId]}"]`)
    .click();
  await page.waitForTimeout(700);
}

const popover = (page) => page.locator(".header-menu-popover").first();
const item = (page, key) => page.locator(`[data-menu-key="${key}"]`).first();

async function openMenu(page) {
  if (await item(page, "submenu:edit").isVisible().catch(() => false)) return;
  // 닫힘 애니메이션 중인 popover 는 detach 를 기다린다
  await page
    .locator(".header-menu-popover[data-exiting]")
    .first()
    .waitFor({ state: "detached", timeout: 2_000 })
    .catch(() => {});
  await page.locator(".header-menu-button").click(); // 마우스 — 포커스가 캔버스를 떠난다
  await item(page, "submenu:edit").waitFor({ state: "visible", timeout: 8_000 });
  await page.waitForTimeout(150);
}
async function closeMenu(page) {
  for (let i = 0; i < 4; i++) {
    if (!(await popover(page).isVisible().catch(() => false))) return;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }
}
async function openSub(page, id) {
  await item(page, `submenu:${id}`).click();
  await page.waitForTimeout(250);
}
async function itemState(page, key) {
  const el = item(page, key);
  if (!(await el.count())) return { exists: false };
  return {
    exists: true,
    disabled: (await el.getAttribute("aria-disabled")) === "true",
    checked: await el.getAttribute("aria-checked"),
    label: (await el.locator(".header-menu-item-label").innerText()).trim(),
  };
}
async function readItems(page, submenu, keys) {
  await openMenu(page);
  if (submenu) await openSub(page, submenu);
  const out = {};
  for (const key of keys) out[key] = await itemState(page, key);
  await closeMenu(page);
  return out;
}
async function select(page, ids) {
  await store(
    page,
    (st, ids) => {
      // setSelectedElement(id) 는 앞선 다중 선택 ids 를 남긴다 (진단 09-29) — 목록으로 준다
      if (ids.length === 0) st.setSelectedElement(null);
      else st.setSelectedElements(ids);
    },
    ids,
  );
  await page.waitForTimeout(500);
}
const pageElementCount = (page) =>
  store(
    page,
    (st) =>
      st.elements.filter(
        (e) => e.page_id === st.currentPageId && e.type !== "body",
      ).length,
  );

/** 활성 기대값 — 선택 수 · canvasActions 최소 선택 상수 (GROUP 2 · ALIGN 2) 에서 손으로 유도. */
function expectedEnabled(selectionSize, stylesOpen) {
  const any = selectionSize >= 1;
  return {
    "cmd:copy": any,
    "cmd:cut": any,
    "cmd:duplicate": any,
    "cmd:delete": any,
    "cmd:selectAll": true,
    "cmd:paste": true,
    "cmd:group": selectionSize >= 2,
    "cmd:bringToFront": selectionSize === 1,
    "cmd:alignLeft": selectionSize >= 2,
    "cmd:zoomToSelection": any,
    "cmd:copyStyles": any && stylesOpen,
    "cmd:pasteStyles": any && stylesOpen,
  };
}
const SUBMENU_OF = {
  "cmd:copy": "edit",
  "cmd:cut": "edit",
  "cmd:duplicate": "edit",
  "cmd:delete": "edit",
  "cmd:selectAll": "edit",
  "cmd:paste": "edit",
  "cmd:copyStyles": "edit",
  "cmd:pasteStyles": "edit",
  "cmd:group": "layout",
  "cmd:bringToFront": "layout",
  "cmd:zoomToSelection": "view",
};

async function compareEnablement(page, label, selectionSize, stylesOpen) {
  const expected = expectedEnabled(selectionSize, stylesOpen);
  const mismatches = [];
  const bySub = {};
  for (const key of Object.keys(expected)) {
    if (key === "cmd:alignLeft") continue;
    (bySub[SUBMENU_OF[key]] ??= []).push(key);
  }
  for (const [sub, keys] of Object.entries(bySub)) {
    const got = await readItems(page, sub, keys);
    for (const key of keys) {
      if (!got[key].exists) mismatches.push(`${key}: 없음`);
      else if (!got[key].disabled !== expected[key])
        mismatches.push(`${key}: enabled=${!got[key].disabled}`);
    }
  }
  // 정렬은 레이아웃 ▸ 정렬 3단
  await openMenu(page);
  await openSub(page, "layout");
  await openSub(page, "align");
  const align = await itemState(page, "cmd:alignLeft");
  await closeMenu(page);
  if (!align.disabled !== expected["cmd:alignLeft"])
    mismatches.push(`cmd:alignLeft: enabled=${!align.disabled}`);
  record(
    `G1-A ${label}`,
    mismatches.length === 0,
    mismatches.length ? mismatches.join(" · ") : `${Object.keys(expected).length} 항목 일치`,
  );
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1440, height: 900 },
  permissions: ["clipboard-read", "clipboard-write"],
});
await context.addInitScript(() => {
  try {
    localStorage.setItem("composition-locale", "ko-KR");
  } catch {}
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr249-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectUrl = page.url();
  log("project", projectUrl.split("/builder/")[1]);
  log(
    "visibilityState",
    await state(page, () => document.visibilityState),
  );

  await state(
    page,
    async (ids) => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find(
        (e) => e.type === "body" && e.page_id === st.currentPageId,
      );
      const now = new Date().toISOString();
      for (const [index, id] of ids.entries()) {
        await st.addComplexElement(
          {
            id,
            customId: id,
            type: "frame",
            parent_id: body.id,
            page_id: st.currentPageId,
            order_num: index,
            props: {
              // 정렬은 left/top/width/height 가 다 있어야 동작한다 (elementAlignment.collectElementBounds)
              style: {
                position: "absolute",
                left: `${40 + index * 30}px`,
                top: `${40 + index * 90}px`,
                width: `${80 + index * 40}px`,
                height: "60px",
              },
            },
            created_at: now,
            updated_at: now,
          },
          [],
        );
      }
    },
    FRAMES,
  );
  await page.waitForTimeout(1200);
  const rects = await page.evaluate((ids) => {
    const map = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.();
    return ids.map((id) => {
      const r = map?.get(id);
      return r ? `${id} ${Math.round(r.width)}×${Math.round(r.height)}` : `${id} 없음`;
    });
  }, FRAMES);
  log("fixture layout", rects.join(" · "));
  await setPanel(page, "properties", true);
  await setPanel(page, "styles", true);
  await setPanel(page, "events", false);

  if (!ONLY) {
    // ---- 사용자 요청: 패널 항목 아이콘 · 방향 머리글 없음 ----
    await openMenu(page);
    const iconCount = await page
      .locator('[data-menu-key^="panel:"] .header-menu-item-icon svg')
      .count();
    const panelItems = await page.locator('[data-menu-key^="panel:"]').count();
    const headers = await page
      .locator(".header-menu-popover .header-menu-section-header")
      .allInnerTexts();
    const openMark = await page.evaluate(() => {
      const icon = (key) =>
        document.querySelector(`[data-menu-key="${key}"] .header-menu-item-icon`);
      const bg = (el) => (el ? getComputedStyle(el).backgroundColor : null);
      return {
        leftCheckColumn: document.querySelectorAll(
          ".header-menu-popover .header-menu-item > span.header-menu-item-check",
        ).length,
        openPanelBg: bg(icon("panel:properties")),
        iconSizes: [
          ...new Set(
            [...document.querySelectorAll(".header-menu-popover .header-menu-item svg")].map(
              (svg) => {
                const r = svg.getBoundingClientRect();
                return `${Math.round(r.width)}×${Math.round(r.height)}`;
              },
            ),
          ),
        ],
        railIconSize: (() => {
          const r = document
            .querySelector(".panel-toggle-rail button svg")
            ?.getBoundingClientRect();
          return r ? `${Math.round(r.width)}×${Math.round(r.height)}` : null;
        })(),
        closedPanelBg: bg(icon("panel:navigator")),
      };
    });
    await page.screenshot({ path: `${OUT_DIR}/menu-root.png` });
    await closeMenu(page);
    record(
      "요청 — 패널 항목 아이콘",
      panelItems === 10 && iconCount === 10,
      `패널 항목 ${panelItems} · 아이콘 ${iconCount}`,
    );
    const railLabels = await page
      .locator(".panel-toggle-rail button")
      .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
    record(
      "요청 — 레일에 테마 · 작업 내역 버튼 없음 (메뉴에는 있음)",
      railLabels.length === 8 &&
        !railLabels.includes("테마") &&
        !railLabels.includes("작업 내역"),
      `레일 ${JSON.stringify(railLabels)}`,
    );
    record(
      "요청 — 왼쪽 체크 열 없음 · 열린 패널은 아이콘 칸 채움",
      openMark.leftCheckColumn === 0 &&
        openMark.openPanelBg !== openMark.closedPanelBg &&
        openMark.closedPanelBg === "rgba(0, 0, 0, 0)",
      JSON.stringify(openMark),
    );
    record(
      "요청 — 메뉴 아이콘 = 레일 아이콘 크기 (빌더 표준 16)",
      openMark.iconSizes.length === 1 &&
        openMark.iconSizes[0] === "16×16" &&
        openMark.railIconSize === "16×16",
      `메뉴 ${JSON.stringify(openMark.iconSizes)} · 레일 ${openMark.railIconSize}`,
    );
    record(
      "요청 — 작업 공간 방향 머리글 없음",
      headers.length === 0,
      `머리글 ${JSON.stringify(headers)}`,
    );

    // ---- G1-A 선택 3 상태 ----
    await select(page, []);
    await compareEnablement(page, "선택 없음", 0, true);
    await select(page, [FRAMES[0]]);
    await compareEnablement(page, "단일", 1, true);
    await select(page, FRAMES);
    await compareEnablement(page, "다중 3", 3, true);
  }

  // ---- G1-B 인터랙션 패널만 열림 → 복사 · 붙여넣기 ----
  await setPanel(page, "properties", false);
  await setPanel(page, "styles", false);
  await setPanel(page, "events", true);
  await select(page, [FRAMES[0]]);
  const panelBound = await readItems(page, "edit", [
    "cmd:copyStyles",
    "cmd:pasteStyles",
    "cmd:copyProperties",
    "cmd:pasteProperties",
  ]);
  const focusMode = await readItems(page, "view", ["cmd:toggleFocusMode"]);
  const panelBoundDisabled = [
    ...Object.values(panelBound),
    focusMode["cmd:toggleFocusMode"],
  ].every((s) => s.exists && s.disabled);
  record(
    "G1-B 스타일/속성 패널 닫힘 → 해당 항목 비활성",
    panelBoundDisabled,
    JSON.stringify({ ...panelBound, ...focusMode }),
  );
  const before = await pageElementCount(page);
  await openMenu(page);
  await openSub(page, "edit");
  await item(page, "cmd:copy").click();
  await page.waitForTimeout(600);
  await openMenu(page);
  await openSub(page, "edit");
  await item(page, "cmd:paste").click();
  await page.waitForTimeout(1500);
  const after = await pageElementCount(page);
  record(
    "G1-B 인터랙션 패널만 열림 · 메뉴 복사 → 붙여넣기 = 요소 +1",
    after === before + 1,
    `요소 ${before} → ${after}`,
  );
  if (ONLY === "scope") throw new Error("__done__");

  // ---- G1-C Styles 다시 열면 스타일 복사 활성 ----
  await setPanel(page, "styles", true);
  const restyled = await readItems(page, "edit", ["cmd:copyStyles"]);
  record(
    "G1-C Styles 열림 → 스타일 복사 활성",
    restyled["cmd:copyStyles"].exists && !restyled["cmd:copyStyles"].disabled,
    JSON.stringify(restyled),
  );
  await setPanel(page, "events", false);
  await setPanel(page, "properties", true);

  // ---- G3 명령 5 ----
  // 1) 복사 — G1-B 가 exercise
  // 2) 정렬 왼쪽
  await select(page, [FRAMES[0], FRAMES[1]]);
  const styleOf = () =>
    store(page, (st, ids) => ids.map((id) => JSON.stringify(st.elementsMap.get(id)?.props?.style ?? {})), [FRAMES[0], FRAMES[1]]);
  const historyLen = () =>
    page.evaluate(() => window.__composition_STORE__.getState().historyInfo?.totalEntries ?? null);
  const alignBefore = await styleOf();
  const histBefore = await historyLen();
  await openMenu(page);
  await openSub(page, "layout");
  await openSub(page, "align");
  await item(page, "cmd:alignRight").click();
  await page.waitForTimeout(1200);
  const alignAfter = await styleOf();
  const histAfter = await historyLen();
  record(
    "G3 명령 — 레이아웃 ▸ 정렬 ▸ 오른쪽 정렬 (폭이 다른 두 요소)",
    JSON.stringify(alignBefore) !== JSON.stringify(alignAfter) ||
      (histBefore !== null && histAfter !== histBefore),
    `style 변경 ${JSON.stringify(alignBefore) !== JSON.stringify(alignAfter)} · history ${histBefore} → ${histAfter}`,
  );
  // 3) 컴포넌트 만들기 (문맥 라벨)
  await select(page, [FRAMES[2]]);
  const originBefore = await readItems(page, "component", ["cmd:toggleComponentOrigin"]);
  await openMenu(page);
  await openSub(page, "component");
  await item(page, "cmd:toggleComponentOrigin").click();
  await page.waitForTimeout(1500);
  const originAfter = await readItems(page, "component", ["cmd:toggleComponentOrigin"]);
  const role = await store(page, (st, id) => {
    const e = st.elementsMap.get(id);
    return e?.componentRole ?? (e?.reusable ? "origin" : null);
  }, FRAMES[2]);
  record(
    "G3 명령 — 컴포넌트 만들기 (라벨이 선택을 따라 바뀜)",
    role === "origin" &&
      originBefore["cmd:toggleComponentOrigin"].label !==
        originAfter["cmd:toggleComponentOrigin"].label,
    `role ${role} · 라벨 "${originBefore["cmd:toggleComponentOrigin"].label}" → "${originAfter["cmd:toggleComponentOrigin"].label}"`,
  );
  // 4) 확대
  const zoomText = () => page.locator("input.zoom-input").inputValue();
  const zoomBefore = await zoomText();
  await openMenu(page);
  await openSub(page, "view");
  await item(page, "cmd:zoomIn").click();
  await page.waitForTimeout(800);
  const zoomAfter = await zoomText();
  record("G3 명령 — 보기 ▸ 확대", zoomBefore !== zoomAfter, `${zoomBefore} → ${zoomAfter}`);
  // 5) 눈금자 (체크)
  const rulersBefore = await store(page, (st) => st.showRulers);
  await openMenu(page);
  await openSub(page, "view");
  await item(page, "cmd:toggleRulers").click();
  await page.waitForTimeout(500);
  const rulersState = await readItems(page, "view", ["cmd:toggleRulers"]);
  const rulersAfter = await store(page, (st) => st.showRulers);
  record(
    "G3 명령 — 보기 ▸ 눈금자 (체크)",
    rulersAfter === !rulersBefore &&
      rulersState["cmd:toggleRulers"].checked === String(rulersAfter),
    `showRulers ${rulersBefore} → ${rulersAfter} · aria-checked ${rulersState["cmd:toggleRulers"].checked}`,
  );

  // ---- G3 작업 공간 5 ----
  const visible = (id) =>
    store(page, (st, id) => st.panelWorkspaceLayout?.visibility[id] === true, id);
  async function toggleFromMenu(key) {
    await openMenu(page);
    await item(page, key).click();
    await page.waitForTimeout(700);
    await closeMenu(page);
  }
  const editorBefore = await visible("datatableEditor");
  await toggleFromMenu("panel:datatableEditor");
  record(
    "G3 작업 공간 — 데이터 편집기 (단축키 없는 패널)",
    (await visible("datatableEditor")) === !editorBefore,
    `visible ${editorBefore} → ${await visible("datatableEditor")}`,
  );
  if (await visible("datatableEditor")) await toggleFromMenu("panel:datatableEditor");
  const historyBefore = await visible("history");
  await toggleFromMenu("panel:history");
  const historyState = await readItems(page, null, ["panel:history"]);
  record(
    "G3 작업 공간 — 히스토리 토글 · 체크",
    (await visible("history")) === !historyBefore &&
      historyState["panel:history"].checked === String(!historyBefore),
    `visible ${historyBefore} → ${await visible("history")} · aria-checked ${historyState["panel:history"].checked}`,
  );
  // 레일 이동 — history 를 왼쪽 레일로 옮기면 메뉴 구역도 따라간다
  const moveHistory = (side) =>
    store(
      page,
      (st, side) => {
        const layout = structuredClone(st.panelWorkspaceLayout);
        for (const s of ["left", "right", "bottom"])
          layout.railOrder[s] = layout.railOrder[s].filter((id) => id !== "history");
        layout.railOrder[side].push("history");
        st.setPanelWorkspaceLayout(layout);
      },
      side,
    );
  const sectionOf = async (key) =>
    page
      .locator(`[data-menu-key="${key}"]`)
      .evaluate((el) =>
        [...el.closest("section,[role=group]").querySelectorAll("[data-menu-key]")].map(
          (node) => node.getAttribute("data-menu-key"),
        ),
      );
  await moveHistory("left");
  await page.waitForTimeout(500);
  await openMenu(page);
  const leftSection = await sectionOf("panel:history");
  await closeMenu(page);
  record(
    "G3 작업 공간 — 레일 이동 후 구역 (history → 왼쪽)",
    leftSection.includes("panel:navigator"),
    JSON.stringify(leftSection),
  );
  await moveHistory("bottom");
  await page.waitForTimeout(500);
  await openMenu(page);
  const bottomSection = await sectionOf("panel:history");
  const sectionCount = await page
    .locator('.header-menu-popover section:has([data-menu-key^="panel:"])')
    .count();
  await closeMenu(page);
  const bottomBefore = await visible("history");
  await toggleFromMenu("panel:history");
  record(
    "G3 작업 공간 — bottom 저장 레이아웃: 아래 구역 표시 · 토글",
    bottomSection.length === 1 &&
      sectionCount === 3 &&
      (await visible("history")) === !bottomBefore,
    `구역 ${JSON.stringify(bottomSection)} · 패널 구역 ${sectionCount} · visible ${bottomBefore} → ${await visible("history")}`,
  );
  await moveHistory("right");
  const settingsBefore = await visible("settings");
  await toggleFromMenu("cmd:openSettings");
  record(
    "G3 작업 공간 — 설정",
    (await visible("settings")) === !settingsBefore,
    `visible ${settingsBefore} → ${await visible("settings")}`,
  );
  if (await visible("settings")) await toggleFromMenu("cmd:openSettings");

  // ---- G3 헤더 동작 3 ----
  const downloadPromise = page
    .waitForEvent("download", { timeout: 15_000 })
    .catch(() => null);
  await openMenu(page);
  await openSub(page, "file");
  await item(page, "action:exportProject").click();
  const download = await downloadPromise;
  // download 이벤트는 메뉴가 닫히기 전에 온다 (onAction 안에서 동기 실행) — 닫힘을 기다린다
  await popover(page).waitFor({ state: "detached", timeout: 5_000 }).catch(() => {});
  record(
    "G3 헤더 — 파일 ▸ 내보내기",
    Boolean(download),
    download ? `download ${download.suggestedFilename()}` : "download 없음",
  );
  await openMenu(page);
  await openSub(page, "view");
  await openSub(page, "appearance");
  await item(page, "action:themeDark").click();
  await page.waitForTimeout(600);
  const theme = await page.evaluate(
    () => JSON.parse(localStorage.getItem("composition-ui") ?? "{}")?.state?.themeMode,
  );
  const themeItems = await (async () => {
    await openMenu(page);
    await openSub(page, "view");
    await openSub(page, "appearance");
    const out = {
      dark: await itemState(page, "action:themeDark"),
      auto: await itemState(page, "action:themeAuto"),
      role: await item(page, "action:themeDark").getAttribute("role"),
    };
    await closeMenu(page);
    return out;
  })();
  record(
    "G3 헤더 — 보기 ▸ 모양 ▸ 어둡게 (radio)",
    theme === "dark" &&
      themeItems.dark.checked === "true" &&
      themeItems.auto.checked === "false" &&
      themeItems.role === "menuitemradio",
    `themeMode ${theme} · ${JSON.stringify(themeItems)}`,
  );
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("composition-ui") ?? "{}");
    if (raw.state) raw.state.themeMode = "auto";
    localStorage.setItem("composition-ui", JSON.stringify(raw));
  });
  await openMenu(page);
  await openSub(page, "file");
  await item(page, "action:deleteProject").click();
  const dialog = page.locator('[role="alertdialog"], [role="dialog"]').last();
  await dialog.waitFor({ state: "visible", timeout: 5_000 });
  await page.screenshot({ path: `${OUT_DIR}/delete-confirm.png` });
  await dialog.getByRole("button").first().click();
  await page.waitForTimeout(800);
  record(
    "G3 헤더 — 파일 ▸ 프로젝트 삭제… → 취소",
    page.url() === projectUrl,
    `url 유지 ${page.url() === projectUrl}`,
  );

  // ---- G3 검색 2 ----
  await openMenu(page);
  await page.keyboard.type("정렬");
  await page.waitForTimeout(400);
  const searchHeaders = await page
    .locator(".header-menu-popover .header-menu-section-header")
    .allInnerTexts();
  const searchKeys = await page
    .locator(".header-menu-popover [data-menu-key]")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-menu-key")));
  await page.screenshot({ path: `${OUT_DIR}/search-align.png` });
  await closeMenu(page);
  record(
    'G3 검색 — "정렬" → 경로 머리글 · 잎 항목 평면',
    searchKeys.includes("cmd:alignLeft") &&
      searchHeaders.some((h) => h.includes("›")),
    `항목 ${searchKeys.length} · 머리글 ${JSON.stringify(searchHeaders)}`,
  );
  const rulersBeforeSearch = await store(page, (st) => st.showRulers);
  await openMenu(page);
  await page.keyboard.type("눈금자");
  await page.waitForTimeout(400);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(700);
  const rulersAfterSearch = await store(page, (st) => st.showRulers);
  await closeMenu(page);
  record(
    "G3 검색 — Enter 실행 (눈금자)",
    rulersAfterSearch === !rulersBeforeSearch,
    `showRulers ${rulersBeforeSearch} → ${rulersAfterSearch}`,
  );
} catch (error) {
  if (String(error?.message) !== "__done__") {
    await page.screenshot({ path: `${OUT_DIR}/harness-failure.png` }).catch(() => {});
    record("harness", false, String(error?.stack ?? error).slice(0, 2500));
  }
} finally {
  record("page error 0", errors.length === 0, errors.slice(0, 3).join(" | ") || "0");
  const pass = findings.every((f) => f.pass);
  writeFileSync(
    `${OUT_DIR}/result${ONLY ? `-${ONLY}` : ""}.json`,
    JSON.stringify({ pass, findings }, null, 2),
  );
  log(pass ? "ALL PASS" : "FAIL", `${findings.filter((f) => f.pass).length}/${findings.length}`);
  await browser.close();
}
