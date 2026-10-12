#!/usr/bin/env node
// adr259-live.mjs — ADR-259 live gates in the real Builder (headed Chrome, Compare Mode), and the
// Preview's link navigation in WebKit (Playwright WebKit — RAC's synthetic link keydown path).
//
//   node apps/builder/scripts/adr259-live.mjs <outDir> [--phase 1|2|3] [--dark]   (dev 5173 · .auth-session.json)
//
// Phase 1 (G1): an item's link through the Design panel's Link fields (URL · Target) · undo · save
//   and reopen · the Preview's link click / Enter (internal path → the Preview's page, external →
//   a new tab, `_blank` → the browser; the Preview frame never navigates) in Chrome and WebKit ·
//   the link-out glyph of a GridListItem · MenuItem: Canvas leg = Preview leg (pixelmatch 0.1 on the
//   glyph box, and the item boxes).
// Phase 2 (G2): a field's prefix through the Design panel (Prefix · Prefix Text) · undo (one step) ·
//   save and reopen · the Preview DOM (prefix first in the FieldBox, the input's name) · focus
//   forwarding · each box Canvas = Preview (5 fields × 4 states × text/icon, against no-prefix
//   control fields) · None unwraps.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import pixelmatch from "pixelmatch";

const require = createRequire(import.meta.url);
const { PNG } = require(
  resolve("node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs"),
);
const H = resolve("apps/builder/scripts/adr256-g5/harness.mjs");
const { launch, newProject, edit, reopen, BASE } = await import(H);
const OUT = process.argv[2] ?? "/private/tmp/adr259-live";
const PHASE = process.argv.includes("--phase")
  ? process.argv[process.argv.indexOf("--phase") + 1]
  : "1";
const DARK = process.argv.includes("--dark");
mkdirSync(OUT, { recursive: true });

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 900)}\n`,
  );
};

const previewFrame = (page) =>
  page.frames().find((f) => f.url().includes("preview.html"));

async function darkTheme(page) {
  const HOST = `/@fs${process.cwd()}/apps/builder/src/builder/panels/themes/catalog/catalogThemesHost.ts`;
  await page.evaluate(async (HOST) => {
    const { createCatalogThemesHost } = await import(HOST);
    createCatalogThemesHost(
      window.__COMPOSITION_CATALOG__.workspace,
    ).setActiveThemePreset({ darkMode: "dark" });
  }, HOST);
  await page.waitForTimeout(2000);
}

/** Canvas leg: camera at scale 1 with the record's box at (40, 140) of the canvas element. */
async function canvasRect(page, id) {
  return page.evaluate(async (id) => {
    const cat = window.__COMPOSITION_CATALOG__;
    const box = cat.canvas.boundsOf(id);
    cat.canvas.setCamera({ scale: 1, x: 40 - box.x, y: 140 - box.y });
    await new Promise((r) => setTimeout(r, 1800));
    const el = document.querySelector("canvas").getBoundingClientRect();
    return { x: el.x + 40, y: el.y + 140, width: box.width, height: box.height };
  }, id);
}

/** Preview leg: the record element's box (and its link-out glyph box) in page coordinates. */
async function domRect(page, id, glyphSelector = ".link-out") {
  const frame = previewFrame(page);
  const inner = await frame.evaluate(({ id, glyphSelector }) => {
    const el = document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
    el.scrollIntoView({ block: "center", inline: "center" });
    const r = el.getBoundingClientRect();
    const g = el.querySelector(glyphSelector)?.getBoundingClientRect();
    return {
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      glyph: g && { x: g.x - r.x, y: g.y - r.y, width: g.width, height: g.height },
    };
  }, { id, glyphSelector });
  const iframe = await (await frame.frameElement()).boundingBox();
  return {
    ...inner,
    rect: { ...inner.rect, x: iframe.x + inner.rect.x, y: iframe.y + inner.rect.y },
  };
}

const shot = async (page, rect) =>
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

function compare(a, b, mask, name) {
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  const crop = (png) => {
    const out = new PNG({ width, height });
    for (let y = 0; y < height; y++)
      png.data.copy(out.data, y * width * 4, y * png.width * 4, y * png.width * 4 + width * 4);
    return out;
  };
  const A = crop(a);
  const B = crop(b);
  const diff = new PNG({ width, height });
  pixelmatch(A.data, B.data, diff.data, width, height, { threshold: 0.1 });
  let compared = 0;
  let differing = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (!mask(x, y)) continue;
      compared++;
      const i = (y * width + x) * 4;
      if (diff.data[i] === 255 && diff.data[i + 1] === 0 && diff.data[i + 2] === 0)
        differing++;
    }
  writeFileSync(`${OUT}/${name}-canvas.png`, PNG.sync.write(A));
  writeFileSync(`${OUT}/${name}-preview.png`, PNG.sync.write(B));
  writeFileSync(`${OUT}/${name}-diff.png`, PNG.sync.write(diff));
  return { compared, differing, ratio: compared ? differing / compared : 0 };
}

// ── Phase 1 ──────────────────────────────────────────────────────────────────────────────────
async function phase1() {
  const { browser, page, errors } = await launch();
  await newProject(page, `adr259-p1-${Date.now()}`);
  if (DARK) await darkTheme(page);

  // A ListBox (an `<a>` item), a GridList (a synthetic link item + the glyph), a Menu (an `<a>`
  // item + the glyph) — the Menu as RAC's open list (a Menu node outside a trigger).
  const placed = await edit(page, (c, ws, h) => {
    const listbox = h.newId();
    const grid = h.newId();
    const menu = h.newId();
    const item = h.newId();
    return [
      h.insert("body", [
        h.node(listbox, "lib:definition:origin-component-listbox", {}, { width: 240 }),
        h.node(grid, "lib:definition:origin-component-gridlist", {}, { width: 320 }),
        h.node(menu, "lib:definition:type-Menu", {}, { width: 320 }),
        // (The control arm: an Icon node of the same glyph — the two rasterizers' own difference.)
        h.node(h.newId(), "lib:definition:type-Icon", { iconName: "external-link" }, { fontSize: 10 }),
      ]),
      h.later(() =>
        h.insert(h.bySource(menu).id, [
          h.node(item, "lib:definition:origin-component-menu-item-default"),
        ]),
      ),
    ];
  });
  record("L1-0 place ListBox · GridList · Menu", placed.ok, placed);
  await page.waitForTimeout(1500);

  const ids = await page.evaluate(() => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const all = [...root.canvasInputs.values()];
    const first = (type) => all.find((r) => root.typeOf(r) === type)?.id;
    return {
      listboxItem: first("ListBoxItem"),
      gridItem: first("GridListItem"),
      grid: first("GridList"),
      menuItem: first("MenuItem"),
      menu: first("Menu"),
      icon: all.find(
        (r) => root.typeOf(r) === "Icon" && r.props.iconName === "external-link",
      )?.id,
    };
  });

  // L1-1 — the Design panel's Link fields on a ListBoxItem (URL typed in, Target picked).
  await page.evaluate((id) => {
    window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]);
  }, ids.listboxItem);
  await page.waitForTimeout(800);
  const design = page.getByRole("button", { name: "Design", exact: true }).first();
  if (await design.isVisible().catch(() => false)) await design.click();
  await page.waitForTimeout(1000);
  const url = page.locator("xpath=//*[normalize-space(text())='URL']/following::input[1]").first();
  const urlVisible = await url.isVisible().catch(() => false);
  if (urlVisible) {
    await url.fill("/about");
    await url.press("Enter");
    await page.waitForTimeout(800);
  }
  const written = await page.evaluate(
    (id) => window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.get(id)?.props.href ?? null,
    ids.listboxItem,
  );
  record("L1-1 Design panel URL field writes the item's href", urlVisible && written === "/about", {
    urlVisible,
    written,
  });

  // L1-2 — undo removes it, redo puts it back.
  const undoRedo = await page.evaluate(async (id) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const href = () => ws.root.canvasInputs.get(id)?.props.href ?? null;
    ws.undo();
    await new Promise((r) => setTimeout(r, 300));
    const afterUndo = href();
    ws.redo();
    await new Promise((r) => setTimeout(r, 300));
    return { afterUndo, afterRedo: href() };
  }, ids.listboxItem);
  record(
    "L1-2 undo · redo",
    undoRedo.afterUndo !== "/about" && undoRedo.afterRedo === "/about",
    undoRedo,
  );

  // The rest of the links (commands — the panel path is L1-1).
  const links = await edit(
    page,
    (c, ws, h, ids) => [
      h.props(ids.gridItem, { href: "https://example.com/", target: "_blank" }),
      h.props(ids.menuItem, { href: "https://example.com/", target: "_blank" }),
    ],
    ids,
  );
  record("L1-3 GridListItem · MenuItem links (href + _blank)", links.ok, links);

  // L1-4 — save and reopen: the links stay.
  const same = await reopen(page);
  const kept = await page.evaluate((ids) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    return Object.fromEntries(
      ["listboxItem", "gridItem", "menuItem"].map((k) => [
        k,
        root.canvasInputs.get(ids[k])?.props.href ?? null,
      ]),
    );
  }, ids);
  record(
    "L1-4 save · reopen keeps the links",
    same &&
      kept.listboxItem === "/about" &&
      kept.gridItem === "https://example.com/" &&
      kept.menuItem === "https://example.com/",
    kept,
  );

  // L1-5 — Preview DOM: RAC's link output.
  const dom = await previewFrame(page).evaluate((ids) => {
    const at = (id) => document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
    const shape = (el) =>
      el && {
        tag: el.tagName.toLowerCase(),
        href: el.getAttribute("href"),
        target: el.getAttribute("target"),
        dataHref: el.getAttribute("data-href"),
        glyph: !!el.querySelector(".link-out svg"),
        decoration: getComputedStyle(el).textDecorationLine,
        color: getComputedStyle(el).color,
      };
    return {
      listboxItem: shape(at(ids.listboxItem)),
      gridItem: shape(at(ids.gridItem)),
      menuItem: shape(at(ids.menuItem)),
    };
  }, ids);
  record(
    "L1-5 Preview DOM — <a> · data-href · glyph · no underline",
    dom.listboxItem?.tag === "a" &&
      dom.listboxItem.href === "/about" &&
      dom.listboxItem.decoration === "none" &&
      dom.gridItem?.dataHref === "https://example.com/" &&
      dom.gridItem.glyph &&
      dom.menuItem?.tag === "a" &&
      dom.menuItem.glyph &&
      dom.menuItem.decoration === "none",
    dom,
  );

  const frameUrl = () => previewFrame(page).url();
  // L1-8 — the `_blank` synthetic link (GridListItem) → the browser opens a new tab.
  const popup = page.context().waitForEvent("page", { timeout: 8000 }).catch(() => null);
  const frameBefore = frameUrl();
  await page
    .frameLocator("#previewFrame")
    .locator(`[data-catalog-id="${ids.gridItem}"]`)
    .click()
    .catch(() => {});
  const opened = await popup;
  await page.waitForTimeout(800);
  record("L1-8 Chrome `_blank` synthetic link → new tab (frame stays)", !!opened && frameUrl() === frameBefore, {
    opened: opened?.url() ?? null,
    frame: frameUrl(),
  });
  if (opened) await opened.close();
  // L1-6 — the glyph: Canvas leg = Preview leg — the item box (±1), the glyph's ink centre (±0.5 px)
  // and its pixels against the control arm (an Icon node of the same glyph and size, same
  // rasterizer pair): the glyph may differ by no more than the two rasterizers differ on their own.
  const inkCentre = (png) => {
    let sx = 0, sy = 0, sw = 0;
    for (let y = 0; y < png.height; y++)
      for (let x = 0; x < png.width; x++) {
        const i = (y * png.width + x) * 4;
        const w = 255 - (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3;
        if (w <= 8) continue;
        sx += x * w; sy += y * w; sw += w;
      }
    return sw ? { x: sx / sw, y: sy / sw } : null;
  };
  const drawnGlyph = (id) =>
    page.evaluate((id) => {
      const node = window.__composition_SKIA_DEBUG__?.getSkiaNode?.(id);
      const find = (n) => {
        if (!n) return null;
        if (n.iconPath) return n.iconPath;
        for (const c of n.children ?? []) {
          const f = find(c);
          if (f) return f;
        }
        return null;
      };
      const p = find(node);
      return p && { cx: p.cx, cy: p.cy, size: p.size };
    }, id);
  const glyphLegs = async (id, sel, name) => {
    const preview = await domRect(page, id, sel);
    const canvas = await canvasRect(page, id);
    const drawn = await drawnGlyph(id);
    const g = preview.glyph;
    if (!g || !drawn) return { preview: preview.rect, canvas, g, drawn };
    const pad = 4;
    // Each leg clipped at its own glyph box (the Canvas at the glyph it drew) — the pixels compare
    // the glyph's paint, the centres its place.
    const a = await shot(page, {
      x: canvas.x + drawn.cx - drawn.size / 2 - pad,
      y: canvas.y + drawn.cy - drawn.size / 2 - pad,
      width: drawn.size + pad * 2,
      height: drawn.size + pad * 2,
    });
    const b = await shot(page, {
      x: preview.rect.x + g.x - pad,
      y: preview.rect.y + g.y - pad,
      width: g.width + pad * 2,
      height: g.height + pad * 2,
    });
    return {
      preview: preview.rect,
      canvas,
      g,
      drawn,
      diff: compare(a, b, () => true, `${name}${DARK ? "-dark" : ""}-glyph`),
    };
  };
  const control = await glyphLegs(ids.icon, "svg", "control-icon");
  record("L1-6 (record) control arm — an Icon node of the same glyph (10 px)", !!control.diff, {
    drawn: control.drawn,
    dom: control.g,
    pixels: control.diff,
  });
  for (const [name, id] of [
    ["gridItem", ids.gridItem],
    ["menuItem", ids.menuItem],
  ]) {
    const leg = await glyphLegs(id, ".link-out", name);
    const sizeMatch =
      Math.abs(leg.preview.width - leg.canvas.width) <= 1 &&
      Math.abs(leg.preview.height - leg.canvas.height) <= 1;
    const dom = leg.g && { cx: leg.g.x + leg.g.width / 2, cy: leg.g.y + leg.g.height / 2, size: leg.g.width };
    record(
      `L1-6 ${name} glyph Canvas = Preview (box ±1 · glyph centre ±0.5 · size = · pixels ≤ 0.001 or ≤ the control arm)`,
      sizeMatch &&
        !!leg.drawn &&
        !!dom &&
        Math.abs(leg.drawn.cx - dom.cx) <= 0.5 &&
        Math.abs(leg.drawn.cy - dom.cy) <= 0.5 &&
        leg.drawn.size === dom.size &&
        !!leg.diff &&
        (leg.diff.ratio <= 0.001 || leg.diff.ratio <= (control.diff?.ratio ?? 0)),
      { drawn: leg.drawn, dom, pixels: leg.diff, control: control.diff?.ratio },
    );
  }

  // L1-7 — Preview navigation (Chrome): the internal link → the Preview's page (not-found here,
  // the path shown), the frame stays on preview.html; the `_blank` link → a new tab.
  const before = frameUrl();
  await page
    .frameLocator("#previewFrame")
    .locator(`[data-catalog-id="${ids.listboxItem}"]`)
    .dispatchEvent("click");
  await page.waitForTimeout(1200);
  const internal = await previewFrame(page).evaluate(() => ({
    notFound: document.querySelector(".preview-not-found__path")?.textContent ?? null,
  }));
  record(
    "L1-7 Chrome internal link → Preview page (frame stays)",
    frameUrl() === before && internal.notFound === "/about",
    { before, after: frameUrl(), internal },
  );

  record("L1-9 page errors 0", errors.length === 0, errors.slice(0, 5));
  await browser.close();
  return ids;
}

// WebKit: RAC's synthetic link (GridListItem `data-href`) opens by Enter → the keydown path.
async function phase1WebKit() {
  const pw = await import(
    resolve("node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/index.js")
  );
  const { readFileSync } = await import("node:fs");
  const state = JSON.parse(
    readFileSync(`${process.cwd()}/apps/builder/scripts/.auth-session.json`, "utf8"),
  );
  state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
  const browser = await pw.default.webkit.launch();
  const context = await browser.newContext({
    storageState: state,
    viewport: { width: 1600, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  await newProject(page, `adr259-p1-webkit-${Date.now()}`);
  const placed = await edit(page, (c, ws, h) => {
    const grid = h.newId();
    return [
      h.insert("body", [h.node(grid, "lib:definition:origin-component-gridlist")]),
      h.later(() => {
        const item = h.within(h.bySource(grid).id, "GridListItem")[0];
        return h.props(item.id, { href: "/about" });
      }),
    ];
  });
  await page.waitForTimeout(1500);
  const item = await page.evaluate(() => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    return [...root.canvasInputs.values()].find((r) => root.typeOf(r) === "GridListItem").id;
  });
  const frame = previewFrame(page);
  const before = frame.url();
  const platform = await frame.evaluate(() => navigator.platform);
  await page.frameLocator("#previewFrame").locator(`[data-catalog-id="${item}"]`).focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  const after = previewFrame(page)?.url() ?? null;
  const notFound = await previewFrame(page)
    ?.evaluate(() => document.querySelector(".preview-not-found__path")?.textContent ?? null)
    .catch(() => null);
  record(
    "L1-10 WebKit Enter on a synthetic link → Preview page (frame stays)",
    placed.ok && after === before && notFound === "/about",
    { platform, before, after, notFound, errors: errors.slice(0, 3) },
  );
  await browser.close();
}

// ── Phase 2 ──────────────────────────────────────────────────────────────────────────────────
const PREFIX_FIELDS = ["TextField", "TextArea", "NumberField", "ComboBox", "ColorField"];
const PREFIX_STATES = [
  ["default", {}],
  ["quiet", { isQuiet: true }],
  ["invalid", { isInvalid: true }],
  ["disabled", { isDisabled: true }],
];
const PREFIX_MODULE = `/@fs${process.cwd()}/apps/builder/src/builder/catalogRuntime/fieldPrefixCommand.ts`;

/** Set every listed field's prefix by the Design command (one step each). */
async function setPrefixes(page, fieldIds, kind) {
  return page.evaluate(
    async ({ MOD, fieldIds, kind }) => {
      const { catalogFieldPrefixCommand } = await import(MOD);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      for (const id of fieldIds) {
        ws.execute(
          catalogFieldPrefixCommand({ field: ws.positionOfRecord(id), kind, newId: ws.newId }),
        );
        await new Promise((r) => setTimeout(r, 60));
      }
      await new Promise((r) => setTimeout(r, 800));
    },
    { MOD: PREFIX_MODULE, fieldIds, kind },
  );
}

/** Each field's box (its prefix Group, else its Input) and prefix ids. */
async function prefixParts(page, fieldIds) {
  return page.evaluate((fieldIds) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const get = (id) => root.canvasInputs.get(id);
    const below = (id, type) => {
      const out = [];
      const visit = (rid) => {
        for (const k of get(rid)?.children ?? []) {
          const kr = get(k);
          if (kr && root.typeOf(kr) === type) out.push(kr);
          visit(k);
        }
      };
      visit(id);
      return out;
    };
    return fieldIds.map((id) => {
      const prefix = [...below(id, "Text"), ...below(id, "Icon")].find(
        (r) => r.props.slot === "prefix",
      );
      const input = below(id, "Input")[0];
      return {
        field: id,
        type: root.typeOf(get(id)),
        prefix: prefix?.id ?? null,
        prefixType: prefix ? root.typeOf(prefix) : null,
        box: prefix ? prefix.parentId : input?.id,
        input: input?.id,
      };
    });
  }, fieldIds);
}

async function phase2() {
  const { browser, page, errors } = await launch();
  await newProject(page, `adr259-p2-${Date.now()}`);
  if (DARK) await darkTheme(page);
  const cases = PREFIX_FIELDS.flatMap((type) =>
    PREFIX_STATES.filter(([state]) => !(state === "quiet" && type === "ColorField")).map(
      ([state, props]) => ({ type, state, props }),
    ),
  );
  // (In a frame clear of the Builder's floating tools over the Preview's left edge, below room for
  // the Preview leg to scroll each box clear of the header.)
  const placed = await edit(
    page,
    (c, ws, h, cases) => {
      const holder = h.newId();
      return [
        h.insert("body", [
          {
            ...h.node(holder, "lib:definition:type-frame", {}, {
              width: 1000,
              paddingLeft: 120,
              paddingTop: 160,
              gap: 12,
            }),
            // (Three columns: every field inside the Canvas page — a page clips what runs past it.)
            layout: {
              display: h.set("flex"),
              flexDirection: h.set("row"),
              flexWrap: h.set("wrap"),
            },
          },
        ]),
        h.later(() =>
          h.insert(h.bySource(holder).id, [
            ...cases.map((k) =>
              h.node(
                h.newId(),
                `lib:definition:origin-component-${k.type.toLowerCase()}`,
                { label: "Price", ...k.props },
                { width: 260 },
              ),
            ),
            // (The control arm: fields without a prefix — the two rasterizers' own difference.)
            ...["TextField", "TextArea", "NumberField", "ComboBox", "ColorField"].map((type) =>
              h.node(
                h.newId(),
                `lib:definition:origin-component-${type.toLowerCase()}`,
                { label: "Price" },
                { width: 260 },
              ),
            ),
          ]),
        ),
      ];
    },
    cases,
  );
  record("L2-0 place 19 prefix fields + 5 control fields", placed.ok, placed);
  await page.waitForTimeout(1500);
  const fields = await page.evaluate(() => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const body = [...root.canvasInputs.values()].find((r) => r.sourceId.endsWith("home-body"));
    return root.canvasInputs.get(body.children[0]).children;
  });
  const prefixFields = fields.slice(0, cases.length);
  const controls = fields.slice(cases.length, cases.length + 5);

  // L2-1 — the Design panel's Prefix select on the first TextField, then its Prefix Text field.
  await page.evaluate((id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]), prefixFields[0]);
  await page.waitForTimeout(800);
  const design = page.getByRole("button", { name: "Design", exact: true }).first();
  if (await design.isVisible().catch(() => false)) await design.click();
  await page.waitForTimeout(1000);
  const select = page
    .locator("xpath=//*[normalize-space(text())='Prefix']/following::button[1]")
    .first();
  const selectVisible = await select.isVisible().catch(() => false);
  if (selectVisible) {
    await select.click();
    await page.getByRole("option", { name: "Text", exact: true }).click();
    await page.waitForTimeout(1000);
  }
  const textInput = page
    .locator("xpath=//*[normalize-space(text())='Prefix Text']/following::input[1]")
    .first();
  const textVisible = await textInput.isVisible().catch(() => false);
  await page.screenshot({ path: `${OUT}/L2-1-panel.png` });
  if (textVisible) {
    await textInput.fill("€");
    await textInput.press("Enter");
    await page.waitForTimeout(800);
  }
  let [first] = await prefixParts(page, [prefixFields[0]]);
  const firstText = await page.evaluate(
    (id) => id && window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.get(id)?.props.children,
    first.prefix,
  );
  record(
    "L2-1 Design panel Prefix → Text, Prefix Text → €",
    selectVisible && textVisible && first.prefixType === "Text" && firstText === "€",
    { selectVisible, textVisible, first, firstText },
  );

  // L2-2 — undo: the text, then the prefix (one step), redo both.
  const undo = await page.evaluate(async (fieldId) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const prefixOf = () => {
      const visit = (id) => {
        for (const k of root.canvasInputs.get(id)?.children ?? []) {
          const r = root.canvasInputs.get(k);
          if (r?.props.slot === "prefix") return r;
          const f = visit(k);
          if (f) return f;
        }
        return null;
      };
      return visit(fieldId);
    };
    const wait = () => new Promise((r) => setTimeout(r, 300));
    ws.undo();
    await wait();
    const afterText = prefixOf()?.props.children ?? null;
    ws.undo();
    await wait();
    const afterPrefix = prefixOf();
    ws.redo();
    await wait();
    ws.redo();
    await wait();
    return { afterText, afterPrefix: !!afterPrefix, redone: prefixOf()?.props.children ?? null };
  }, prefixFields[0]);
  record(
    "L2-2 undo (text · prefix — one step each) · redo",
    undo.afterText === "$" && !undo.afterPrefix && undo.redone === "€",
    undo,
  );

  // The rest by the command (the panel path is L2-1).
  await setPrefixes(page, prefixFields.slice(1), "text");
  const same = await reopen(page);
  let parts = await prefixParts(page, prefixFields);
  record(
    "L2-3 save · reopen keeps 19 prefixes",
    same && parts.every((p) => p.prefixType === "Text"),
    parts.filter((p) => p.prefixType !== "Text"),
  );

  // L2-4 — Preview DOM: the prefix first in the box, the input's name (S2 — not a TextArea's).
  const dom = await previewFrame(page).evaluate((parts) => {
    const at = (id) => document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
    const text = (el) => (el.getAttribute("aria-label") ?? el.textContent ?? "").trim();
    return parts.map((p) => {
      const prefix = at(p.prefix);
      const box = prefix?.parentElement;
      const control = box?.querySelector("input, textarea");
      const name = control
        ?.getAttribute("aria-labelledby")
        ?.split(/\s+/)
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .map(text)
        .join(" ");
      return {
        type: p.type,
        first: box?.firstElementChild === prefix,
        fieldBox: box?.classList.contains("react-aria-FieldBox") ?? false,
        name,
      };
    });
  }, parts);
  record(
    "L2-4 Preview DOM — prefix first in the FieldBox · input name (TextArea: label only)",
    dom.every(
      (d, i) =>
        d.first &&
        d.fieldBox &&
        d.name === (d.type === "TextArea" ? "Price" : i === 0 ? "Price €" : "Price $"),
    ),
    dom,
  );

  // L2-5 — focus forwarding: a mouse press on a TextField's prefix focuses its input (S2).
  const focus = await previewFrame(page).evaluate((id) => {
    const prefix = document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
    document.activeElement?.blur?.();
    prefix.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "mouse" }),
    );
    return document.activeElement?.tagName ?? null;
  }, parts[1].prefix);
  record("L2-5 Preview mouse press on the prefix focuses the input", focus === "INPUT", { focus });
  await previewFrame(page).evaluate(() => document.activeElement?.blur?.());

  // L2-6 — Canvas = Preview on each box (pixelmatch 0.1), against the no-prefix control arm.
  const boxLegs = async (id, name) => {
    const preview = await domRect(page, id);
    const canvas = await canvasRect(page, id);
    const sizeMatch =
      Math.abs(preview.rect.width - canvas.width) <= 1 &&
      Math.abs(preview.rect.height - canvas.height) <= 1;
    const a = await shot(page, canvas);
    const b = await shot(page, preview.rect);
    return {
      sizeMatch,
      canvas: [canvas.width, canvas.height],
      preview: [preview.rect.width, preview.rect.height],
      diff: compare(a, b, () => true, `${name}${DARK ? "-dark" : ""}`),
    };
  };
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.selectRecords([]));
  await page.mouse.move(5, 995);
  const controlParts = await prefixParts(page, controls);
  const control = {};
  for (const c of controlParts) {
    const leg = await boxLegs(c.input, `control-${c.type}`);
    control[c.type] = leg.diff.ratio;
    record(`L2-6 (record) control ${c.type} Input box`, leg.sizeMatch, leg);
  }
  // Each box: its paint (border · fill · corners — pixels outside the prefix's and the input's
  // boxes, ≤ 0.001) and its parts' places (the prefix's and the input's boxes, Canvas = DOM ±1).
  // The text inside is the rasterizers' (the control arm shows their own difference).
  const partsLegs = async (p, name) => {
    const preview = await domRect(page, p.box);
    const canvas = await canvasRect(page, p.box);
    const inner = await previewFrame(page).evaluate(({ box, prefix, input }) => {
      const at = (id) => document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
      const b = at(box).getBoundingClientRect();
      const rel = (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x - b.x, y: r.y - b.y, width: r.width, height: r.height };
      };
      return { prefix: rel(at(prefix)), input: rel(at(input)) };
    }, p);
    const drawn = await page.evaluate(({ prefix, input }) => {
      const root = window.__COMPOSITION_CATALOG__.workspace.root;
      const g = (id) => root.getGeometry([id]).get(id);
      return { prefix: g(prefix), input: g(input) };
    }, p);
    const close = (a, b) =>
      ["x", "y", "width", "height"].every((k) => Math.abs(a[k] - b[k]) <= 1);
    const masks = [inner.prefix, inner.input];
    const outside = (x, y) =>
      !masks.some(
        (m) => x >= m.x - 1 && x <= m.x + m.width + 1 && y >= m.y - 1 && y <= m.y + m.height + 1,
      );
    const a = await shot(page, canvas);
    const b = await shot(page, preview.rect);
    return {
      size: [canvas.width, canvas.height, preview.rect.width, preview.rect.height],
      sizeMatch:
        Math.abs(preview.rect.width - canvas.width) <= 1 &&
        Math.abs(preview.rect.height - canvas.height) <= 1,
      places: close(drawn.prefix, inner.prefix) && close(drawn.input, inner.input),
      drawn,
      dom: inner,
      paint: compare(a, b, outside, `${name}${DARK ? "-dark" : ""}`),
    };
  };
  const judge = async (kind) => {
    // (No selection chrome over either leg.)
    await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.selectRecords([]));
    await page.mouse.move(5, 995);
    parts = await prefixParts(page, prefixFields);
    for (const [i, p] of parts.entries()) {
      const k = cases[i];
      const leg = await partsLegs(p, `${kind}-${k.type}-${k.state}`);
      record(
        `L2-${kind === "text" ? 6 : 7} ${k.type} ${k.state} ${kind}: box Canvas = Preview (size ±1 · prefix · input places ±1 · box paint ≤ 0.001)`,
        leg.sizeMatch && leg.places && leg.paint.ratio <= 0.001,
        leg,
      );
    }
  };
  await judge("text");
  await setPrefixes(page, prefixFields, "icon");
  await judge("icon");

  // L2-8 — removing takes the prefix out (a wrapped Input is unwrapped).
  await setPrefixes(page, prefixFields, "none");
  parts = await prefixParts(page, prefixFields);
  const unwrapped = await page.evaluate((parts) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    return parts.map((p) => root.typeOf(root.canvasInputs.get(root.canvasInputs.get(p.input).parentId)));
  }, parts);
  record(
    "L2-8 None removes every prefix (TextField · TextArea · ColorField unwrapped)",
    parts.every((p) => !p.prefix) &&
      unwrapped.every((t, i) =>
        ["NumberField", "ComboBox"].includes(cases[i].type) ? t === "Group" : t === cases[i].type,
      ),
    unwrapped,
  );

  record("L2-9 page errors 0", errors.length === 0, errors.slice(0, 5));
  await browser.close();
}

if (PHASE === "2") await phase2();
if (PHASE === "1") {
  await phase1();
  if (!DARK) await phase1WebKit().catch((e) => record("L1-10 WebKit", false, String(e)));
}
writeFileSync(`${OUT}/results-phase${PHASE}${DARK ? "-dark" : ""}.json`, JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.pass);
process.stdout.write(`\n${results.length - failed.length}/${results.length} PASS\n`);
process.exit(failed.length ? 1 : 0);
