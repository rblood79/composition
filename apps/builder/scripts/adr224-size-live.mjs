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
  await page.getByRole("option", { name: /^(채우기|Fill)$/ }).click();
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
  await page.getByRole("option", { name: /^(채우기|Fill)$/ }).click();
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
              alignSelf: s.alignSelf,
              parentAlignItems: getComputedStyle(e.parentElement).alignItems,
              parentDisplay: getComputedStyle(e.parentElement).display,
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
  const transitions = [];
  for (const testCase of ["height-fill", ...(process.argv.includes("--ratio") ? ["ratio-fixed", "ratio-fill"] : [])]) {
    const outcome = await page.evaluate(({ ids, parent, testCase }) => {
      const st = window.__composition_STORE__.getState();
      const p = st.elements.find((e) => e.id === parent);
      st.updateElementProps(parent, { style: { ...p.props.style,
        flexDirection: testCase === "height-fill" ? "column" : "row" } });
      const results = [];
      for (const [index, id] of ids.entries()) {
        const node = st.elements.find((e) => e.id === id);
        st.updateElement(id, { responsive: undefined,
          sizing: testCase === "height-fill" ? { height: { factor: index + 1 } }
            : testCase === "ratio-fill" ? { width: { factor: index + 1 } } : {},
          props: { ...node.props, style: testCase === "ratio-fixed" ? { width: "200px" } : {} } });
        if (testCase !== "height-fill") {
          // 미완료 Ratio UI 후보와 독립된 엔진 경계 진단. UI gate로 계산하지 않는다.
          const current = window.__composition_STORE__.getState().elements.find((e) => e.id === id);
          st.updateElement(id, { props: { ...current.props,
            style: { ...current.props.style, aspectRatio: "2 / 1", height: "auto", alignSelf: "start" } } });
        }
      }
      return results;
    }, { ids: [a, b], parent, testCase });
    await page.waitForTimeout(1200);
    const measured = { testCase, outcome, dom: await readDom(),
      canvas: [await readLayout(page, a), await readLayout(page, b)],
      engine: await page.evaluate((ids) => ids.map((id) => window.__composition_LAYOUT_DEBUG__.getEngineInput(id)), [a, b]) };
    transitions.push(measured);
    for (let i = 0; i < 2; i++) checks.push({ name: `${testCase} ${i}`,
      pass: outcome.every((value) => value === null) &&
        Math.abs(measured.dom[i].width - measured.canvas[i].width) <= 1 &&
        Math.abs(measured.dom[i].height - measured.canvas[i].height) <= 1,
      detail: measured,
    });
  }
  // ── ADR-224 Ratio UI gate (G1/G4) — 실제 Ratio Select · lock 버튼 · 해제 (`--ratio-ui`) ──
  // Row 900×240, a = Width Fill 2 · b = Width Fill 1 로 되돌린 뒤 실제 패널로 잠금 → preset → 해제.
  const ratioUi = [];
  if (process.argv.includes("--ratio-ui")) {
    await page.evaluate(({ parent, ids }) => {
      const st = window.__composition_STORE__.getState();
      const p = st.elements.find((e) => e.id === parent);
      st.updateElementProps(parent, { style: { ...p.props.style, flexDirection: "row" } });
      ids.forEach((id, i) => {
        const e = st.elements.find((n) => n.id === id);
        st.updateElement(id, { responsive: undefined, sizing: { width: { factor: 2 - i } },
          props: { ...e.props, style: {} } });
      });
    }, { parent, ids: [a, b] });
    await page.waitForTimeout(1000);
    await page.evaluate((id) => window.__composition_STORE__.getState().setSelectedElement(id), a);
    await page.waitForTimeout(600);
    const styles = page.locator('[data-panel-id="styles"]');
    const lock = styles.locator(".actions-ratio button");
    const readNode = (id) => page.evaluate((elementId) => {
      const e = window.__composition_STORE__.getState().elements.find((n) => n.id === elementId);
      return { style: e?.props?.style, sizing: e?.sizing, responsive: e?.responsive };
    }, id);
    const step = async (name, act, verify) => {
      const before = await historyCount(page);
      await act();
      await page.waitForTimeout(1200);
      const node = await readNode(a);
      const dom = await readDom();
      const canvas = [await readLayout(page, a), await readLayout(page, b)];
      const error = await styles.locator(".transform-ratio-error").count();
      const after = await historyCount(page);
      const parity = Math.abs(dom[0].width - canvas[0].width) <= 1 &&
        Math.abs(dom[0].height - canvas[0].height) <= 1;
      const detail = { node, dom: dom[0], canvas: canvas[0], error, history: [before, after] };
      ratioUi.push({ name, ...detail });
      checks.push({ name, pass: !error && after === before + 1 && parity && verify(node, canvas[0]), detail });
    };
    await step("Ratio lock (used size)", () => lock.click(), (n) =>
      n.style.height === "auto" && /^[\d.]+ \/ [\d.]+$/.test(String(n.style.aspectRatio)) &&
      n.sizing?.width?.factor === 2 && n.sizing?.height === null);
    await step("Ratio preset 16:9", async () => {
      await styles.locator(".aspect-ratio-select button").click();
      await page.getByRole("option", { name: /16:9/ }).click();
    }, (n, c) => n.style.aspectRatio === "16 / 9" && n.style.height === "auto" &&
      Math.abs(c.height - (c.width * 9) / 16) <= 1);
    const lockedCanvas = await readLayout(page, a);
    await step("Ratio unlock (fix used px)", () => lock.click(), (n) =>
      n.style.aspectRatio === undefined &&
      Math.abs(parseFloat(n.style.height) - lockedCanvas.height) <= 0.01 &&
      n.sizing?.width?.factor === 2 && !n.responsive?.styles?.height);
    // Undo 1회 = 해제 전 (잠금 상태) 복원
    await page.keyboard.press("Meta+z");
    await page.waitForTimeout(1000);
    const undone = await readNode(a);
    checks.push({ name: "Ratio unlock Undo 1회", pass: undone.style.aspectRatio === "16 / 9" &&
      undone.style.height === "auto", detail: undone });
    await page.keyboard.press("Meta+Shift+z");
    await page.waitForTimeout(800);
    // 저장·hydration: 해제 결과 (height px · sizing.height null) 가 refresh 뒤에도 같다
    const beforeReload = await readNode(a);
    await page.waitForTimeout(1500);
    await page.reload();
    await waitReady(page);
    await page.bringToFront();
    const afterReload = await readNode(a);
    checks.push({ name: "Ratio unlock refresh 보존",
      pass: afterReload.style?.height === beforeReload.style?.height &&
        afterReload.style?.aspectRatio === undefined && afterReload.sizing?.height === null &&
        afterReload.sizing?.width?.factor === 2,
      detail: { beforeReload, afterReload } });
  }
  // ── ADR-224 §6.1 Flow→Absolute→Flow gate (G4) — 실제 Position 토글 (`--absolute`) ──
  // a = Width Fill 2 (Row 900×240). Absolute 활성화 → 무효 Fill 만 used px Fixed · marker null ·
  // left/top 기록 · Canvas/Preview Δ≤1 → Flow 복귀 → Fixed 유지 (Fill 자동 복원 0) → Undo 2회 = Fill.
  const absolute = [];
  if (process.argv.includes("--absolute")) {
    await page.evaluate(({ parent, ids }) => {
      const st = window.__composition_STORE__.getState();
      const p = st.elements.find((e) => e.id === parent);
      st.updateElementProps(parent, { style: { ...p.props.style, flexDirection: "row" } });
      ids.forEach((id, i) => {
        const e = st.elements.find((n) => n.id === id);
        st.updateElement(id, { responsive: undefined, sizing: { width: { factor: 2 - i } },
          props: { ...e.props, style: {} } });
      });
    }, { parent, ids: [a, b] });
    await page.waitForTimeout(1000);
    await page.evaluate((id) => window.__composition_STORE__.getState().setSelectedElement(id), a);
    await page.waitForTimeout(600);
    const styles = page.locator('[data-panel-id="styles"]');
    const positionSection = styles.locator('[data-section-id="position"]');
    const header = positionSection.locator(".section-header button[aria-expanded]").first();
    if ((await header.getAttribute("aria-expanded")) !== "true") {
      await header.click();
      await page.waitForTimeout(400);
    }
    const toggle = positionSection.locator(".actions-position button");
    const readNode = (id) => page.evaluate((elementId) => {
      const e = window.__composition_STORE__.getState().elements.find((n) => n.id === elementId);
      return { style: e?.props?.style, sizing: e?.sizing, responsive: e?.responsive };
    }, id);
    const measure = async (name) => {
      await page.waitForTimeout(1200);
      const node = await readNode(a);
      const dom = await readDom();
      const canvas = [await readLayout(page, a), await readLayout(page, b)];
      const error = await styles.locator(".transform-ratio-error").count();
      const history = await historyCount(page);
      const detail = { node, dom: dom[0], canvas: canvas[0], error, history };
      absolute.push({ name, ...detail });
      return detail;
    };
    const before = await measure("before (Width Fill 2)");
    await toggle.click();
    const on = await measure("Absolute on");
    const parity = (d) => Math.abs(d.dom.width - d.canvas.width) <= 1 &&
      Math.abs(d.dom.height - d.canvas.height) <= 1;
    checks.push({ name: "Absolute: 무효 Fill → used px Fixed · marker null · inset",
      pass: !on.error && on.history === before.history + 1 &&
        on.node.style.position === "absolute" &&
        Math.abs(parseFloat(on.node.style.width) - before.canvas.width) <= 0.01 &&
        on.node.sizing?.width === null && typeof on.node.style.left === "string" &&
        Math.abs(on.canvas.width - before.canvas.width) <= 0.01 && parity(on),
      detail: { before, on } });
    await toggle.click();
    const off = await measure("Absolute off (Flow)");
    checks.push({ name: "Flow 복귀: Fixed 유지 · Fill 자동 복원 0",
      pass: !off.error && off.history === on.history + 1 &&
        off.node.style.position === undefined &&
        off.node.style.width === on.node.style.width && off.node.sizing?.width === null &&
        Math.abs(off.canvas.width - before.canvas.width) <= 0.01 && parity(off),
      detail: { on, off } });
    await page.keyboard.press("Meta+z");
    await page.keyboard.press("Meta+z");
    const undone = await measure("Undo ×2");
    checks.push({ name: "Undo 2회 = Width Fill 2 복원",
      pass: undone.node.sizing?.width?.factor === 2 && undone.node.style.position === undefined &&
        undone.node.style.width === undefined && parity(undone),
      detail: undone });
  }
  // ── ADR-224 §4.3 · §5 캔버스 핸들 resize gate (G4) — 실제 마우스 드래그 (`--resize`) ──
  // a = Width Fill 2 + Height Fill 1 (Row 900×240). 우측 엣지 −100 screen px → width 만 Fixed px ·
  // marker null · Height Fill 보존 · b 가 남은 폭 · Canvas/Preview Δ≤1 · history +1 → Undo 1회 = Fill.
  // 그다음 Ratio 잠금 → 아래 엣지 +60 → driver Width 하나만 (목표 H × ratio) · height auto 유지.
  const resize = [];
  if (process.argv.includes("--resize")) {
    await page.evaluate(({ parent, ids }) => {
      const st = window.__composition_STORE__.getState();
      const p = st.elements.find((e) => e.id === parent);
      st.updateElementProps(parent, { style: { ...p.props.style, flexDirection: "row" } });
      ids.forEach((id, i) => {
        const e = st.elements.find((n) => n.id === id);
        st.updateElement(id, { responsive: undefined,
          sizing: i === 0 ? { width: { factor: 2 }, height: { factor: 1 } } : { width: { factor: 1 } },
          props: { ...e.props, style: {} } });
      });
    }, { parent, ids: [a, b] });
    await page.waitForTimeout(1000);
    await page.evaluate((id) => window.__composition_STORE__.getState().setSelectedElement(id), a);
    await page.waitForTimeout(600);
    const styles = page.locator('[data-panel-id="styles"]');
    const readNode = (id) => page.evaluate((elementId) => {
      const e = window.__composition_STORE__.getState().elements.find((n) => n.id === elementId);
      return { style: e?.props?.style, sizing: e?.sizing, responsive: e?.responsive };
    }, id);
    /** 선택 박스 핸들의 화면 좌표 (scene bounds → screen) */
    const handlePoint = (id, handle) => page.evaluate(({ elementId, handle }) => {
      const r = window.__composition_RESIZE_DEBUG__.getSceneBounds(elementId);
      if (!r) return null;
      const vp = window.__composition_VIEWPORT__();
      const rect = document.querySelector("canvas").getBoundingClientRect();
      const sx = handle.includes("left") ? r.x : handle.includes("right") ? r.x + r.width : r.x + r.width / 2;
      const sy = handle.includes("top") ? r.y : handle.includes("bottom") ? r.y + r.height : r.y + r.height / 2;
      return { x: sx * vp.zoom + vp.panOffset.x + rect.left, y: sy * vp.zoom + vp.panOffset.y + rect.top,
        zoom: vp.zoom, bounds: r };
    }, { elementId: id, handle });
    /** 요소가 화면 안에 오도록 카메라 이동 — 새 프로젝트 템플릿은 카메라가 다른 곳을 본다 (ADR-222 focusOwner 어법) */
    const focusElement = async (id, handle) => {
      await page.evaluate(({ elementId, handle }) => {
        const r = window.__composition_RESIZE_DEBUG__.getSceneBounds(elementId);
        if (!r) return;
        const scale = window.__composition_VIEWPORT__().zoom;
        const rect = document.querySelector("canvas").getBoundingClientRect();
        const sx = handle.includes("left") ? r.x : handle.includes("right") ? r.x + r.width : r.x + r.width / 2;
        const sy = handle.includes("top") ? r.y : handle.includes("bottom") ? r.y + r.height : r.y + r.height / 2;
        // 잡을 핸들을 캔버스 폭 40% · 높이 45% 에 — 우측에 떠 있는 Styles 패널 아래로 들어가지 않게
        window.__composition_APPLY_VIEWPORT__({
          scale,
          x: rect.width * 0.4 - sx * scale,
          y: rect.height * 0.45 - sy * scale,
        });
      }, { elementId: id, handle });
      await page.waitForTimeout(700);
    };
    const dragHandle = async (handle, dx, dy) => {
      await focusElement(a, handle);
      const from = await handlePoint(a, handle);
      await page.mouse.move(from.x, from.y);
      await page.waitForTimeout(100);
      await page.mouse.down();
      const steps = 10;
      for (let i = 1; i <= steps; i++) {
        await page.mouse.move(from.x + (dx * i) / steps, from.y + (dy * i) / steps);
        await page.waitForTimeout(30);
      }
      const mid = await page.evaluate(() => window.__composition_RESIZE_DEBUG__.getActiveSession());
      // 미리보기는 command stream (scene bounds) 에 실린다 — 공유 layout map 은 commit 뒤에야 바뀐다
      const midCanvas = await page.evaluate((id) => {
        const r = window.__composition_RESIZE_DEBUG__.getSceneBounds(id);
        return r ? { width: r.width, height: r.height } : null;
      }, a);
      await page.mouse.up();
      await page.waitForTimeout(1200);
      return { from, mid, midCanvas };
    };
    const measure = async (name, extra = {}) => {
      const node = await readNode(a);
      const dom = await readDom();
      const canvas = [await readLayout(page, a), await readLayout(page, b)];
      const history = await historyCount(page);
      const detail = { node, dom: dom[0], domB: dom[1], canvas: canvas[0], canvasB: canvas[1], history, ...extra };
      resize.push({ name, ...detail });
      return detail;
    };
    const parity = (d) => Math.abs(d.dom.width - d.canvas.width) <= 1 &&
      Math.abs(d.dom.height - d.canvas.height) <= 1 &&
      Math.abs(d.domB.width - d.canvasB.width) <= 1;
    const before = await measure("before (Width Fill 2 · Height Fill 1)");
    const zoom = (await handlePoint(a, "middle-right")).zoom;
    const drag1 = await dragHandle("middle-right", -100, 0);
    const expectedW = Math.round(before.canvas.width - 100 / zoom);
    const after1 = await measure("우측 엣지 −100px", drag1);
    checks.push({ name: "Resize 우측 엣지: width 만 Fixed px · marker null · Height Fill 보존",
      pass: after1.history === before.history + 1 &&
        after1.node.style.width === `${expectedW}px` && after1.node.sizing?.width === null &&
        after1.node.sizing?.height?.factor === 1 && after1.node.style.height === undefined &&
        after1.node.style.flexGrow === undefined &&
        Math.abs(after1.canvas.width - expectedW) <= 0.01 &&
        Math.abs(after1.canvas.height - before.canvas.height) <= 0.01 &&
        // 드래그 중 미리보기가 이미 그 폭 (presentation lane) · b 가 남은 폭을 가져간다
        Math.abs(drag1.midCanvas.width - expectedW) <= 0.01 &&
        after1.canvasB.width > before.canvasB.width + 50 && parity(after1),
      detail: { before, after1, expectedW } });
    await page.keyboard.press("Meta+z");
    await page.waitForTimeout(1000);
    const undone1 = await measure("Undo 1회");
    checks.push({ name: "Resize Undo 1회 = Width Fill 2 복원",
      pass: undone1.node.sizing?.width?.factor === 2 && undone1.node.style.width === undefined &&
        Math.abs(undone1.canvas.width - before.canvas.width) <= 0.01 && parity(undone1),
      detail: undone1 });
    // Ratio 잠금 (실제 lock 버튼) → 아래 엣지 +60 → driver Width 하나만
    await styles.locator(".actions-ratio button").click();
    await page.waitForTimeout(1200);
    const locked = await measure("Ratio lock");
    const ratio = locked.canvas.width / locked.canvas.height;
    // 목표 H 는 줄이는 방향 — 늘리면 driver Width 가 Row 900 을 넘어 shrink 로 잘린다 (별도 계약)
    const drag2 = await dragHandle("bottom-center", 0, -30);
    const expectedW2 = Math.round((locked.canvas.height - 30 / zoom) * ratio);
    const after2 = await measure("Ratio 잠금 + 아래 엣지 −30px", drag2);
    checks.push({ name: "Resize Ratio: 세로 드래그 → driver Width 만 px (목표 H × ratio) · height auto 유지",
      pass: after2.history === locked.history + 1 &&
        after2.node.style.width === `${expectedW2}px` && after2.node.style.height === "auto" &&
        after2.node.style.aspectRatio === locked.node.style.aspectRatio &&
        after2.node.sizing?.width === null &&
        Math.abs(after2.canvas.width - expectedW2) <= 0.01 &&
        Math.abs(after2.canvas.height - expectedW2 / ratio) <= 1 && parity(after2),
      detail: { locked, after2, expectedW2 } });
    await page.keyboard.press("Meta+z");
    await page.waitForTimeout(1000);
    const undone2 = await measure("Ratio resize Undo 1회");
    checks.push({ name: "Ratio resize Undo 1회 = 잠금 상태 (Width Fill 2 · height auto) 복원",
      pass: undone2.node.sizing?.width?.factor === 2 && undone2.node.style.width === undefined &&
        undone2.node.style.height === "auto" && parity(undone2),
      detail: undone2 });
    // ── absolute 요소의 left/top 핸들 — 반대 변 고정 (`--resize-abs`) ──
    if (process.argv.includes("--resize-abs")) {
      // 잠금 해제 상태에서 Absolute on (a: Width Fill 2 → used px · left/top 0)
      await page.keyboard.press("Meta+z"); // Ratio lock 해제
      await page.waitForTimeout(800);
      const positionSection = styles.locator('[data-section-id="position"]');
      const header = positionSection.locator(".section-header button[aria-expanded]").first();
      if ((await header.getAttribute("aria-expanded")) !== "true") {
        await header.click();
        await page.waitForTimeout(400);
      }
      await positionSection.locator(".actions-position button").click();
      const absOn = await measure("Absolute on (resize-abs)");
      const dragL = await dragHandle("middle-left", 50, 0);
      const wL = Math.round(absOn.canvas.width - 50 / zoom);
      const leftL = Math.round((parseFloat(absOn.node.style.left) + (absOn.canvas.width - wL)) * 100) / 100;
      const afterL = await measure("absolute 좌측 엣지 +50px", dragL);
      checks.push({ name: "absolute 좌측 엣지: width 줄고 left 이동 (우측 변 고정) · 드래그 중 x 도 이동",
        pass: afterL.history === absOn.history + 1 &&
          afterL.node.style.width === `${wL}px` && afterL.node.style.left === `${leftL}px` &&
          Math.abs(afterL.canvas.x - (absOn.canvas.x + (absOn.canvas.width - wL))) <= 0.01 &&
          Math.abs(afterL.canvas.x + afterL.canvas.width - (absOn.canvas.x + absOn.canvas.width)) <= 0.01 &&
          Math.abs(dragL.midCanvas.width - wL) <= 0.01 &&
          Math.abs(afterL.dom.width - afterL.canvas.width) <= 1,
        detail: { absOn, afterL, wL, leftL } });
      const dragTL = await dragHandle("top-left", -30, -20);
      const wTL = Math.round(afterL.canvas.width + 30 / zoom);
      const hTL = Math.round(afterL.canvas.height + 20 / zoom);
      const afterTL = await measure("absolute 좌상 코너 −30/−20", dragTL);
      checks.push({ name: "absolute 좌상 코너: 두 축 + left/top 이동 (우하 변 고정)",
        pass: afterTL.history === afterL.history + 1 &&
          afterTL.node.style.width === `${wTL}px` && afterTL.node.style.height === `${hTL}px` &&
          Math.abs(parseFloat(afterTL.node.style.left) - (leftL - (wTL - wL))) <= 0.01 &&
          Math.abs(parseFloat(afterTL.node.style.top) - (parseFloat(afterL.node.style.top) - (hTL - afterL.canvas.height))) <= 0.01 &&
          Math.abs(afterTL.canvas.x + afterTL.canvas.width - (afterL.canvas.x + afterL.canvas.width)) <= 0.01 &&
          Math.abs(afterTL.canvas.y + afterTL.canvas.height - (afterL.canvas.y + afterL.canvas.height)) <= 0.01 &&
          Math.abs(afterTL.dom.width - afterTL.canvas.width) <= 1 &&
          Math.abs(afterTL.dom.height - afterTL.canvas.height) <= 1,
        detail: { afterL, afterTL, wTL, hTL } });
      await page.keyboard.press("Meta+z");
      await page.keyboard.press("Meta+z");
      await page.waitForTimeout(1000);
      const absUndone = await measure("absolute resize Undo ×2");
      checks.push({ name: "absolute resize Undo ×2 = Absolute on 직후 상태",
        pass: absUndone.node.style.width === absOn.node.style.width &&
          absUndone.node.style.left === absOn.node.style.left && absUndone.node.style.top === absOn.node.style.top &&
          absUndone.node.style.height === absOn.node.style.height,
        detail: absUndone });
      await page.keyboard.press("Meta+z"); // Absolute off
      await page.waitForTimeout(800);
      await styles.locator(".actions-ratio button").click(); // Ratio lock 복원 (다음 단계 전제)
      await page.waitForTimeout(1000);
    }
    // 클릭 (임계값 미만) 은 저장 0
    await focusElement(a, "middle-right");
    const tapFrom = await handlePoint(a, "middle-right");
    await page.mouse.move(tapFrom.x, tapFrom.y);
    await page.mouse.down();
    await page.mouse.move(tapFrom.x + 1, tapFrom.y);
    await page.mouse.up();
    await page.waitForTimeout(600);
    const tapped = await measure("핸들 클릭 (1px)");
    checks.push({ name: "핸들 클릭 (임계값 미만) 저장 0",
      pass: tapped.history === undone2.history && tapped.node.style.width === undefined,
      detail: tapped });
  }
  // ── ADR-224 다중 선택 Ratio/Absolute gate (G1/G4) — a+b 동시 선택으로 실제 패널 명령 (`--multi`) ──
  // a = Width Fill 2 · b = Width Fill 1 (Row 900×240). Ratio lock → 각자 own used 비율 · history +1 →
  // Undo 1회 → Absolute on → 각자 own used px · own left · history +1 → Undo 1회.
  const multi = [];
  if (process.argv.includes("--multi")) {
    await page.evaluate(({ parent, ids }) => {
      const st = window.__composition_STORE__.getState();
      const p = st.elements.find((e) => e.id === parent);
      st.updateElementProps(parent, { style: { ...p.props.style, flexDirection: "row" } });
      ids.forEach((id, i) => {
        const e = st.elements.find((n) => n.id === id);
        st.updateElement(id, { responsive: undefined, sizing: { width: { factor: 2 - i } },
          props: { ...e.props, style: {} } });
      });
    }, { parent, ids: [a, b] });
    await page.waitForTimeout(1000);
    await page.evaluate((ids) => window.__composition_STORE__.getState().setSelectedElements(ids), [a, b]);
    await page.waitForTimeout(800);
    const styles = page.locator('[data-panel-id="styles"]');
    const readNode = (id) => page.evaluate((elementId) => {
      const e = window.__composition_STORE__.getState().elements.find((n) => n.id === elementId);
      return { style: e?.props?.style, sizing: e?.sizing, responsive: e?.responsive };
    }, id);
    const measure = async (name) => {
      await page.waitForTimeout(1200);
      const nodes = [await readNode(a), await readNode(b)];
      const dom = await readDom();
      const canvas = [await readLayout(page, a), await readLayout(page, b)];
      const error = await styles.locator(".transform-ratio-error").count();
      const history = await historyCount(page);
      const selected = await page.evaluate(() => window.__composition_STORE__.getState().selectedElementIds);
      const detail = { nodes, dom, canvas, error, history, selected };
      multi.push({ name, ...detail });
      return detail;
    };
    const parity = (d) => [0, 1].every((i) => Math.abs(d.dom[i].width - d.canvas[i].width) <= 1 &&
      Math.abs(d.dom[i].height - d.canvas[i].height) <= 1);
    const before = await measure("before (a Fill 2 · b Fill 1, 둘 선택)");
    const lock = styles.locator(".actions-ratio button");
    await lock.click();
    const locked = await measure("multi Ratio lock");
    const ratioOf = (n) => String(n.style.aspectRatio ?? "");
    checks.push({ name: "multi Ratio lock: 둘 다 own used 비율 · height auto · history +1",
      pass: !locked.error && locked.history === before.history + 1 &&
        ratioOf(locked.nodes[0]) === `${Math.round(before.canvas[0].width * 100) / 100} / 240` &&
        ratioOf(locked.nodes[1]) === `${Math.round(before.canvas[1].width * 100) / 100} / 240` &&
        locked.nodes.every((n) => n.style.height === "auto" && n.sizing?.height === null) &&
        locked.nodes[0].sizing?.width?.factor === 2 && locked.nodes[1].sizing?.width?.factor === 1 &&
        parity(locked),
      detail: { before, locked } });
    await page.keyboard.press("Meta+z");
    const unlocked = await measure("multi Ratio Undo 1회");
    checks.push({ name: "multi Ratio Undo 1회: 둘 다 복원",
      pass: unlocked.history === before.history &&
        unlocked.nodes.every((n) => n.style.aspectRatio === undefined && n.style.height === undefined) &&
        parity(unlocked),
      detail: unlocked });
    const positionSection = styles.locator('[data-section-id="position"]');
    const header = positionSection.locator(".section-header button[aria-expanded]").first();
    if ((await header.getAttribute("aria-expanded")) !== "true") {
      await header.click();
      await page.waitForTimeout(400);
    }
    await positionSection.locator(".actions-position button").click();
    const abs = await measure("multi Absolute on");
    checks.push({ name: "multi Absolute on: 둘 다 own used px · own left · marker null · history +1",
      pass: !abs.error && abs.history === before.history + 1 &&
        abs.nodes.every((n) => n.style.position === "absolute" && n.sizing?.width === null) &&
        Math.abs(parseFloat(abs.nodes[0].style.width) - before.canvas[0].width) <= 0.01 &&
        Math.abs(parseFloat(abs.nodes[1].style.width) - before.canvas[1].width) <= 0.01 &&
        Math.abs(parseFloat(abs.nodes[0].style.left) - before.canvas[0].x) <= 0.01 &&
        Math.abs(parseFloat(abs.nodes[1].style.left) - before.canvas[1].x) <= 0.01 &&
        Math.abs(abs.canvas[1].x - before.canvas[1].x) <= 0.01 && parity(abs),
      detail: { before, abs } });
    await page.keyboard.press("Meta+z");
    const absUndone = await measure("multi Absolute Undo 1회");
    checks.push({ name: "multi Absolute Undo 1회: 둘 다 Fill 복원",
      pass: absUndone.history === before.history &&
        absUndone.nodes[0].sizing?.width?.factor === 2 && absUndone.nodes[1].sizing?.width?.factor === 1 &&
        absUndone.nodes.every((n) => n.style.position === undefined && n.style.width === undefined) &&
        parity(absUndone),
      detail: absUndone });
  }
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
    transitions,
    ratioUi,
    absolute,
    resize,
    multi,
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
