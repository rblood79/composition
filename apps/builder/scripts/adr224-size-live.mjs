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
// History hot cache는 50개 상한이라 index 49에서 새 entry가 들어오면 오래된 entry가
// shift되고 currentIndex는 49에 머문다. 장시간 통합 run에서도 +1 transaction을 오탐하지 않는다.
const historyAdvancedOnce = (before, after) =>
  after === before + 1 || (before === 49 && after === 49);
const historyIndexAfterUndo = (before, afterCommit) =>
  afterCommit === before ? before - 1 : before;
const phase = process.argv[2] ?? "after";
const out = `output/playwright/adr224/${phase}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  storageState: resolve("apps/builder/scripts/.auth-session.json"),
  viewport: { width: 1440, height: 900 },
  // `--roundtrip` 의 ⌘C/⌘V (실제 클립보드 경로)
  permissions: ["clipboard-read", "clipboard-write"],
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
async function ensureComparePreview(elementId) {
  const compare = page
    .locator(".header_right .builder-control-group button")
    .first();
  if (
    (await compare.getAttribute("aria-pressed")) !== "true" &&
    (await compare.getAttribute("aria-checked")) !== "true"
  ) {
    await compare.click();
  }
  await page.waitForTimeout(2000);
  await page.waitForFunction(
    (id) =>
      [...document.querySelectorAll("iframe")].some((frame) =>
        frame.contentDocument?.querySelector(`[data-element-id="${id}"]`),
      ),
    elementId,
    { timeout: 20000 },
  );
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
  await ensureComparePreview(a);
  await page.evaluate((id) => {
    const st = window.__composition_STORE__.getState();
    const p = st.elements.find((e) => e.id === id);
    st.updateElementProps(id, {
      style: { ...p.props.style, flexDirection: "row" },
    });
  }, parent);
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
              x: r.x,
              y: r.y,
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
  // ── ADR-224 G3: wrap line collection은 flex basis가 아니라 min/max가 반영된
  // outer hypothetical main size를 사용한다 (`--wrap-min`).
  let wrapMin = null;
  if (process.argv.includes("--wrap-min")) {
    await page.evaluate(
      ({ parent, ids }) => {
        const st = window.__composition_STORE__.getState();
        const p = st.elements.find((e) => e.id === parent);
        st.updateElementProps(parent, {
          style: {
            ...p.props.style,
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            width: "300px",
            height: "auto",
            gap: "0px",
          },
        });
        ids.forEach((id) => {
          const node = st.elements.find((e) => e.id === id);
          st.updateElement(id, {
            responsive: undefined,
            sizing: { width: { factor: 1 } },
            props: {
              ...node.props,
              style: { minWidth: "200px", height: "20px" },
            },
          });
        });
      },
      { parent, ids: [a, b] },
    );
    await page.waitForTimeout(1500);
    const wrapDom = await readDom();
    const wrapCanvas = [await readLayout(page, a), await readLayout(page, b)];
    wrapMin = { dom: wrapDom, canvas: wrapCanvas };
    checks.push({
      name: "wrap + Fill + Min: hypothetical main size로 두 줄 수집 · Canvas/Preview Δ≤1",
      pass:
        wrapDom.every(
          (entry, index) =>
            Math.abs(entry.width - wrapCanvas[index].width) <= 1 &&
            Math.abs(entry.height - wrapCanvas[index].height) <= 1,
        ) &&
        Math.abs(
          wrapDom[1].y - wrapDom[0].y - (wrapCanvas[1].y - wrapCanvas[0].y),
        ) <= 1 &&
        wrapDom[1].y > wrapDom[0].y &&
        wrapCanvas[1].y > wrapCanvas[0].y,
      detail: wrapMin,
    });
    await page.evaluate(
      ({ parent, ids }) => {
        const st = window.__composition_STORE__.getState();
        const p = st.elements.find((e) => e.id === parent);
        st.updateElementProps(parent, {
          style: {
            ...p.props.style,
            flexDirection: "row",
            flexWrap: "nowrap",
            width: "900px",
            height: "240px",
          },
        });
        ids.forEach((id, index) => {
          const node = st.elements.find((e) => e.id === id);
          st.updateElement(id, {
            responsive: undefined,
            sizing: { width: { factor: 2 - index } },
            props: { ...node.props, style: {} },
          });
        });
      },
      { parent, ids: [a, b] },
    );
    await page.waitForTimeout(1000);
  }
  // ── ADR-224 Min/Max authoring: 동일 단위 역전 commit은 거부하고 오류를 보이며,
  // 다음 유효 commit은 정상 저장한다 (`--constraints`).
  let constraints = null;
  if (process.argv.includes("--constraints")) {
    await page.evaluate((id) => {
      const st = window.__composition_STORE__.getState();
      const node = st.elements.find((e) => e.id === id);
      st.updateElement(id, {
        responsive: undefined,
        sizing: {},
        props: { ...node.props, style: { width: "300px", height: "100px" } },
      });
      st.setSelectedElement(id);
    }, a);
    await page.waitForTimeout(800);
    const styles = page.locator('[data-panel-id="styles"]');
    const constraintsButton = styles.getByRole("button", {
      name: /Size constraints|최소·최대 크기/,
    });
    if ((await styles.locator("fieldset.min-width").count()) === 0) {
      await constraintsButton.click();
      await page.waitForTimeout(400);
    }
    const minWidth = styles.locator("fieldset.min-width input");
    const maxWidth = styles.locator("fieldset.max-width input");
    const readNode = () =>
      page.evaluate((id) => {
        const node = window.__composition_STORE__
          .getState()
          .elements.find((e) => e.id === id);
        return { style: node?.props?.style, sizing: node?.sizing };
      }, a);
    await minWidth.fill("200");
    await minWidth.press("Enter");
    await page.waitForTimeout(600);
    const afterMin = await readNode();
    const historyAfterMin = await historyCount(page);
    await maxWidth.fill("100");
    await maxWidth.press("Enter");
    await page.waitForTimeout(600);
    const afterInvalid = await readNode();
    const historyAfterInvalid = await historyCount(page);
    const invalidAlertLocator = styles.locator(".transform-constraint-error");
    const invalidAlertCount = await invalidAlertLocator.count();
    const invalidAlert = invalidAlertCount
      ? await invalidAlertLocator.innerText()
      : "";
    await maxWidth.fill("300");
    await maxWidth.press("Enter");
    await page.waitForTimeout(600);
    const afterValid = await readNode();
    const historyAfterValid = await historyCount(page);
    const validAlertCount = await styles
      .locator(".transform-constraint-error")
      .count();
    constraints = {
      afterMin,
      afterInvalid,
      afterValid,
      invalidAlert,
      invalidAlertCount,
      validAlertCount,
      history: [historyAfterMin, historyAfterInvalid, historyAfterValid],
    };
    checks.push({
      name: "Min/Max 동일 단위 역전 차단 · 오류 표시 · 유효값 재커밋",
      pass:
        afterMin.style?.minWidth === "200px" &&
        afterInvalid.style?.maxWidth === undefined &&
        historyAfterInvalid === historyAfterMin &&
        invalidAlertCount === 1 &&
        invalidAlert.length > 0 &&
        afterValid.style?.maxWidth === "300px" &&
        historyAdvancedOnce(historyAfterMin, historyAfterValid) &&
        validAlertCount === 0,
      detail: constraints,
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
      checks.push({ name, pass: !error && historyAdvancedOnce(before, after) && parity && verify(node, canvas[0]), detail });
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
    await installEngineProbe();
    await ensureComparePreview(a);
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
      pass: !on.error && historyAdvancedOnce(before.history, on.history) &&
        on.node.style.position === "absolute" &&
        Math.abs(parseFloat(on.node.style.width) - before.canvas.width) <= 0.01 &&
        on.node.sizing?.width === null && typeof on.node.style.left === "string" &&
        Math.abs(on.canvas.width - before.canvas.width) <= 0.01 && parity(on),
      detail: { before, on } });
    await toggle.click();
    const off = await measure("Absolute off (Flow)");
    checks.push({ name: "Flow 복귀: Fixed 유지 · Fill 자동 복원 0",
      pass: !off.error && historyAdvancedOnce(on.history, off.history) &&
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
      pass: historyAdvancedOnce(before.history, after1.history) &&
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
      pass: historyAdvancedOnce(locked.history, after2.history) &&
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
        pass: historyAdvancedOnce(absOn.history, afterL.history) &&
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
        pass: historyAdvancedOnce(afterL.history, afterTL.history) &&
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
      pass: !locked.error && historyAdvancedOnce(before.history, locked.history) &&
        ratioOf(locked.nodes[0]) === `${Math.round(before.canvas[0].width * 100) / 100} / 240` &&
        ratioOf(locked.nodes[1]) === `${Math.round(before.canvas[1].width * 100) / 100} / 240` &&
        locked.nodes.every((n) => n.style.height === "auto" && n.sizing?.height === null) &&
        locked.nodes[0].sizing?.width?.factor === 2 && locked.nodes[1].sizing?.width?.factor === 1 &&
        parity(locked),
      detail: { before, locked } });
    await page.keyboard.press("Meta+z");
    const unlocked = await measure("multi Ratio Undo 1회");
    checks.push({ name: "multi Ratio Undo 1회: 둘 다 복원",
      pass: unlocked.history === historyIndexAfterUndo(before.history, locked.history) &&
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
      pass: !abs.error && historyAdvancedOnce(before.history, abs.history) &&
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
      pass: absUndone.history === historyIndexAfterUndo(before.history, abs.history) &&
        absUndone.nodes[0].sizing?.width?.factor === 2 && absUndone.nodes[1].sizing?.width?.factor === 1 &&
        absUndone.nodes.every((n) => n.style.position === undefined && n.style.width === undefined) &&
        parity(absUndone),
      detail: absUndone });
  }
  // ── ADR-224 G2 왕복 gate — 복제 (⌘C/⌘V) · tier null · breakpoint 전환 · refresh · 무편집 저장 0 (`--roundtrip`) ──
  // a = base Fill 2 + tablet {width:null} + tablet width 320px (mobile 미지정) · b = Fill 1 (Row 900×240).
  const roundtrip = [];
  if (process.argv.includes("--roundtrip")) {
    await page.evaluate(({ parent, ids }) => {
      const st = window.__composition_STORE__.getState();
      const p = st.elements.find((e) => e.id === parent);
      st.updateElementProps(parent, { style: { ...p.props.style, flexDirection: "row" } });
      ids.forEach((id, i) => {
        const e = st.elements.find((n) => n.id === id);
        st.updateElement(id, {
          sizing: { width: { factor: 2 - i } },
          responsive: i === 0
            ? { sizing: { tablet: { width: null } }, styles: { width: { tablet: "320px" } } }
            : undefined,
          props: { ...e.props, style: {} } });
      });
    }, { parent, ids: [a, b] });
    await page.waitForTimeout(1000);
    const readNode = (id) => page.evaluate((elementId) => {
      const e = window.__composition_STORE__.getState().elements.find((n) => n.id === elementId);
      return e ? { style: e.props?.style, sizing: e.sizing, responsive: e.responsive, parent: e.parent_id } : null;
    }, id);
    const siblings = () => page.evaluate((parentId) =>
      window.__composition_STORE__.getState().elements.filter((e) => e.parent_id === parentId).map((e) => e.id), parent);
    const seeded = { a: await readNode(a), b: await readNode(b), siblings: await siblings(), history: await historyCount(page) };
    roundtrip.push({ name: "seeded", ...seeded });
    // 1) ⌘C/⌘V 복제 — sizing · responsive 가 새 요소에 그대로
    // 실제 클릭으로 선택 (키보드 단축키 scope = canvas 포커스)
    await page.evaluate((id) => {
      const st = window.__composition_STORE__.getState();
      st.setSelectedElements([id]);
      st.setSelectedElement(id);
    }, a);
    await page.waitForTimeout(400);
    const aPoint = await page.evaluate((id) => {
      const r = window.__composition_RESIZE_DEBUG__.getSceneBounds(id);
      const vp = window.__composition_VIEWPORT__();
      const rect = document.querySelector("canvas").getBoundingClientRect();
      window.__composition_APPLY_VIEWPORT__({ scale: vp.zoom,
        x: rect.width * 0.3 - (r.x + r.width / 2) * vp.zoom, y: rect.height * 0.45 - (r.y + r.height / 2) * vp.zoom });
      return null;
    }, a);
    await page.waitForTimeout(600);
    const aCenter = await page.evaluate((id) => {
      const r = window.__composition_RESIZE_DEBUG__.getSceneBounds(id);
      const vp = window.__composition_VIEWPORT__();
      const rect = document.querySelector("canvas").getBoundingClientRect();
      return { x: (r.x + r.width / 2) * vp.zoom + vp.panOffset.x + rect.left, y: (r.y + r.height / 2) * vp.zoom + vp.panOffset.y + rect.top };
    }, a);
    void aPoint;
    await page.mouse.click(aCenter.x, aCenter.y);
    await page.waitForTimeout(500);
    await page.keyboard.press("Meta+c");
    await page.waitForTimeout(600);
    await page.keyboard.press("Meta+v");
    await page.waitForTimeout(1500);
    const afterPaste = await siblings();
    const c = afterPaste.find((id) => !seeded.siblings.includes(id));
    const cNode = c ? await readNode(c) : null;
    const pasteHistory = await historyCount(page);
    roundtrip.push({ name: "paste", c, cNode, siblings: afterPaste, history: pasteHistory });
    checks.push({ name: "G2 복제 (⌘C/⌘V): sizing factor · tier null · tier width 가 새 요소에 보존 · history +1",
      pass: !!c && JSON.stringify(cNode?.sizing) === JSON.stringify(seeded.a.sizing) &&
        JSON.stringify(cNode?.responsive) === JSON.stringify(seeded.a.responsive) &&
        cNode?.parent === parent &&
        afterPaste.length === seeded.siblings.length + 1 &&
        historyAdvancedOnce(seeded.history, pasteHistory),
      detail: { seeded, c, cNode, afterPaste } });
    // 2) breakpoint 전환 — tablet: a 는 null 해제 + 320px, c 도 같다, b 는 Fill 1 로 남은 폭
    // 헤더 토글 (BuilderCore.handleBreakpointChange) 과 같은 경로 — setActiveBreakpoint + invalidateLayout
    const switchBreakpoint = (bp) => page.evaluate((next) => {
      const st = window.__composition_STORE__.getState();
      st.setActiveBreakpoint(next);
      st.invalidateLayout();
    }, bp);
    await switchBreakpoint("tablet");
    await page.waitForTimeout(1500);
    const tabletCanvas = { a: await readLayout(page, a), b: await readLayout(page, b), c: c ? await readLayout(page, c) : null };
    const tabletHistory = await historyCount(page);
    const tabletDoc = await page.evaluate(() => window.__composition_STORE__.getState().layoutVersion);
    roundtrip.push({ name: "tablet", canvas: tabletCanvas, history: tabletHistory });
    checks.push({ name: "G2 tablet 전환: a·c 는 null 해제 + 320px, b 는 Fill · 전환 저장 0",
      pass: Math.abs(tabletCanvas.a.width - 320) <= 0.01 && (!c || Math.abs(tabletCanvas.c.width - 320) <= 0.01) &&
        tabletCanvas.b.width > 100 && tabletHistory === pasteHistory,
      detail: { tabletCanvas, tabletHistory, tabletDoc } });
    // 3) mobile (미지정) — tablet 을 상속 (cascade)
    await switchBreakpoint("mobile");
    await page.waitForTimeout(1500);
    const mobileA = await readLayout(page, a);
    checks.push({ name: "G2 mobile 미지정: tablet null + 320px 상속",
      pass: Math.abs(mobileA.width - 320) <= 0.01 && (await historyCount(page)) === pasteHistory,
      detail: mobileA });
    await switchBreakpoint("desktop");
    await page.waitForTimeout(1200);
    // 4) refresh — DB 왕복 (factor · tier null · tier width · 복제본)
    const beforeReload = { a: await readNode(a), c: c ? await readNode(c) : null };
    await page.waitForTimeout(1500);
    await page.reload();
    await waitReady(page);
    await page.bringToFront();
    await page.waitForTimeout(1000);
    const afterReload = { a: await readNode(a), c: c ? await readNode(c) : null, siblings: await siblings() };
    roundtrip.push({ name: "reload", beforeReload, afterReload });
    checks.push({ name: "G2 refresh: factor · tier null · tier width · 복제본 보존",
      pass: JSON.stringify(afterReload.a?.sizing) === JSON.stringify(beforeReload.a?.sizing) &&
        JSON.stringify(afterReload.a?.responsive) === JSON.stringify(beforeReload.a?.responsive) &&
        (!c || JSON.stringify(afterReload.c?.sizing) === JSON.stringify(beforeReload.c?.sizing)) &&
        afterReload.siblings.length === afterPaste.length,
      detail: { beforeReload, afterReload } });
    // 5) 무편집 저장 0 — 선택·해제·breakpoint 왕복에 문서 버전·history 무변경
    const docBefore = await page.evaluate(() => window.__composition_STORE__.getState().layoutVersion);
    const histBefore = await historyCount(page);
    await page.evaluate((id) => window.__composition_STORE__.getState().setSelectedElement(id), a);
    await page.waitForTimeout(500);
    await switchBreakpoint("tablet");
    await page.waitForTimeout(800);
    await switchBreakpoint("desktop");
    await page.waitForTimeout(800);
    await page.evaluate(() => window.__composition_STORE__.getState().setSelectedElements([]));
    await page.waitForTimeout(500);
    const histAfter = await historyCount(page);
    const nodeAfter = await readNode(a);
    checks.push({ name: "G2 무편집 저장 0: 선택·breakpoint 왕복 뒤 history·노드 무변경",
      pass: histAfter === histBefore && JSON.stringify(nodeAfter) === JSON.stringify(afterReload.a),
      detail: { histBefore, histAfter, docBefore, nodeAfter } });
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
    wrapMin,
    constraints,
    ratioUi,
    absolute,
    resize,
    multi,
    roundtrip,
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
