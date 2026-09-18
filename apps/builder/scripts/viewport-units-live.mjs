// vw/vh 기준 = breakpoint page 크기 — Skia(엔진 setViewport) ↔ Preview(iframe viewport) 대조.
//   node apps/builder/scripts/viewport-units-live.mjs
// 전제: pnpm dev (5173) · .auth-session.json · Chrome MCP 는 hidden 탭이라 RAF 가 멈춰 headed Playwright 로.
import { chromium } from "playwright";
import { resolve } from "node:path";
import { waitReady } from "./perf-baseline.mjs";

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
async function addFromPalette(page, type, parentId = null) {
  await setPanel(page, "components", true);
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    parentId,
  );
  await page.waitForTimeout(300);
  const before = await page.evaluate(
    (t) =>
      window.__composition_STORE__
        .getState()
        .elements.filter((e) => e.type === t || e.componentName === t)
        .map((e) => e.id),
    type,
  );
  const search = page
    .locator('[data-panel-id="components"] input')
    .first();
  await search.waitFor({ state: "visible", timeout: 20_000 });
  await search.fill(type);
  await page.waitForTimeout(400);
  const items = page.locator(`[data-panel-id="components"] .list-item`);
  const n = await items.count();
  let item = null;
  for (let i = 0; i < n; i++) {
    const label =
      (await items.nth(i).locator(".list-item-name").textContent()) ?? "";
    if (label.replace(/\s+/g, "").toLowerCase() === type.toLowerCase()) {
      item = items.nth(i);
      break;
    }
  }
  if (!item) throw new Error(`팔레트에 ${type} 없음 (${n} items)`);
  await item.click();
  const id = await page
    .waitForFunction(
      ({ t, before }) =>
        window.__composition_STORE__
          .getState()
          .elements.find(
            (e) =>
              (e.type === t || e.componentName === t) && !before.includes(e.id),
          )?.id ?? null,
      { t: type, before },
      { timeout: 15_000 },
    )
    .then((h) => h.jsonValue());
  await page.waitForTimeout(800);
  await setPanel(page, "components", false);
  return id;
}
const readSkia = (page, id) =>
  page.evaluate((elementId) => {
    const l = window.__composition_LAYOUT_DEBUG__
      .getSharedLayoutMap()
      ?.get(elementId);
    return l ? { width: l.width, height: l.height } : null;
  }, id);
const readPreview = (page, id) =>
  page.evaluate((elementId) => {
    for (const frame of document.querySelectorAll("iframe")) {
      const el = frame.contentDocument?.querySelector(
        `[data-element-id="${elementId}"]`,
      );
      if (el) {
        const r = el.getBoundingClientRect();
        return {
          width: r.width,
          height: r.height,
          viewport: [
            frame.contentWindow.innerWidth,
            frame.contentWindow.innerHeight,
          ],
        };
      }
    }
    return null;
  }, id);
// 헤더 breakpoint 토글 (BuilderCore.handleBreakpointChange 경로 — pageWidth 는 BuilderCore 상태)
const BP_LABEL = {
  desktop: /desktop|데스크톱|데스크탑/i,
  tablet: /tablet|태블릿/i,
  mobile: /mobile|모바일/i,
};
const switchBreakpoint = async (page, bp) => {
  const radio = page.getByRole("radio", { name: BP_LABEL[bp] }).first();
  if (await radio.count()) return radio.click();
  await page.getByRole("button", { name: BP_LABEL[bp] }).first().click();
};

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  storageState: resolve("apps/builder/scripts/.auth-session.json"),
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} ${JSON.stringify(detail)}`);
};
try {
  await page.goto("http://localhost:5173/dashboard", {
    waitUntil: "networkidle",
  });
  await page.locator("button.dashboard-create-button").first().click();
  const name = page.locator("#new-project-name");
  await name.fill(`vwvh-${Date.now()}`);
  await name.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90000 });
  await waitReady(page);
  await page.bringToFront();
  const frameId = await addFromPalette(page, "frame");
  await page.evaluate(
    (id) =>
      window.__composition_STORE__.getState().updateElementProps(id, {
        style: { width: "50vw", height: "25vh", padding: "0px" },
      }),
    frameId,
  );
  await page.waitForTimeout(900);
  // compare 모드 ON
  const compare = page
    .locator(".header_right .builder-control-group button")
    .first();
  if ((await compare.getAttribute("aria-pressed")) !== "true") {
    await compare.click();
  }
  await page.waitForFunction(
    (id) =>
      [...document.querySelectorAll("iframe")].some((frame) =>
        frame.contentDocument?.querySelector(`[data-element-id="${id}"]`),
      ),
    frameId,
    { timeout: 20000 },
  );
  await page.waitForTimeout(1500);

  const expected = {
    desktop: [960, 270],
    tablet: [384, 256],
    mobile: [195, 211],
  };
  for (const bp of ["desktop", "mobile", "tablet", "desktop"]) {
    await switchBreakpoint(page, bp);
    await page.waitForTimeout(1500);
    const skia = await readSkia(page, frameId);
    const preview = await readPreview(page, frameId);
    const [ew, eh] = expected[bp];
    const near = (a, b) => Math.abs(a - b) <= 1;
    check(
      `${bp}: Skia 50vw×25vh = breakpoint 기준 (${ew}×${eh})`,
      !!skia && near(skia.width, ew) && near(skia.height, eh),
      { skia },
    );
    // Preview 는 iframe viewport 기준 — compare 모드에서 `.canvas` (flex item) 가 pane 폭으로
    //   수축하면 (desktop 1920 → pane ~720) iframe viewport ≠ breakpoint 라 별도 판정으로 둔다.
    check(
      `${bp}: Preview 50vw×25vh = iframe viewport 기준`,
      !!preview &&
        near(preview.width, preview.viewport[0] / 2) &&
        near(preview.height, preview.viewport[1] / 4),
      { preview },
    );
    check(
      `${bp}: Preview iframe viewport = breakpoint (compare pane 폭 제약 없음)`,
      !!preview &&
        near(preview.viewport[0], ew * 2) &&
        near(preview.viewport[1], eh * 4),
      { viewport: preview?.viewport, breakpoint: [ew * 2, eh * 4] },
    );
  }
} finally {
  console.log("pageerror", errors.length, errors.slice(0, 3));
  console.log(
    `SUMMARY ${results.filter((r) => r.ok).length}/${results.length}`,
  );
  await browser.close();
}
