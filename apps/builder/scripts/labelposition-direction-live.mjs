// Meter · ProgressBar · Slider — Style 패널 Direction 토글과 labelPosition 의 관계, 인라인 방향의 Skia 배치.
// headed Playwright · 실제 빌더 · Compare Mode / Preview iframe 은 열지 않는다.
// 사용: node apps/builder/scripts/labelposition-direction-live.mjs  →  output/playwright/labelposition-direction/
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { waitReady } from "./perf-baseline.mjs";

const OUT = "output/playwright/labelposition-direction";
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
// TextField 는 대조군 — 이미 Direction 이 labelPosition 으로 번역되는 타입.
const TYPES = ["ProgressBar", "Meter", "Slider", "TextField"];
const DIRECTION_INDEX = { block: 0, row: 1, column: 2 };

async function setPanel(page, panelId, open) {
  const button = page
    .locator(".panel-toggle-rail button")
    .nth(RAIL_ORDER.indexOf(panelId));
  if (((await button.getAttribute("aria-pressed")) === "true") !== open) {
    await button.click();
    await page.waitForTimeout(900);
  }
}

async function addFromPalette(page, type, parentId = null) {
  await setPanel(page, "components", true);
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    parentId,
  );
  await page.waitForTimeout(300);
  const before = await page.evaluate(() =>
    window.__composition_STORE__.getState().elements.map((e) => e.id),
  );
  const search = page
    .locator(
      '[data-panel-id="components"] input[type="search"], [data-panel-id="components"] input',
    )
    .first();
  await search.waitFor({ state: "visible", timeout: 20_000 });
  await search.fill(type);
  await page.waitForTimeout(400);
  const items = page.locator(`[data-panel-id="components"] .list-item`);
  const n = await items.count();
  for (let i = 0; i < n; i++) {
    const label = (await items.nth(i).innerText()) ?? "";
    if (label.replace(/\s+/g, "").toLowerCase() === type.toLowerCase()) {
      await items.nth(i).click();
      break;
    }
  }
  const id = await page
    .waitForFunction(
      ({ t, before }) =>
        window.__composition_STORE__
          .getState()
          // 팔레트는 Components 페이지 origin 의 instance (`ref`) 를 만든다 (ADR-234 · 237).
          .elements.find(
            (e) => (e.type === t || e.type === "ref") && !before.includes(e.id),
          )?.id ?? null,
      { t: type, before },
      { timeout: 15_000 },
    )
    .then((h) => h.jsonValue())
    .catch(async () => {
      console.error(
        "added types",
        await page.evaluate(
          (before) =>
            window.__composition_STORE__
              .getState()
              .elements.filter((e) => !before.includes(e.id))
              .map((e) => e.type),
          before,
        ),
      );
      return null;
    });
  await page.waitForTimeout(800);
  await setPanel(page, "components", false);
  return id;
}

/** 요소의 props 를 교체한다 (style 은 통째로). 사용자 경로가 아닌 시드 — 옛 토글이 남긴 인라인 재현용. */
async function seed(page, id, props) {
  await page.evaluate(
    ({ id, props }) =>
      window.__composition_STORE__.getState().updateElementProps(id, props),
    { id, props },
  );
  await page.waitForTimeout(900);
}

/** Skia layout 의 자식 배치 — 부모 기준 x/y 로 row · column · grid 를 판정한다. */
async function arrangement(page, id) {
  return page.evaluate((id) => {
    const st = window.__composition_STORE__.getState();
    const el = st.elementsMap.get(id);
    const lm = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    // ref instance 의 자식은 store 에 없고 layout map 에 `<instance>/<origin 자식>` 키로만 있다.
    const own = (st.childrenMap?.get(id) ?? [])
      .map((c) => (typeof c === "string" ? st.elementsMap.get(c) : c))
      .filter(Boolean)
      .map((c) => ({ id: c.id, type: c.type }));
    const synthetic = [...lm.keys()]
      .filter((k) => k.startsWith(`${id}/`) && !k.slice(id.length + 1).includes("/"))
      .map((k) => ({ id: k, type: st.elementsMap.get(k.slice(id.length + 1))?.type ?? "?" }));
    const kids = (own.length > 0 ? own : synthetic)
      .map((c) => {
        const l = lm.get(c.id);
        return l
          ? {
              type: c.type,
              x: Math.round(l.x),
              y: Math.round(l.y),
              w: Math.round(l.width),
              h: Math.round(l.height),
            }
          : null;
      })
      .filter(Boolean);
    const ys = kids.map((k) => k.y);
    const xs = kids.map((k) => k.x);
    const sameRow = Math.max(...ys) - Math.min(...ys) <= 6;
    const sameCol = Math.max(...xs) - Math.min(...xs) <= 2;
    const kind = sameRow ? "row" : sameCol ? "column" : "grid";
    const order = [...kids]
      .sort((a, b) => (kind === "row" ? a.x - b.x : a.y - b.y || a.x - b.x))
      .map((k) => k.type)
      .join(">");
    return {
      type: el?.type,
      ref: el?.ref ?? null,
      kind,
      order,
      labelPosition: el?.props?.labelPosition ?? null,
      inline: {
        display: el?.props?.style?.display ?? null,
        flexDirection: el?.props?.style?.flexDirection ?? null,
      },
      kids,
    };
  }, id);
}

async function directionState(page) {
  const buttons = page.locator(".layout-direction .flex-direction button");
  const out = {};
  for (const [key, i] of Object.entries(DIRECTION_INDEX)) {
    const b = buttons.nth(i);
    out[key] = {
      selected: (await b.getAttribute("data-selected")) === "true",
      disabled: (await b.getAttribute("data-disabled")) === "true",
    };
  }
  return out;
}

async function clickDirection(page, key) {
  await page
    .locator(".layout-direction .flex-direction button")
    .nth(DIRECTION_INDEX[key])
    .click();
  await page.waitForTimeout(1000);
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  storageState: resolve("apps/builder/scripts/.auth-session.json"),
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const report = { checks: {}, errors };

try {
  await page.goto("http://localhost:5173/dashboard", {
    waitUntil: "networkidle",
  });
  await page.locator("button.dashboard-create-button").first().click();
  const name = page.locator("#new-project-name");
  await name.fill("labelposition-direction");
  await name.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90000 });
  await waitReady(page);
  await page.bringToFront();
  const bodyId = await page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    return st.elements.find(
      (e) => e.type === "body" && e.page_id === st.currentPageId,
    )?.id;
  });

  for (const type of TYPES) {
    const id = await addFromPalette(page, type, bodyId);
    const r = (report.checks[type] = { id });
    await seed(page, id, { label: `${type} label` });
    await page.evaluate(
      (id) => window.__composition_STORE__.getState().setSelectedElement(id),
      id,
    );
    await setPanel(page, "styles", true);
    await page.waitForTimeout(600);

    // A. 기본 (top) — 패널 표시와 Skia 배치.
    r.A_top = {
      layout: await arrangement(page, id),
      direction: await directionState(page),
    };

    // B. top 에서 Direction Row 클릭 — 무엇이 기록되고 Skia 가 어떻게 놓이나.
    await clickDirection(page, "row");
    r.B_topClickRow = {
      layout: await arrangement(page, id),
      direction: await directionState(page),
    };

    // C. Direction Column 클릭 — 되돌아가나.
    await clickDirection(page, "column");
    r.C_clickColumn = {
      layout: await arrangement(page, id),
      direction: await directionState(page),
    };

    // D. 옛 토글이 남긴 인라인 (flex column) + labelPosition side — DOM 은 인라인이 이긴다 (column).
    await seed(page, id, {
      labelPosition: "side",
      style: { display: "flex", flexDirection: "column" },
    });
    r.D_sideWithInlineColumn = {
      layout: await arrangement(page, id),
      direction: await directionState(page),
    };

    // F. D 에서 Direction Column 클릭 — labelPosition 이 top 이 되고 남은 인라인 display · flexDirection 이 지워진다.
    await clickDirection(page, "column");
    r.F_staleThenColumn = {
      layout: await arrangement(page, id),
      direction: await directionState(page),
    };

    // E. 인라인 없는 side — label > track > value 한 줄.
    await seed(page, id, { labelPosition: "side", style: {} });
    r.E_sideClean = {
      layout: await arrangement(page, id),
      direction: await directionState(page),
    };
    await page.screenshot({ path: `${OUT}/${type}.png` });
    await setPanel(page, "styles", false);
  }
} finally {
  await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
