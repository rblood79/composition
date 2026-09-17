import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
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
    .locator(
      '[data-panel-id="components"] input[type="search"], [data-panel-id="components"] input',
    )
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
    .then((h) => h.jsonValue())
    .catch(() => null);
  await page.waitForTimeout(800);
  if (!id) throw new Error(`${type} 미생성`);
  await setPanel(page, "components", false);
  return id;
}

const readStyle = (page, id) =>
  page.evaluate((elementId) => {
    const st = window.__composition_STORE__.getState();
    const el = st.elements.find((e) => e.id === elementId);
    return el?.props?.style ?? null;
  }, id);
const readLayout = (page, id) =>
  page.evaluate((elementId) => {
    const l = window.__composition_LAYOUT_DEBUG__
      .getSharedLayoutMap()
      ?.get(elementId);
    return l ? { x: l.x, y: l.y, width: l.width, height: l.height } : null;
  }, id);
const historyCount = (page) =>
  page.evaluate(
    () =>
      window.__composition_HISTORY_DEBUG__?.getCurrentPageHistory()
        .currentIndex ?? null,
  );
const phase = process.argv[2] ?? "after";
const out = `output/playwright/adr224/${phase}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  storageState: resolve("apps/builder/scripts/.auth-session.json"),
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
async function installEngineProbe() {
  await page.evaluate(() => {
    window.__adr224EngineInputs = {
      get: (id) => window.__composition_LAYOUT_DEBUG__.getEngineInput(id),
    };
  });
}
try {
  await page.goto("http://localhost:5173/dashboard", {
    waitUntil: "networkidle",
  });
  await page.locator("button.dashboard-create-button").first().click();
  const name = page.locator("#new-project-name");
  await name.fill(`adr224-g0-${Date.now()}`);
  await name.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90000 });
  await waitReady(page);
  await page.bringToFront();
  await installEngineProbe();
  const parent = await addFromPalette(page, "frame");
  await page.evaluate(
    (id) =>
      window.__composition_STORE__
        .getState()
        .updateElementProps(id, {
          style: {
            display: "flex",
            flexDirection: "row",
            width: "900px",
            height: "240px",
            gap: "0px",
            padding: "0px",
          },
        }),
    parent,
  );
  const a = await addFromPalette(page, "Button", parent);
  const b = await addFromPalette(page, "Button", parent);
  await setPanel(page, "components", false);
  await setPanel(page, "styles", true);
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    a,
  );
  await page.waitForTimeout(900);
  console.log("fixture", JSON.stringify({ parent, a, b, url: page.url() }));
  console.log(
    "panel",
    await page.locator('[data-panel-id="styles"]').innerText(),
  );
  const width = page.locator('[data-panel-id="styles"] fieldset.width');
  await width.locator("button").click();
  console.log("options", await page.getByRole("listbox").innerText());
  await page.getByRole("option", { name: "채우기", exact: true }).click();
  await page.waitForTimeout(500);
  const read = () =>
    page.evaluate((id) => {
      const st = window.__composition_STORE__.getState();
      const e = st.elements.find((e) => e.id === id);
      return {
        style: e?.props.style,
        sizing: e?.sizing,
        engineInput: window.__adr224EngineInputs?.get(id),
        layout: window.__composition_LAYOUT_DEBUG__
          .getSharedLayoutMap()
          ?.get(id),
      };
    }, a);
  const afterFill = await read();
  await page.screenshot({ path: `${out}/g0-fill.png` });
  await width.locator("input").fill("2");
  await width.locator("input").press("Enter");
  await page.waitForTimeout(500);
  const afterNumber = await read();
  await page.screenshot({ path: `${out}/g0-number.png` });
  const checks = [];
  const assert = (name, pass, detail) => {
    checks.push({ name, pass, detail });
    if (!pass) throw new Error(`${name}: ${JSON.stringify(detail)}`);
  };
  assert("Fill 단독 적용", afterFill.sizing?.width?.factor === 1, afterFill);
  assert(
    "숫자2=Fill 가중치2",
    afterNumber.sizing?.width?.factor === 2 && !afterNumber.style.width,
    afterNumber,
  );
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    b,
  );
  await page.waitForTimeout(500);
  await width.locator("button").click();
  await page.getByRole("option", { name: "채우기", exact: true }).click();
  await page.waitForTimeout(500);
  const rowA = await readLayout(page, a),
    rowB = await readLayout(page, b);
  await page.evaluate((id) => {
    const st = window.__composition_STORE__.getState();
    const p = st.elements.find((e) => e.id === id);
    st.updateElementProps(id, {
      style: { ...p.props.style, flexDirection: "column" },
    });
  }, parent);
  await page.waitForTimeout(800);
  const column = await read();
  assert("방향 변경 factor 보존", column.sizing.width.factor === 2, column);
  await page.evaluate((id) => {
    const st = window.__composition_STORE__.getState();
    const p = st.elements.find((e) => e.id === id);
    st.updateElementProps(id, {
      style: { ...p.props.style, flexDirection: "row" },
    });
  }, parent);
  await page.waitForTimeout(800);
  assert(
    "Row 왕복 기하 보존",
    Math.abs((await readLayout(page, a)).width - rowA.width) < 1,
    await readLayout(page, a),
  );
  // IndexedDB 저장 후 동일 탭 refresh hydration
  await page.waitForTimeout(1500);
  await page.reload();
  await waitReady(page);
  await page.bringToFront();
  await installEngineProbe();
  const hydrated = await read();
  assert("refresh Fill 보존", hydrated.sizing?.width?.factor === 2, hydrated);
  const compare = page
    .locator(".header_right .builder-control-group button")
    .first();
  if (
    (await compare.getAttribute("aria-pressed")) !== "true" &&
    (await compare.getAttribute("aria-checked")) !== "true"
  )
    await compare.click();
  await page.waitForTimeout(2000);
  await page.evaluate((id) => {
    const st = window.__composition_STORE__.getState();
    const p = st.elements.find((e) => e.id === id);
    st.updateElementProps(id, {
      style: { ...p.props.style, flexDirection: "row" },
    });
  }, parent);
  await page.waitForFunction(
    (id) =>
      [...document.querySelectorAll("iframe")].some((f) =>
        f.contentDocument?.querySelector(`[data-element-id="${id}"]`),
      ),
    a,
    { timeout: 20000 },
  );
  const readDom = () =>
    page.evaluate(
      (ids) => {
        for (const f of document.querySelectorAll("iframe")) {
          const d = f.contentDocument;
          if (!d?.querySelector(`[data-element-id="${ids[0]}"]`)) continue;
          return ids.map((id) => {
            const e = d.querySelector(`[data-element-id="${id}"]`);
            const r = e.getBoundingClientRect(),
              s = getComputedStyle(e);
            return {
              id,
              width: r.width,
              height: r.height,
              grow: s.flexGrow,
              basis: s.flexBasis,
              min: s.minWidth,
            };
          });
        }
      },
      [a, b],
    );
  const dom = await readDom();
  const canvas = [await readLayout(page, a), await readLayout(page, b)];
  const rowEngineInputs = await page.evaluate(
    (ids) => ids.map((id) => window.__adr224EngineInputs?.get(id)),
    [a, b],
  );
  for (let i = 0; i < 2; i++)
    checks.push({
      name: `Canvas/Preview ${i}`,
      pass:
        Math.abs(dom[i].width - canvas[i].width) <= 1 &&
        Math.abs(dom[i].height - canvas[i].height) <= 1,
      detail: { dom: dom[i], canvas: canvas[i] },
    });
  await page.evaluate((id) => {
    const st = window.__composition_STORE__.getState();
    const p = st.elements.find((e) => e.id === id);
    st.updateElementProps(id, {
      style: { ...p.props.style, flexDirection: "column" },
    });
  }, parent);
  await page.waitForTimeout(800);
  const cross = {
    dom: await readDom(),
    canvas: [await readLayout(page, a), await readLayout(page, b)],
    engineInputs: await page.evaluate(
      (ids) => ids.map((id) => window.__adr224EngineInputs?.get(id)),
      [a, b],
    ),
  };
  for (let i = 0; i < 2; i++)
    checks.push({
      name: `Column Canvas/Preview ${i}`,
      pass: Math.abs(cross.dom[i].width - cross.canvas[i].width) <= 1 &&
        Math.abs(cross.dom[i].height - cross.canvas[i].height) <= 1,
      detail: { dom: cross.dom[i], canvas: cross.canvas[i] },
    });
  await page.evaluate((id) => {
    const st = window.__composition_STORE__.getState();
    const p = st.elements.find((e) => e.id === id);
    st.updateElementProps(id, {
      style: { ...p.props.style, flexDirection: "row" },
    });
  }, parent);
  await page.waitForTimeout(800);
  await page.evaluate(
    (ids) => {
      const st = window.__composition_STORE__.getState();
      for (let i = 0; i < ids.length; i++) {
        const e = st.elements.find((e) => e.id === ids[i]);
        st.updateElement(ids[i], {
          sizing: {},
          props: {
            ...e.props,
            style: {
              ...e.props.style,
              flexGrow: String(i === 0 ? 2 : 1),
              flexShrink: "1",
              flexBasis: "0%",
            },
          },
        });
      }
    },
    [a, b],
  );
  await page.waitForTimeout(1200);
  const legacy = {
    dom: await readDom(),
    canvas: [await readLayout(page, a), await readLayout(page, b)],
  };
  // 수정의 음성 대조: Fill/CSS grow가 없는 기본 Button의 catalog fit-content.
  await page.evaluate(({ parent, ids }) => {
    const st = window.__composition_STORE__.getState();
    const p = st.elements.find((e) => e.id === parent);
    st.updateElementProps(parent, { style: { ...p.props.style, flexDirection: "column" } });
    for (const id of ids) {
      const e = st.elements.find((node) => node.id === id);
      st.updateElement(id, { sizing: {}, props: { ...e.props, style: {} } });
    }
  }, { parent, ids: [a, b] });
  await page.waitForTimeout(1000);
  const defaultColumn = {
    dom: await readDom(),
    canvas: [await readLayout(page, a), await readLayout(page, b)],
    engineInputs: await page.evaluate(
      (ids) => ids.map((id) => window.__adr224EngineInputs?.get(id)), [a, b],
    ),
  };
  for (let i = 0; i < 2; i++) checks.push({
    name: `기본 Button Column ${i}`,
    pass: Math.abs(defaultColumn.dom[i].width - defaultColumn.canvas[i].width) <= 1 &&
      Math.abs(defaultColumn.dom[i].height - defaultColumn.canvas[i].height) <= 1,
    detail: { dom: defaultColumn.dom[i], canvas: defaultColumn.canvas[i] },
  });
  console.log(
    "PARITY_CONTROL",
    JSON.stringify({ semantic: { dom, canvas }, cross, legacy }),
  );
  await page.screenshot({ path: `${out}/g3-parity.png` });
  const environment = await page.evaluate(() => ({
    visibility: document.visibilityState,
    dpr: devicePixelRatio,
    viewport: [innerWidth, innerHeight],
    zoom: window.__composition_STORE__.getState().zoom,
    activeBreakpoint: window.__composition_STORE__.getState().activeBreakpoint,
  }));
  const result = {
    environment,
    parent,
    a,
    b,
    url: page.url(),
    afterFill,
    afterNumber,
    rowA,
    rowB,
    column,
    hydrated,
    dom,
    canvas,
    rowEngineInputs,
    cross,
    legacy,
    defaultColumn,
    checks,
    errors,
  };
  await writeFile(`${out}/g0.json`, JSON.stringify(result, null, 2));
  console.log("G0", JSON.stringify(result));
  if (checks.some((check) => !check.pass)) process.exitCode = 1;
} catch (error) {
  await page.screenshot({ path: `${out}/failure.png` });
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
