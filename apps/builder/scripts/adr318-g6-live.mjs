#!/usr/bin/env node
// ADR-318 G6 live — Resizable 편집 (Phase 6): Builder 에서
//   1. Design 패널 Group 의 Panels 칸에서 ResizablePanel 고르기 → Handle + Panel 한 번에 (Panel · Handle · Panel · Handle · Panel) · ⌘Z → 셋
//   2. 마지막 Panel 을 고르고 Backspace → 그 Handle 도 같이 사라짐 (Panel 하나) · ⌘Z → 셋
//   3. Handle 만 고르고 Backspace → 지워지지 않음 (짝 유지)
//   4. 첫 Panel 의 오른쪽 손잡이 (padding 0 손잡이와 같은 자리 — 크기 손잡이가 이김) 를 끌어 Group 의 25 % 로 → Default size 25 · Canvas · Publish 모두 자기 Group 의 25 % (±1)
//   5. Handle 을 고르면 크기 손잡이 없음 · Design 패널 라벨 (Collapsible · Remember sizes — 크기 셋은 Property 탭에 없다) · page error 0
//   6. (후속 2026-11-26 「Layout 탭 size 와 동기화」) Layout 탭: Panel 의 Width = Default size (%) · Height 꺼짐 ·
//      Width 40 → Default size 40 (box style 없음) · Canvas 40 % · Min W 120px → Min size 「120px」 · ⌘Z
//   7. (후속 2026-11-26 「orientation 에 따라 layers 트리 icon 이 columns, rows」) Navigator Layers 의 Group 줄
//      아이콘: 가로 = columns-2 → orientation vertical → rows-2 (다시 그리기 없이) → ⌘Z → columns-2 ·
//      Panel · Handle 줄 glyph (가로 = panel-column · line-vertical → 세로 = panel-row · line) ·
//      Separator 줄 (separator-horizontal → orientation vertical → separator-vertical)
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr318-g6-live.mjs <out-dir>
//   BROWSER=webkit 이면 Playwright WebKit 으로
import { mkdirSync, readFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr318-g6-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const MOD = process.platform === "darwin" ? "Meta" : "Control";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 900)}\n`,
  );
};

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser =
  process.env.BROWSER === "webkit"
    ? await webkit.launch({ headless: false })
    : await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

const openRail = async (id) => {
  const button = railButton(page, id);
  if ((await button.getAttribute("aria-pressed")) !== "true") {
    await button.click();
    await page.waitForTimeout(900);
  }
};
const placeGroup = async (keepSelection) => {
  await openRail("components");
  if (!keepSelection)
    await page.evaluate(() =>
      window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
    );
  const item = page
    .locator("button, [role='button'], [role='option'], [role='gridcell']")
    .filter({ hasText: /^resizable panels$/i })
    .first();
  await item.waitFor({ state: "visible", timeout: 15000 });
  await item.click();
  await page.waitForTimeout(1500);
};
/** The Groups' records in document order: id · node · children (record ids + types). */
const groups = () =>
  page.evaluate(() => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    return [...r.canvasInputs.values()]
      .filter((x) => r.typeOf(x) === "ResizablePanelGroup")
      .map((g) => ({
        id: g.id,
        node: g.sourceId,
        parent: g.parentId,
        kids: g.children.map((id) => ({
          id,
          node: r.canvasInputs.get(id)?.sourceId,
          type: r.typeOf(r.canvasInputs.get(id)),
        })),
      }));
  });
const write = (recordId, props) =>
  page.evaluate(
    ({ recordId, props }) => {
      const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
      ws.execute(
        c.setFields({
          targets: [ws.itemOfRecord(recordId).target],
          props: Object.fromEntries(
            Object.entries(props).map(([k, v]) => [
              k,
              v === null ? { kind: "remove" } : { kind: "set", value: v },
            ]),
          ),
        }),
      );
    },
    { recordId, props },
  );
const openPublish = async (ids) => {
  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) =>
        ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
      )
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForFunction(
    (ids) =>
      ids.every((id) =>
        document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`),
      ),
    ids,
    { timeout: 60000 },
  );
  // (the interaction chunk — the separator role appears when it has loaded)
  await pub.waitForSelector('[role="separator"]', { timeout: 30000 });
  await pub.waitForTimeout(500);
  return pub;
};
const sep = (pub, id) => pub.locator(`[data-catalog-id="${id}"]`);
const attrs = (pub, id) =>
  sep(pub, id).evaluate((el) =>
    Object.fromEntries(
      [
        "role",
        "aria-orientation",
        "aria-valuenow",
        "aria-valuemin",
        "aria-valuemax",
        "aria-controls",
        "aria-label",
        "aria-disabled",
        "tabindex",
        "data-resizing",
      ].map((n) => [n, el.getAttribute(n)]),
    ),
  );
const width = (pub, id, axis = "w") =>
  pub
    .locator(`[data-catalog-id="${id}"]`)
    .evaluate(
      (el, axis) =>
        el.getBoundingClientRect()[axis === "w" ? "width" : "height"],
      axis,
    );
const center = async (pub, id) => {
  const b = await pub.locator(`[data-catalog-id="${id}"]`).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

const exec = (source, arg) =>
  page.evaluate(
    ({ source, arg }) =>
      new Function("cat", "arg", `return (${source})(cat, arg);`)(
        window.__COMPOSITION_CATALOG__,
        arg,
      ),
    { source, arg },
  );
const shape = (groupId) =>
  exec(
    `(cat, id) => {
      const r = cat.workspace.root;
      const g = r.canvasInputs.get(id);
      return g.children.map((c) => ({ ResizablePanel: "P", ResizableHandle: "H" })[r.typeOf(r.canvasInputs.get(c))] ?? "?").join("");
    }`,
    groupId,
  );
const kids = (groupId) =>
  exec(
    `(cat, id) => cat.workspace.root.canvasInputs.get(id).children`,
    groupId,
  );
const selectRecord = async (id) => {
  await exec(`(cat, id) => cat.workspace.selectRecords([id])`, id);
  await page.waitForTimeout(500);
};
const pointOf = (id, fx = 0.5, fy = 0.5) =>
  exec(
    `(cat, a) => {
      const box = cat.canvas.boundsOf(a.id);
      const camera = cat.canvas.camera();
      const rect = document.querySelector('[data-catalog-canvas="true"]').getBoundingClientRect();
      return { x: rect.left + camera.x + (box.x + box.width * a.fx) * camera.zoom,
               y: rect.top + camera.y + (box.y + box.height * a.fy) * camera.zoom };
    }`,
    { id, fx, fy },
  );
const canvasWidth = (id) =>
  exec(`(cat, id) => cat.workspace.root.getGeometry([id]).get(id)?.width`, id);
const backspace = async () => {
  await exec(
    `() => document.querySelector('[data-catalog-canvas="true"]')?.focus()`,
  );
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(700);
};
const undo = async () => {
  await exec(
    `() => document.querySelector('[data-catalog-canvas="true"]')?.focus()`,
  );
  await page.keyboard.press(`${MOD}+z`);
  await page.waitForTimeout(700);
};

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("adr318 g6 live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);
  await placeGroup(false);
  const [g] = await groups();
  await openRail("properties");

  // 1. The Group's 「+」.
  await selectRecord(g.id);
  // (The Group's slot 「Panels」 — its insert list offers the Group's item, ResizablePanel.)
  const design = page.locator('.panel-wrapper[data-panel="properties"]');
  const trigger = design
    .locator("fieldset, .fieldset-row")
    .filter({ hasText: /^Panels/ })
    .locator("button")
    .first();
  await trigger.waitFor({ state: "visible", timeout: 15000 });
  await trigger.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/1-picker.png` });
  await page
    .getByRole("option", { name: /^ResizablePanel$/ })
    .first()
    .click();
  await page.waitForTimeout(800);
  const added = await shape(g.id);
  await undo();
  const undone = await shape(g.id);
  record(
    "1 Group Panels 칸 → ResizablePanel → PHPHP (Handle 같이) · ⌘Z → PHP",
    added === "PHPHP" && undone === "PHP",
    { added, undone },
  );

  // 2. Delete the last Panel: its Handle goes too.
  let [p1, h, p2] = await kids(g.id);
  await selectRecord(p2);
  await backspace();
  const deleted = await shape(g.id);
  await undo();
  const restored = await shape(g.id);
  record(
    "2 마지막 Panel Backspace → P (Handle 같이 삭제) · ⌘Z → PHP",
    deleted === "P" && restored === "PHP",
    { deleted, restored },
  );

  // 3. A Handle alone stays.
  [p1, h, p2] = await kids(g.id);
  await selectRecord(h);
  await backspace();
  const handleAlone = await shape(g.id);
  record("3 Handle 만 Backspace → 지워지지 않음 (PHP)", handleAlone === "PHP", {
    handleAlone,
  });

  // 4. The first Panel's size handle writes its Default size.
  await selectRecord(p1);
  const groupBox = await exec(`(cat, id) => cat.canvas.boundsOf(id)`, g.id);
  const space = groupBox.width - 1;
  const zoom = await exec(`(cat) => cat.canvas.camera().zoom`);
  // (on the edge — the Panel's size handle takes the press over its padding handle there)
  const edge = await pointOf(p1, 1, 0.5);
  const target = edge.x - space * 0.25 * zoom;
  await page.mouse.move(edge.x, edge.y);
  await page.mouse.down();
  for (let s = 1; s <= 10; s++)
    await page.mouse.move(edge.x + ((target - edge.x) * s) / 10, edge.y);
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.waitForTimeout(800);
  const written = await exec(
    `(cat, id) => cat.workspace.runtime.graph.getEntry(cat.workspace.root.canvasInputs.get(id).sourceId)?.props?.defaultSize`,
    p1,
  );
  const canvasP1 = await canvasWidth(p1);
  const pub = await openPublish([g.id, p1, h, p2]);
  const publishP1 = await width(pub, p1);
  const publishSpace = (await width(pub, g.id)) - 1;
  await pub.close();
  record(
    "4 첫 Panel 오른쪽 손잡이 → Default size ≈ 25 · Canvas · Publish 모두 자기 Group 의 25 % (padding 손잡이보다 크기 손잡이)",
    written?.kind === "set" &&
      Math.abs(written.value - 25) <= 1 &&
      Math.abs(canvasP1 - space * (written.value / 100)) <= 1 &&
      Math.abs(publishP1 - publishSpace * (written.value / 100)) <= 1,
    { written, canvasP1, space, publishP1, publishSpace },
  );
  await page.screenshot({ path: `${OUT}/4-resized.png` });

  // 5. Handles drawn: a Panel two (its main axis), a Handle none; labels.
  const handles = await exec(`(cat) => {
    const g = window.__COMPOSITION_CATALOG__;
    const positions = ["top-left","top-center","top-right","middle-right","bottom-right","bottom-center","bottom-left","middle-left"];
    return positions.filter((p) => g.canvas.handleAccepted?.(p));
  }`);
  await selectRecord(h);
  const handleHandles = await exec(`(cat) => {
    const positions = ["top-left","top-center","top-right","middle-right","bottom-right","bottom-center","bottom-left","middle-left"];
    return positions.filter((p) => cat.canvas.handleAccepted?.(p));
  }`);
  await selectRecord(p1);
  const panelHandles = await exec(`(cat) => {
    const positions = ["top-left","top-center","top-right","middle-right","bottom-right","bottom-center","bottom-left","middle-left"];
    return positions.filter((p) => cat.canvas.handleAccepted?.(p));
  }`);
  const panelText = await page
    .locator('.panel-wrapper[data-panel="properties"]')
    .innerText();
  await selectRecord(g.id);
  const groupText = await page
    .locator('.panel-wrapper[data-panel="properties"]')
    .innerText();
  record(
    "5 Panel 손잡이 = 좌우 둘 · Handle 손잡이 0 · Design 패널 라벨 · page error 0",
    JSON.stringify(panelHandles) ===
      JSON.stringify(["middle-right", "middle-left"]) &&
      handleHandles.length === 0 &&
      !/Default size|Min size|Max size/.test(panelText) &&
      /Collapsible/.test(panelText) &&
      /Remember sizes/.test(groupText) &&
      errors.length === 0,
    {
      handles,
      panelHandles,
      handleHandles,
      labels: {
        sizesInPropertyTab: /Default size|Min size|Max size/.test(panelText),
        collapsible: /Collapsible/.test(panelText),
        rememberSizes: /Remember sizes/.test(groupText),
      },
      errors: errors.slice(0, 5),
    },
  );

  // 6. The Layout tab's size fields are the Panel's share props.
  await selectRecord(p1);
  await page
    .locator('.panel-wrapper[data-panel="properties"]')
    .getByRole("tab", { name: /^(Layout|레이아웃)$/ })
    .first()
    .click();
  await page.waitForTimeout(600);
  const styles = page.locator('.panel-wrapper[data-panel="properties"]');
  const widthField = styles.locator("fieldset.width").first();
  const heightField = styles.locator("fieldset.height").first();
  const widthShown = await widthField.locator("input").inputValue();
  const widthUnit = (await widthField.innerText()).replace(/\s+/g, " ");
  const heightOff = await heightField
    .locator("input")
    .evaluate((el) => el.disabled || el.closest("[data-disabled]") !== null);
  await widthField.locator("input").fill("40");
  await widthField.locator("input").press("Enter");
  await page.waitForTimeout(800);
  const entry = () =>
    exec(
      `(cat, id) => { const e = cat.workspace.runtime.graph.getEntry(cat.workspace.root.canvasInputs.get(id).sourceId); return { props: e?.props, visual: e?.visual }; }`,
      p1,
    );
  const after40 = await entry();
  const canvas40 = await canvasWidth(p1);
  const constraints = styles.getByRole("button", {
    name: /Size constraints|최소·최대 크기|크기 제약/,
  });
  if ((await styles.locator("fieldset.min-width").count()) === 0) {
    await constraints.first().click();
    await page.waitForTimeout(400);
  }
  const minField = styles.locator("fieldset.min-width").first();
  await minField.locator("input").fill("120px");
  await minField.locator("input").press("Enter");
  await page.waitForTimeout(800);
  const afterMin = await entry();
  const maxOff = await styles
    .locator("fieldset.max-height input")
    .first()
    .evaluate((el) => el.disabled || el.closest("[data-disabled]") !== null);
  await page.screenshot({ path: `${OUT}/6-layout-tab.png` });
  await undo();
  const afterUndo = await entry();
  record(
    "6 Layout 탭 Width = Default size % · Height 꺼짐 · 40 → Default size 40 (box style 없음) · Canvas 40 % · Min W 120px → Min size · Max H 꺼짐 · ⌘Z",
    /^2[45](\.\d)?$/.test(widthShown) &&
      /%/.test(widthUnit) &&
      heightOff &&
      after40.props?.defaultSize?.value === 40 &&
      after40.visual?.width === undefined &&
      Math.abs(canvas40 - space * 0.4) <= 1 &&
      afterMin.props?.minSize?.value === "120px" &&
      afterMin.visual?.minWidth === undefined &&
      maxOff &&
      afterUndo.props?.minSize === undefined &&
      afterUndo.props?.defaultSize?.value === 40 &&
      errors.length === 0,
    {
      widthShown,
      widthUnit,
      heightOff,
      defaultSize: after40.props?.defaultSize,
      visualWidth: after40.visual?.width,
      canvas40,
      expected: space * 0.4,
      minSize: afterMin.props?.minSize,
      maxOff,
      undoMin: afterUndo.props?.minSize,
      errors: errors.slice(0, 5),
    },
  );

  // 7. The Layers row of the Group shows its orientation.
  await openRail("navigator");
  await selectRecord(g.id);
  const groupIcon = () =>
    page.evaluate(() => {
      // (The Layers rows' icons — the Group's is the one row of that type, a columns · rows glyph.)
      const icons = [
        ...document.querySelectorAll('svg[data-layer-icon="component"]'),
      ].map((svg) => String(svg.getAttribute("class") ?? ""));
      return icons.find((c) => /columns-2|rows-2/.test(c)) ?? icons.join(" | ");
    });
  const glyphs = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("svg[data-layer-icon]")]
        .map((svg) => svg.getAttribute("data-layer-icon"))
        .filter((g) => /^(panel-|line)/.test(g)),
    );
  const separatorIcon = () =>
    page.evaluate(
      () =>
        [...document.querySelectorAll('svg[data-layer-icon="component"]')]
          .map((svg) => String(svg.getAttribute("class") ?? ""))
          .find((c) => /separator-/.test(c)) ?? null,
    );
  const iconHorizontal = await groupIcon();
  const partsHorizontal = await glyphs();
  await write(g.id, { orientation: "vertical" });
  await page.waitForTimeout(600);
  const iconVertical = await groupIcon();
  const partsVertical = await glyphs();
  await page.screenshot({ path: `${OUT}/7-layers-icon.png` });
  await undo();
  await selectRecord(g.id);
  const iconUndone = await groupIcon();
  // A Separator on the page: its own orientation.
  await openRail("components");
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
  );
  const separatorCard = page
    .locator("button, [role='button'], [role='option'], [role='gridcell']")
    .filter({ hasText: /^separator$/i })
    .first();
  await separatorCard.scrollIntoViewIfNeeded();
  await separatorCard.click();
  await page.waitForTimeout(800);
  // (WebKit: a card scrolled into view may take the click as focus only — Enter places it.)
  const placed = await exec(`(cat) => {
    const r = cat.workspace.root;
    return [...r.canvasInputs.values()].some((x) => r.typeOf(x) === "Separator");
  }`);
  if (!placed) await separatorCard.press("Enter");
  await page.waitForFunction(
    () => {
      const r = window.__COMPOSITION_CATALOG__.workspace.root;
      return [...r.canvasInputs.values()].some(
        (x) => r.typeOf(x) === "Separator",
      );
    },
    null,
    { timeout: 15000 },
  );
  await page.waitForTimeout(600);
  await openRail("navigator");
  const separator = await exec(`(cat) => {
    const r = cat.workspace.root;
    return [...r.canvasInputs.values()].find((x) => r.typeOf(x) === "Separator")?.id;
  }`);
  const sepHorizontal = await separatorIcon();
  await write(separator, { orientation: "vertical" });
  await page.waitForTimeout(600);
  const sepVertical = await separatorIcon();
  record(
    "7 Layers 아이콘 방향 — Group columns-2 ↔ rows-2 · Panel panel-column ↔ panel-row · Handle 세로선 ↔ 가로선 · Separator horizontal ↔ vertical · ⌘Z",
    /columns-2/.test(iconHorizontal ?? "") &&
      /rows-2/.test(iconVertical ?? "") &&
      /columns-2/.test(iconUndone ?? "") &&
      JSON.stringify(partsHorizontal) ===
        JSON.stringify(["panel-column", "line-vertical", "panel-column"]) &&
      JSON.stringify(partsVertical) ===
        JSON.stringify(["panel-row", "line", "panel-row"]) &&
      /separator-horizontal/.test(sepHorizontal ?? "") &&
      /separator-vertical/.test(sepVertical ?? "") &&
      errors.length === 0,
    {
      iconHorizontal,
      iconVertical,
      iconUndone,
      partsHorizontal,
      partsVertical,
      sepHorizontal,
      sepVertical,
      errors: errors.slice(0, 5),
    },
  );
} catch (error) {
  await page.screenshot({ path: `${OUT}/error.png` }).catch(() => {});
  record("실행 오류", false, String(error).split("\n").slice(0, 3));
} finally {
  await browser.close();
  const failed = results.filter((r) => !r.pass);
  process.stdout.write(
    `\n${failed.length ? `FAIL ${failed.length}` : "ALL PASS"} (${results.length})\n`,
  );
}
