#!/usr/bin/env node
// adr258-color-controls-live.mjs — ADR-258 G3 (headed Chrome, the real Builder in Compare Mode).
//   The Color controls as an author meets them: the palette (Forms, after ColorField — 사용자 결정 3)
//   and the Components page origins · a ColorSlider without props · Design panel edits without a
//   reload, undo · redo and a reload · a Preview drag (no document step) · a non-default prop edit
//   during and after a drag keeps the dragged value · a default value edit (and its undo · redo)
//   starts RAC's state again · an achromatic hue edit · hsl/hue → Red in one pick and one undo · a
//   CSS name refused · the ColorSlider's label text · a theme switch · page errors 0.
// Use: node apps/builder/scripts/adr258-color-controls-live.mjs <outDir>  (dev 5173 · .auth-session.json)
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const H = resolve("apps/builder/scripts/adr256-g5/harness.mjs");
const { launch, newProject, compareOn, reopen } = await import(H);
const OUT = process.argv[2] ?? "/private/tmp/adr258-live";
mkdirSync(OUT, { recursive: true });
const COMMANDS = `/@fs${process.cwd()}/packages/shared/src/catalog/commands/index.ts`;
const LAYOUTS = `/@fs${process.cwd()}/apps/builder/src/builder/catalogRuntime/layouts.ts`;
const THEMES = `/@fs${process.cwd()}/apps/builder/src/builder/panels/themes/catalog/catalogThemesHost.ts`;

const { browser, page, errors } = await launch();
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  console.log(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 700)}`,
  );
};
await newProject(page, `adr258-g3-${Date.now()}`);

// RAC writes the channel's name in the Preview's locale (en-US 「Hue」 · ko-KR 「색조」).
const HUE = ["Hue", "색조"];
const preview = () =>
  page.frames().find((f) => f.url().includes("preview.html"));
const revision = () =>
  page.evaluate(
    () => window.__COMPOSITION_CATALOG__.workspace.runtime.graph.revision,
  );
const wait = (ms) => page.waitForTimeout(ms);

// ── L-1 palette: Forms shows color field · area · slider · wheel in that order ────────────────
const componentsButton = () =>
  page.getByRole("button", { name: "Components", exact: true }).first();
const search = page.getByLabel("Search components");
if (!(await search.isVisible().catch(() => false)))
  await componentsButton().click();
await wait(500);
await search.fill("color");
await wait(400);
const colorItems = await page
  .locator(".list-item .list-item-name")
  .allTextContents();
record(
  "L-1 palette (Forms): color field → color area → color slider → color wheel",
  JSON.stringify(
    colorItems
      .map((t) => t.trim().toLowerCase())
      .filter((t) => /^color (field|area|slider|wheel)$/.test(t)),
  ) ===
    JSON.stringify([
      "color field",
      "color area",
      "color slider",
      "color wheel",
    ]),
  colorItems,
);

// ── L-2 add each from the palette: the origin instance with its part nodes ────────────────────
async function addFromPalette(label) {
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectRecords([]),
  );
  if (!(await search.isVisible().catch(() => false)))
    await componentsButton().click();
  await search.fill(label);
  await wait(300);
  await page
    .locator(".list-item", { hasText: new RegExp(`^${label}$`, "i") })
    .first()
    .click();
  await wait(900);
  return page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const body = [...ws.root.canvasInputs.values()].find((r) =>
      r.sourceId.endsWith("home-body"),
    );
    const last = ws.runtime.graph.getEntry(body.sourceId).children.at(-1);
    return last;
  });
}
const sliderId = await addFromPalette("color slider");
const areaId = await addFromPalette("color area");
const wheelId = await addFromPalette("color wheel");
await page.keyboard.press("Escape");
await componentsButton()
  .click()
  .catch(() => {});
await wait(500);
const tree = await page.evaluate(
  (ids) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    return ids.map((id) => {
      const entry = ws.runtime.graph.getEntry(id);
      const rec = [...root.canvasInputs.values()].find(
        (r) => r.sourceId === id,
      );
      const walk = (r) => [
        root.typeOf(r),
        ...r.children.map((k) => walk(root.canvasInputs.get(k))),
      ];
      return { definitionId: entry.definitionId, tree: walk(rec) };
    });
  },
  [sliderId, areaId, wheelId],
);
record(
  "L-2 palette adds the origin trees (ColorSlider > Label + SliderOutput + SliderTrack > ColorThumb · ColorArea > ColorThumb · ColorWheel > ColorWheelTrack + ColorThumb)",
  JSON.stringify(tree.map((t) => t.tree)) ===
    JSON.stringify([
      [
        "ColorSlider",
        ["Label"],
        ["SliderOutput"],
        ["SliderTrack", ["ColorThumb"]],
      ],
      ["ColorArea", ["ColorThumb"]],
      ["ColorWheel", ["ColorWheelTrack"], ["ColorThumb"]],
    ]) &&
    tree.every((t) =>
      /origin-component-color(slider|area|wheel)$/.test(t.definitionId),
    ),
  tree,
);
const builtins = await page.evaluate(async (LAYOUTS) => {
  const { catalogBuiltinOrigins } = await import(LAYOUTS);
  return catalogBuiltinOrigins(
    window.__COMPOSITION_CATALOG__.workspace.runtime.graph.library,
  ).map((o) => o.name);
}, LAYOUTS);
const at = (n) => builtins.indexOf(n);
record(
  "L-3 Components page origins: ColorArea · ColorSlider · ColorWheel after ColorField",
  at("ColorField") >= 0 &&
    at("ColorArea") === at("ColorField") + 1 &&
    at("ColorSlider") === at("ColorArea") + 1 &&
    at("ColorWheel") === at("ColorSlider") + 1,
  builtins.slice(Math.max(0, at("ColorField") - 1), at("ColorField") + 5),
);

// Put the slider clear of the Compare Mode header (both legs) — a layout edit, then read the Preview.
await page.evaluate(
  async ({ COMMANDS, sliderId }) => {
    const c = await import(COMMANDS);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.execute(
      c.setFields({
        targets: [{ kind: "node", id: sliderId }],
        layout: {
          marginTop: { kind: "set", value: "140px" },
          marginLeft: { kind: "set", value: "60px" },
        },
      }),
    );
    ws.selectRecords([]);
  },
  { COMMANDS, sliderId },
);
await wait(1200);
const sliderRid = await page.evaluate(
  (id) =>
    [
      ...window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.values(),
    ].find((r) => r.sourceId === id).id,
  sliderId,
);
/** The Preview ColorSlider: label · output text, thumb color · center (page coordinates). */
async function sliderDom() {
  const frame = preview();
  const inner = await frame.evaluate((rid) => {
    const el = document.querySelector(`[data-catalog-id="${CSS.escape(rid)}"]`);
    if (!el) return null;
    const thumb = el.querySelector(".react-aria-ColorThumb");
    const track = el.querySelector(".react-aria-SliderTrack");
    const t = thumb.getBoundingClientRect();
    const k = track.getBoundingClientRect();
    return {
      label: el.querySelector(".react-aria-Label")?.textContent ?? null,
      output: el.querySelector(".react-aria-SliderOutput")?.textContent ?? null,
      thumbColor: getComputedStyle(thumb).backgroundColor,
      thumbBorder: getComputedStyle(thumb).borderTopColor,
      thumb: { x: t.x + t.width / 2, y: t.y + t.height / 2 },
      track: { x: k.x, y: k.y, width: k.width, height: k.height },
      innerWidth: window.innerWidth,
    };
  }, sliderRid);
  if (!inner) return null;
  const box = await (await frame.frameElement()).boundingBox();
  const s = box.width / inner.innerWidth;
  const at = (p) => ({ x: box.x + p.x * s, y: box.y + p.y * s });
  return {
    ...inner,
    thumbPage: at(inner.thumb),
    trackPage: { ...at(inner.track), width: inner.track.width * s },
    scale: s,
  };
}
const canvasThumb = () =>
  page.evaluate((sliderId) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const all = [...root.canvasInputs.values()];
    const slider = all.find((r) => r.sourceId === sliderId);
    const find = (r, type) => {
      for (const k of r.children) {
        const kr = root.canvasInputs.get(k);
        if (root.typeOf(kr) === type) return kr;
        const deep = find(kr, type);
        if (deep) return deep;
      }
      return null;
    };
    const thumb = find(slider, "ColorThumb");
    const label = find(slider, "Label");
    return {
      color:
        JSON.parse(String(thumb.derivedProps?._colorThumb ?? "{}")).color ??
        null,
      label: { props: label.props, derived: label.derivedProps },
    };
  }, sliderId);

// ── L-4 a ColorSlider without props: RAC's channel name · value, red thumb ─────────────────────
const d0 = await sliderDom();
const c0 = await canvasThumb();
record(
  "L-4 ColorSlider without props: Preview channel name (locale) · 「0°」 · red thumb, Canvas thumb #ff0000ff",
  HUE.includes(d0?.label) &&
    d0?.output === "0°" &&
    d0?.thumbColor === "rgb(255, 0, 0)" &&
    c0.color === "#ff0000ff",
  { d0, c0 },
);

// ── Design panel helpers ──────────────────────────────────────────────────────────────────────
async function selectSlider() {
  await page.evaluate(
    (rid) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([rid]),
    sliderRid,
  );
  await wait(400);
  const design = page
    .locator(
      '.panel-toggle-rail button[aria-pressed="false"][aria-label="Design" i]',
    )
    .first();
  if (await design.count()) await design.click();
  await wait(800);
}
const field = (legend) =>
  page
    .locator('.panel-wrapper[data-panel="properties"] fieldset')
    .filter({
      has: page.locator("legend", { hasText: new RegExp(`^${legend}$`) }),
    })
    .first();
async function typeInto(legend, value) {
  const input = field(legend).locator("input").first();
  await input.fill(value);
  await input.press("Enter");
  await wait(900);
}
async function pick(legend, option) {
  const f = field(legend);
  const direct = f
    .locator('[role="radio"], button, [role="option"]')
    .filter({ hasText: new RegExp(`^${option}$`) });
  if (await direct.count()) await direct.first().click();
  else {
    await f.locator("button").first().click();
    await wait(300);
    await page
      .locator('[role="option"]')
      .filter({ hasText: new RegExp(`^${option}$`) })
      .first()
      .click();
  }
  await wait(900);
}
const props = () =>
  page.evaluate((id) => {
    const e =
      window.__COMPOSITION_CATALOG__.workspace.runtime.graph.getEntry(id);
    return Object.fromEntries(
      Object.entries(e.props).map(([k, w]) => [k, w.value]),
    );
  }, sliderId);
const undo = async () => {
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.undo());
  await wait(900);
};
const redo = async () => {
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.redo());
  await wait(900);
};

// ── L-5 Design panel default value edit, no reload: Preview · Canvas follow; undo · redo ───────
await selectSlider();
const r5 = await revision();
await typeInto("Default Value", "hsl(240, 100%, 50%)");
const r5b = await revision();
const d5 = await sliderDom();
const c5 = await canvasThumb();
await undo();
const d5u = await sliderDom();
const c5u = await canvasThumb();
await redo();
const d5r = await sliderDom();
const c5r = await canvasThumb();
record(
  "L-5 Default Value hsl(240…) → Preview 240° · Canvas #0000ffff (one step); undo → 0° · #ff0000ff; redo → 240°",
  d5.output === "240°" &&
    c5.color === "#0000ffff" &&
    d5u.output === "0°" &&
    c5u.color === "#ff0000ff" &&
    d5r.output === "240°" &&
    c5r.color === "#0000ffff" &&
    r5b === r5 + 1,
  {
    d5: d5.output,
    c5: c5.color,
    d5u: d5u.output,
    c5u: c5u.color,
    d5r: d5r.output,
    c5r: c5r.color,
  },
);

// ── L-6 a Preview drag: RAC's state moves, the document does not ──────────────────────────────
await page.evaluate(() =>
  window.__COMPOSITION_CATALOG__.workspace.selectRecords([]),
);
await wait(300);
async function dragTo(fraction, { holdThen } = {}) {
  const d = await sliderDom();
  const to = {
    x: d.trackPage.x + d.trackPage.width * fraction,
    y: d.thumbPage.y,
  };
  await page.mouse.move(d.thumbPage.x, d.thumbPage.y);
  await page.mouse.down();
  await page.mouse.move((d.thumbPage.x + to.x) / 2, to.y, { steps: 6 });
  if (holdThen) await holdThen();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  await wait(700);
}
const r6 = await revision();
await dragTo(0.25);
const d6 = await sliderDom();
record(
  "L-6 Preview drag to ¼ of the track → output ≈ 90°, revision unchanged",
  Math.abs(parseInt(d6.output) - 90) <= 3 && (await revision()) === r6,
  { output: d6.output, r6, rev: await revision() },
);

// ── L-7 a non-default prop edit during a drag and after it keeps the dragged value ────────────
const r7 = await revision();
await dragTo(0.75, {
  holdThen: () =>
    page.evaluate(
      async ({ COMMANDS, sliderId }) => {
        const c = await import(COMMANDS);
        window.__COMPOSITION_CATALOG__.workspace.execute(
          c.setFields({
            targets: [{ kind: "node", id: sliderId }],
            props: { label: { kind: "set", value: "Tint" } },
          }),
        );
        await new Promise((r) => setTimeout(r, 400));
      },
      { COMMANDS, sliderId },
    ),
});
const d7 = await sliderDom();
await selectSlider();
await typeInto("Label", "Shade");
await page.evaluate(() =>
  window.__COMPOSITION_CATALOG__.workspace.selectRecords([]),
);
const r7b = await revision();
const d7b = await sliderDom();
record(
  "L-7 label edit while the pointer is down (and a panel label edit after) — the drag ends at ≈ 270° and stays",
  Math.abs(parseInt(d7.output) - 270) <= 3 &&
    d7.label === "Tint" &&
    d7b.output === d7.output &&
    d7b.label === "Shade" &&
    r7b === r7 + 2,
  { d7: [d7.label, d7.output], d7b: [d7b.label, d7b.output] },
);

// ── L-7c orientation · isDisabled edits after the drag keep the dragged value too (the key is the
//    default value only) ───────────────────────────────────────────────────────────────────────
const sliderProps = (patch) =>
  page.evaluate(
    async ({ COMMANDS, sliderId, patch }) => {
      const c = await import(COMMANDS);
      window.__COMPOSITION_CATALOG__.workspace.execute(
        c.setFields({
          targets: [{ kind: "node", id: sliderId }],
          props: Object.fromEntries(
            Object.entries(patch).map(([k, v]) => [
              k,
              v === null ? { kind: "remove" } : { kind: "set", value: v },
            ]),
          ),
        }),
      );
      await new Promise((r) => setTimeout(r, 700));
    },
    { COMMANDS, sliderId, patch },
  );
await sliderProps({ orientation: "vertical" });
const d7v = await sliderDom();
await sliderProps({ orientation: null, isDisabled: true });
const d7d = await sliderDom();
await sliderProps({ isDisabled: null });
const d7e = await sliderDom();
record(
  "L-7c after the drag: orientation vertical → back · isDisabled on → off — the output stays the dragged value",
  [d7v, d7d, d7e].every((d) => d.output === d7.output),
  {
    dragged: d7.output,
    vertical: d7v.output,
    disabled: d7d.output,
    enabled: d7e.output,
  },
);

// ── L-8 drag → default value edit → RAC starts again; undo · redo start again too ──────────────
await selectSlider();
await typeInto("Default Value", "hsl(60, 100%, 50%)");
const d8 = await sliderDom();
await undo();
const d8u = await sliderDom();
await redo();
const d8r = await sliderDom();
record(
  "L-8 after a drag, Default Value hsl(60…) → 60°; undo → 240° (the earlier default, not the dragged 270°); redo → 60°",
  d8.output === "60°" && d8u.output === "240°" && d8r.output === "60°",
  { d8: d8.output, d8u: d8u.output, d8r: d8r.output },
);

// ── L-9 an achromatic hue edit (same rgb) starts RAC's state again; undo too ───────────────────
await typeInto("Default Value", "hsl(0, 0%, 50%)");
const d9a = await sliderDom();
await typeInto("Default Value", "hsl(120, 0%, 50%)");
const d9b = await sliderDom();
const c9b = await canvasThumb();
await undo();
const d9u = await sliderDom();
record(
  // (Same gray, two hues: RAC's hue thumb shows the hue at full saturation — rgb(0, 255, 0) at 120°.)
  "L-9 achromatic: hsl(0, 0%, 50%) → 0° · hsl(120, 0%, 50%) → 120° (same gray, the key starts RAC again) · Canvas thumb #00ff00ff; undo → 0°",
  d9a.output === "0°" &&
    d9b.output === "120°" &&
    d9u.output === "0°" &&
    d9b.thumbColor === "rgb(0, 255, 0)" &&
    c9b.color === "#00ff00ff",
  {
    d9a: [d9a.output, d9a.thumbColor],
    d9b: [d9b.output, d9b.thumbColor, c9b.color],
    d9u: d9u.output,
  },
);

// ── L-10 hsl · hue → Red in one pick (colorSpace rgb with it), one undo puts both back ────────
const r10 = await revision();
await pick("Channel", "Red");
const r10b = await revision();
const p10 = await props();
const d10 = await sliderDom();
await undo();
const p10u = await props();
record(
  "L-10 Channel Red (one pick) → colorSpace rgb in the same step; one undo → hue · no rgb",
  p10.channel === "red" &&
    p10.colorSpace === "rgb" &&
    r10b === r10 + 1 &&
    p10u.channel !== "red" &&
    p10u.colorSpace !== "rgb",
  { p10, p10u, output: d10.output },
);

// ── L-10b ColorArea: hsl · x channel Red in one pick → colorSpace rgb with it; one undo ────────
await page.evaluate((id) => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const rid = [...ws.root.canvasInputs.values()].find(
    (r) => r.sourceId === id,
  ).id;
  ws.selectRecords([rid]);
}, areaId);
await wait(700);
await pick("Color Space", "HSL");
const areaProps = () =>
  page.evaluate((id) => {
    const e =
      window.__COMPOSITION_CATALOG__.workspace.runtime.graph.getEntry(id);
    return Object.fromEntries(
      Object.entries(e.props).map(([k, w]) => [k, w.value]),
    );
  }, areaId);
const a10 = await areaProps();
const r10c = await revision();
await pick("X Channel", "Red");
const r10d = await revision();
const a10b = await areaProps();
await undo();
const a10u = await areaProps();
record(
  "L-10b ColorArea hsl · X Channel Red (one pick) → colorSpace rgb in the same step; one undo → hsl back",
  a10.colorSpace === "hsl" &&
    a10b.xChannel === "red" &&
    a10b.colorSpace === "rgb" &&
    r10d === r10c + 1 &&
    a10u.colorSpace === "hsl" &&
    a10u.xChannel !== "red",
  { a10, a10b, a10u },
);
await page.evaluate(
  (rid) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([rid]),
  sliderRid,
);
await wait(700);

// ── L-11 a CSS name is refused: field error, no step ───────────────────────────────────────────
const r11 = await revision();
await typeInto("Default Value", "red");
const invalid = await page.locator("[data-rac-color-invalid]").count();
record(
  "L-11 'red' → field error, revision unchanged",
  invalid > 0 && (await revision()) === r11,
  { invalid, r11, rev: await revision() },
);
await field("Default Value")
  .locator("input")
  .first()
  .press("Escape")
  .catch(() => {});

// ── L-12 the label text: authored wins, cleared → RAC's channel name (Preview and Canvas) ─────
await typeInto("Label", "");
await page.evaluate(() =>
  window.__COMPOSITION_CATALOG__.workspace.selectRecords([]),
);
await wait(500);
const d12 = await sliderDom();
const c12 = await canvasThumb();
record(
  "L-12 Label cleared → Preview channel name (RAC) · the same text on the Canvas Label",
  HUE.includes(d12.label) && JSON.stringify(c12.label).includes(d12.label),
  { dom: d12.label, canvas: c12.label },
);

// ── L-13 reload: the document values and the Preview come back ────────────────────────────────
const before13 = await props();
const same = await reopen(page);
await wait(1500);
const after13 = await page.evaluate((id) => {
  const e = window.__COMPOSITION_CATALOG__.workspace.runtime.graph.getEntry(id);
  return Object.fromEntries(
    Object.entries(e.props).map(([k, w]) => [k, w.value]),
  );
}, sliderId);
const d13 = await sliderDom();
record(
  "L-13 reload → same props · Preview output 0° (hsl(0, 0%, 50%))",
  same &&
    JSON.stringify(after13) === JSON.stringify(before13) &&
    d13?.output === "0°",
  { before13, after13, output: d13?.output },
);

// ── L-14 theme switch: the thumb ring follows --bg-raised in both legs ────────────────────────
const ringShot = async () => {
  const pos = await page.evaluate((sliderId) => {
    const cat = window.__COMPOSITION_CATALOG__;
    const root = cat.workspace.root;
    const all = [...root.canvasInputs.values()];
    const slider = all.find((r) => r.sourceId === sliderId);
    const box = cat.canvas.boundsOf(slider.id);
    cat.canvas.setCamera({ scale: 1, x: 40 - box.x, y: 120 - box.y });
    const find = (r) => {
      for (const k of r.children) {
        const kr = root.canvasInputs.get(k);
        if (root.typeOf(kr) === "ColorThumb") return kr;
        const deep = find(kr);
        if (deep) return deep;
      }
      return null;
    };
    const t = cat.canvas.boundsOf(find(slider).id);
    const el = document.querySelector("canvas").getBoundingClientRect();
    return { x: el.x + 40 + (t.x - box.x), y: el.y + 120 + (t.y - box.y) };
  }, sliderId);
  await wait(900);
  // The ring's left edge, 1px in (the 4px border), mid-height.
  const png = await page.screenshot({
    clip: {
      x: Math.round(pos.x) + 1,
      y: Math.round(pos.y) + 8,
      width: 1,
      height: 1,
    },
  });
  return png.toString("base64");
};
const dl = await sliderDom();
const canvasLight = await ringShot();
await page.evaluate(async (THEMES) => {
  const { createCatalogThemesHost } = await import(THEMES);
  createCatalogThemesHost(
    window.__COMPOSITION_CATALOG__.workspace,
  ).setActiveThemePreset({ darkMode: "dark" });
}, THEMES);
await wait(2000);
const dd = await sliderDom();
const canvasDark = await ringShot();
record(
  "L-14 dark theme: Preview thumb border color changes · Canvas ring pixel changes",
  dl.thumbBorder !== dd.thumbBorder && canvasLight !== canvasDark,
  {
    light: dl.thumbBorder,
    dark: dd.thumbBorder,
    canvasChanged: canvasLight !== canvasDark,
  },
);
await page.screenshot({ path: `${OUT}/adr258-g3-dark.png` });

record("L-15 page errors 0", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/report.json`,
  JSON.stringify({ results, errors }, null, 2),
);
console.log(`${results.filter((r) => r.pass).length}/${results.length}`);
await browser.close();
