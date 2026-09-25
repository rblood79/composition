// Styles 패널 Layout LOW 후속 — 렌더가 따르는 축 (ColorField · 인라인 방향) · inline-flex 보존 · tablet Direction.
// headed Playwright · 실제 빌더 · Compare Mode / Preview iframe 은 열지 않는다.
// 사용: node apps/builder/scripts/layout-panel-followups-live.mjs  →  output/playwright/layout-panel-followups/
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { waitReady } from "./perf-baseline.mjs";

const OUT = "output/playwright/layout-panel-followups";
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

const DIRECTION_INDEX = { block: 0, row: 1, column: 2 };

async function select(page, id) {
  await page.evaluate((id) => window.__composition_STORE__.getState().setSelectedElement(id), id);
  await setPanel(page, "styles", true);
  await page.locator(".styles-panel-groups [role='tab']").nth(0).click();
  await page.waitForTimeout(900);
}

async function directionState(page) {
  const buttons = page.locator(".layout-direction .flex-direction button");
  const out = {};
  for (const [key, i] of Object.entries(DIRECTION_INDEX)) {
    if ((await buttons.nth(i).getAttribute("data-selected")) === "true") out.selected = key;
  }
  return out.selected ?? null;
}

async function alignmentSelected(page) {
  return page
    .locator(".flex-alignment button[data-selected='true']")
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
}

/** 선택 요소의 인라인 style 과 Skia 자식 좌표 (instance 면 synthetic 자식). */
async function readNode(page, id) {
  return page.evaluate((id) => {
    const st = window.__composition_STORE__.getState();
    const el = st.elementsMap.get(id);
    const lm = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    const self = lm.get(id);
    const kids = [...lm.keys()]
      .filter((k) => k.startsWith(`${id}/`) && !k.slice(id.length + 1).includes("/"))
      .map((k) => ({ k: k.slice(id.length + 1), x: Math.round(lm.get(k).x - self.x), y: Math.round(lm.get(k).y - self.y), w: Math.round(lm.get(k).width), h: Math.round(lm.get(k).height) }));
    return { style: el?.props?.style ?? null, labelPosition: el?.props?.labelPosition ?? null, box: self ? { w: Math.round(self.width), h: Math.round(self.height) } : null, kids };
  }, id);
}

const SECTIONS = (process.env.SECTIONS ?? "A,B").split(",");
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  storageState: resolve("apps/builder/scripts/.auth-session.json"),
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const report = { checks: {}, errors };
await mkdir(OUT, { recursive: true });

try {
  await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
  await page.locator("button.dashboard-create-button").first().click();
  const name = page.locator("#new-project-name");
  await name.fill("layout-panel-followups");
  await name.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90000 });
  await waitReady(page);
  await page.bringToFront();
  const bodyId = await page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    return st.elements.find((e) => e.type === "body" && e.page_id === st.currentPageId)?.id;
  });

  // A. ColorField — catalog 기본이 row 라 top 도 row. Direction 은 Row 로 표시한다.
  if (SECTIONS.includes("A")) {
    const id = await addFromPalette(page, "ColorField", bodyId);
    await seed(page, id, { label: "Color", labelPosition: "top" });
    await select(page, id);
    const top = { direction: await directionState(page), node: await readNode(page, id) };
    await seed(page, id, { labelPosition: "side" });
    const side = { direction: await directionState(page), node: await readNode(page, id) };
    report.checks.A_ColorField = { id, top, side };
    await page.screenshot({ path: `${OUT}/A-colorfield.png` });
  }

  // B. TextField + 붙여넣기로 들어온 인라인 row — Direction · Alignment 는 렌더 축 (row) 을 쓴다.
  if (SECTIONS.includes("B")) {
    const id = await addFromPalette(page, "TextField", bodyId);
    await seed(page, id, { label: "Name", labelPosition: "top" });
    await select(page, id);
    await page.evaluate(() =>
      window.__composition_STORE__.getState().updateSelectedStyles({ display: "flex", flexDirection: "row" }),
    );
    await page.waitForTimeout(900);
    const before = { direction: await directionState(page), node: await readNode(page, id) };
    await page.locator(".flex-alignment button[aria-label='Top right']").click();
    await page.waitForTimeout(1000);
    const after = { direction: await directionState(page), alignment: await alignmentSelected(page), node: await readNode(page, id) };
    report.checks.B_TextFieldInlineRow = { id, before, after };
    await page.screenshot({ path: `${OUT}/B-textfield-inline-row.png` });
  }
  // C. block Frame 안 Button 2 개 — 정렬 점을 눌러도 inline-flex 가 유지돼 한 줄에 선다.
  if (SECTIONS.includes("C")) {
    const frameId = await addFromPalette(page, "frame", bodyId);
    await seed(page, frameId, { style: { display: "block", width: "600px" } });
    const b1 = await addFromPalette(page, "Button", frameId);
    const b2 = await addFromPalette(page, "Button", frameId);
    const rects = () =>
      page.evaluate(
        (ids) => {
          const lm = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
          return ids.map((id) => {
            const r = lm.get(id);
            return r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) } : null;
          });
        },
        [b1, b2],
      );
    const before = await rects();
    await select(page, b1);
    await page.locator(".flex-alignment button[aria-label='Top left']").click();
    await page.waitForTimeout(1000);
    const after = await rects();
    const node = await page.evaluate((id) => {
      const el = window.__composition_STORE__.getState().elementsMap.get(id);
      return { type: el?.type, props: el?.props };
    }, b1);
    const alignment = await alignmentSelected(page);
    report.checks.C_ButtonInlineFlex = { frameId, b1, b2, before, after, node, alignment };
    await page.screenshot({ path: `${OUT}/C-button-inline-flex.png` });
  }
  // D. tablet — Responsive 「+」 메뉴: TextField (라벨 위치 요소) 에는 Direction 이 없고 frame 에는 있다.
  if (SECTIONS.includes("D")) {
    const tf = await addFromPalette(page, "TextField", bodyId);
    const fr = await addFromPalette(page, "frame", bodyId);
    await page.evaluate(() => window.__composition_STORE__.getState().setActiveBreakpoint("tablet"));
    await page.waitForTimeout(900);
    const menuItems = async (id) => {
      await select(page, id);
      await page.locator(".styles-panel-groups [role='tab']").nth(3).click();
      await page.waitForTimeout(700);
      await page.locator("button[aria-label='Add Tablet override']").click();
      await page.waitForTimeout(500);
      const items = await page.locator("[role='menuitem']").allInnerTexts();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      return items.map((t) => t.trim());
    };
    const textField = await menuItems(tf);
    const frame = await menuItems(fr);
    report.checks.D_TabletDirectionMenu = {
      textFieldHasDirection: textField.includes("Direction"),
      frameHasDirection: frame.includes("Direction"),
      textField,
    };
  }
  // E. Canvas side 보조 주입 — Slider side + 인라인 block (source 순서) · TextField side + 인라인 column (FieldError x 0).
  if (SECTIONS.includes("E")) {
    const slider = await addFromPalette(page, "Slider", bodyId);
    await seed(page, slider, { label: "Volume", labelPosition: "side", style: { display: "block" } });
    const sliderNode = await readNode(page, slider);
    const tf = await addFromPalette(page, "TextField", bodyId);
    await seed(page, tf, {
      label: "Name",
      labelPosition: "side",
      isInvalid: true,
      errorMessage: "Required",
      style: { flexDirection: "column" },
    });
    const tfColumn = await readNode(page, tf);
    await seed(page, tf, { style: {} });
    const tfRow = await readNode(page, tf);
    report.checks.E_CanvasSide = { sliderBlock: sliderNode.kids, tfColumn: tfColumn.kids, tfRow: tfRow.kids };
    await page.screenshot({ path: `${OUT}/E-canvas-side.png` });
  }
} finally {
  await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
