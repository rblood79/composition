#!/usr/bin/env node
// adr258-color-parity-live.mjs — ADR-258 G2 (headed Chrome, the real Builder in Compare Mode).
//   Each fixture places one Color control origin (ColorArea · ColorSlider · ColorWheel) with its
//   props, puts the Canvas camera at scale 1 and pixel-compares the Canvas (Skia) leg with the
//   Preview (RAC DOM + generated CSS) leg on the painted part — the area · track · ring — with the
//   thumb and text cut out (pixelmatch threshold 0.1; G2 = diff ratio ≤ 0.001). The thumb box is
//   compared alone as a recorded read. A ring edge (the wheel's two circles) is anti-aliased by two
//   rasterizers: its 2px band is reported apart (`edgeBand`) and left out of the ratio.
// Use: node apps/builder/scripts/adr258-color-parity-live.mjs <outDir> [--dark]  (dev 5173 · .auth-session.json)
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import pixelmatch from "pixelmatch";

const require = createRequire(import.meta.url);
const { PNG } = require(
  resolve("node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs"),
);
const H = resolve("apps/builder/scripts/adr256-g5/harness.mjs");
const { launch, newProject } = await import(H);
const OUT = process.argv[2] ?? "/private/tmp/adr258-parity";
const DARK = process.argv.includes("--dark");
mkdirSync(OUT, { recursive: true });
const COMMANDS = `/@fs${process.cwd()}/packages/shared/src/catalog/commands/index.ts`;

const FIXTURES = [
  ["area-rgb", "colorarea", { defaultValue: "#8040c0" }],
  [
    "area-hsl-sl",
    "colorarea",
    { defaultValue: "hsl(210, 60%, 40%)", colorSpace: "hsl" },
  ],
  [
    "area-hsl-hue-l",
    "colorarea",
    {
      defaultValue: "hsl(210, 60%, 40%)",
      colorSpace: "hsl",
      xChannel: "hue",
      yChannel: "lightness",
    },
  ],
  [
    "area-hsb",
    "colorarea",
    { defaultValue: "hsb(30, 70%, 80%)", colorSpace: "hsb" },
  ],
  ...["hue", "lightness", "alpha", "red"].flatMap((channel) =>
    ["horizontal", "vertical"].map((orientation) => [
      `slider-${channel}-${orientation}`,
      "colorslider",
      {
        defaultValue:
          channel === "red"
            ? "#8040c0"
            : channel === "alpha"
              ? "hsla(200, 80%, 50%, 0.6)"
              : "hsl(200, 80%, 50%)",
        channel,
        orientation,
      },
    ]),
  ),
  ["wheel-180", "colorwheel", { defaultValue: "hsl(90, 100%, 50%)" }],
  [
    "wheel-240",
    "colorwheel",
    { defaultValue: "hsl(225, 100%, 50%)", size: 240 },
  ],
  ["area-disabled", "colorarea", { defaultValue: "#8040c0", isDisabled: true }],
  [
    "slider-disabled",
    "colorslider",
    { defaultValue: "hsl(200, 80%, 50%)", isDisabled: true },
  ],
];

const { browser, page, errors } = await launch();
await newProject(page, `adr258-g2-${Date.now()}`);
if (DARK) {
  // (The Theme panel's dark switch — its host, the same command.)
  const HOST = `/@fs${process.cwd()}/apps/builder/src/builder/panels/themes/catalog/catalogThemesHost.ts`;
  await page.evaluate(async (HOST) => {
    const { createCatalogThemesHost } = await import(HOST);
    createCatalogThemesHost(
      window.__COMPOSITION_CATALOG__.workspace,
    ).setActiveThemePreset({ darkMode: "dark" });
  }, HOST);
  await page.waitForTimeout(2000);
  const frame = page.frames().find((f) => f.url().includes("preview.html"));
  console.log(
    "theme",
    await frame.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    ),
  );
}

async function placeWith(definitionId, props) {
  return page.evaluate(
    async ({ COMMANDS, definitionId, props }) => {
      const c = await import(COMMANDS);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const body = [...ws.root.canvasInputs.values()].find((r) =>
        r.sourceId.endsWith("home-body"),
      );
      // (One fixture at a time: the body's earlier children go first.)
      const old = ws.runtime.graph.getEntry(body.sourceId).children;
      if (old.length)
        ws.execute(
          c.removeTargets({
            targets: old.map((id) => ({ kind: "node", id })),
            newId: ws.newId,
          }),
        );
      const id = ws.newId("node");
      ws.execute(
        c.insertNodes({
          parent: { kind: "node", id: body.sourceId },
          entries: [
            {
              kind: "node",
              id,
              definitionId,
              children: [],
              props: Object.fromEntries(
                Object.entries(props).map(([k, v]) => [
                  k,
                  { kind: "set", value: v },
                ]),
              ),
              visual: {},
              sizing: {},
              // (Clear of the Compare Mode header and the panel rail over the Preview pane — both legs.)
              layout: {
                marginTop: { kind: "set", value: "120px" },
                marginLeft: { kind: "set", value: "60px" },
              },
              descendantOverrides: [],
            },
          ],
          rootIds: [id],
          newId: ws.newId,
        }),
      );
      ws.selectRecords?.([]);
      await new Promise((r) => setTimeout(r, 1500));
      return id;
    },
    { COMMANDS, definitionId, props },
  );
}

/** Canvas leg: camera at scale 1 with the part's scene box at (40, 120) of the canvas element. */
async function canvasRect(partType) {
  return page.evaluate(async (partType) => {
    const cat = window.__COMPOSITION_CATALOG__;
    const ws = cat.workspace;
    const rec = [...ws.root.canvasInputs.values()].find(
      (r) => ws.root.typeOf(r) === partType,
    );
    const box = cat.canvas.boundsOf(rec.id);
    cat.canvas.setCamera({ scale: 1, x: 40 - box.x, y: 120 - box.y });
    await new Promise((r) => setTimeout(r, 900));
    const el = document.querySelector("canvas").getBoundingClientRect();
    const thumb = [...ws.root.canvasInputs.values()].find(
      (r) => ws.root.typeOf(r) === "ColorThumb",
    );
    const t = cat.canvas.boundsOf(thumb.id);
    return {
      rect: {
        x: el.x + 40,
        y: el.y + 120,
        width: box.width,
        height: box.height,
      },
      thumb: {
        x: t.x - box.x,
        y: t.y - box.y,
        width: t.width,
        height: t.height,
      },
    };
  }, partType);
}

/** Preview leg: the part element's box in the Preview frame (Compare Mode pane, 1:1). */
async function domRect(selector) {
  const frame = page.frames().find((f) => f.url().includes("preview.html"));
  const inner = await frame.evaluate((selector) => {
    const e = document.querySelector(selector);
    const r = e.getBoundingClientRect();
    const t = document
      .querySelector(".react-aria-ColorThumb")
      .getBoundingClientRect();
    return {
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      thumb: { x: t.x - r.x, y: t.y - r.y, width: t.width, height: t.height },
    };
  }, selector);
  const iframe = await (await frame.frameElement()).boundingBox();
  return {
    ...inner,
    rect: {
      ...inner.rect,
      x: iframe.x + inner.rect.x,
      y: iframe.y + inner.rect.y,
    },
  };
}

const shot = async (rect) =>
  PNG.sync.read(
    await page.screenshot({
      type: "png",
      animations: "disabled",
      clip: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    }),
  );

/** pixelmatch on a mask (true = compared). */
function compare(a, b, mask, name) {
  const { width, height } = a;
  const diff = new PNG({ width, height });
  pixelmatch(a.data, b.data, diff.data, width, height, { threshold: 0.1 });
  let compared = 0;
  let differing = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (!mask(x, y)) continue;
      compared++;
      const i = (y * width + x) * 4;
      // (pixelmatch paints a differing pixel red: 255, 0, 0.)
      if (
        diff.data[i] === 255 &&
        diff.data[i + 1] === 0 &&
        diff.data[i + 2] === 0
      )
        differing++;
    }
  writeFileSync(`${OUT}/${name}-diff.png`, PNG.sync.write(diff));
  return { compared, differing, ratio: compared ? differing / compared : 0 };
}

const results = [];
const SELECTOR = {
  ColorArea: ".react-aria-ColorArea",
  SliderTrack: ".react-aria-ColorSlider .react-aria-SliderTrack",
  ColorWheelTrack: ".react-aria-ColorWheelTrack",
};
const PART = {
  colorarea: "ColorArea",
  colorslider: "SliderTrack",
  colorwheel: "ColorWheelTrack",
};
for (const [name, origin, props] of FIXTURES) {
  await placeWith(`lib:definition:origin-component-${origin}`, props);
  const part = PART[origin];
  const c = await canvasRect(part);
  const d = await domRect(SELECTOR[part]);
  // (A full-width ColorArea is wider than a Compare Mode pane: its first 360px are compared.)
  const w = Math.round(Math.min(c.rect.width, d.rect.width, 360));
  const h = Math.round(Math.min(c.rect.height, d.rect.height, 300));
  const canvas = await shot({ ...c.rect, width: w, height: h });
  const dom = await shot({ ...d.rect, width: w, height: h });
  writeFileSync(`${OUT}/${name}-canvas.png`, PNG.sync.write(canvas));
  writeFileSync(`${OUT}/${name}-dom.png`, PNG.sync.write(dom));
  // The thumb (both legs' boxes, 2px margin) and the box's outer 1px row/column are cut out.
  const thumbs = [c.thumb, d.thumb];
  const inThumb = (x, y) =>
    thumbs.some(
      (t) =>
        x >= t.x - 2 &&
        x < t.x + t.width + 2 &&
        y >= t.y - 2 &&
        y < t.y + t.height + 2,
    );
  let edge = () => false;
  if (origin === "colorwheel") {
    const outer = w / 2;
    const inner = outer - 26;
    edge = (x, y) => {
      const r = Math.hypot(x + 0.5 - outer, y + 0.5 - outer);
      return Math.abs(r - outer) < 2 || Math.abs(r - inner) < 2;
    };
  }
  // ADR-198 L3e: the 3px band at the box edge (two rasterizers' corner anti-aliasing) is recorded
  // apart, not in the ratio — HC6 L3 is the region inside it.
  const border = (x, y) => x < 3 || y < 3 || x >= w - 3 || y >= h - 3;
  const body = compare(
    canvas,
    dom,
    (x, y) => !inThumb(x, y) && !edge(x, y) && !border(x, y),
    name,
  );
  const band = compare(
    canvas,
    dom,
    (x, y) => border(x, y) && !inThumb(x, y),
    `${name}-band`,
  );
  const edgeBand =
    origin === "colorwheel"
      ? compare(
          canvas,
          dom,
          (x, y) => edge(x, y) && !inThumb(x, y),
          `${name}-edge`,
        )
      : undefined;
  // Thumb read: the Canvas thumb box vs the DOM thumb box (each at its own place).
  const ct = c.thumb;
  const tw = Math.round(ct.width);
  const inside = (t) =>
    t.x >= 0 && t.y >= 0 && t.x + t.width <= w && t.y + t.height <= h;
  const thumb =
    inside(ct) && inside(d.thumb)
      ? compare(
          await shot({
            x: c.rect.x + ct.x,
            y: c.rect.y + ct.y,
            width: tw,
            height: tw,
          }),
          await shot({
            x: d.rect.x + d.thumb.x,
            y: d.rect.y + d.thumb.y,
            width: tw,
            height: tw,
          }),
          () => true,
          `${name}-thumb`,
        )
      : { compared: 0, differing: 0, ratio: 0, outside: true };
  const pass = body.ratio <= 0.001;
  results.push({
    name,
    props,
    canvas: c.rect,
    dom: d.rect,
    body,
    band,
    edgeBand,
    thumb,
    pass,
  });
  console.log(
    `${pass ? "PASS" : "FAIL"} ${name} — body ${body.differing}/${body.compared} (${(body.ratio * 100).toFixed(3)}%) · L3e ${band.differing}/${band.compared}${edgeBand ? ` · edge ${edgeBand.differing}/${edgeBand.compared}` : ""} · thumb ${thumb.differing}/${thumb.compared} · size canvas ${c.rect.width}×${c.rect.height} dom ${d.rect.width}×${d.rect.height}`,
  );
}
writeFileSync(
  `${OUT}/report${DARK ? "-dark" : ""}.json`,
  JSON.stringify({ dark: DARK, results, errors }, null, 2),
);
console.log(
  `${results.filter((r) => r.pass).length}/${results.length} · page errors ${errors.length}`,
);
await browser.close();
