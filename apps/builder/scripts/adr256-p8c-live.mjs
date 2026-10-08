// ADR-256 Phase 8c live — a Disclosure draws its node tree (the reference `Heading > Button[slot=trigger]
// > (chevron + title)` + `DisclosurePanel`), in the real Builder (headed Chrome, Compare Mode opens the
// Preview): L-1 Canvas tree · L-2 Preview DOM = RAC trigger in the sheet's box, glyph turned · L-3 Canvas
// = Preview trigger geometry · L-4 Preview press collapses · L-5 size + title reach both · L-6 collapsed
// in the document hides the Canvas panel · L-7 DisclosureGroup sections · L-8 reopened · L-9 no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p8c-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const page = await context.newPage();
const errors = [];
const errorsAt = [];
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1500)}\n`,
  );
};
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
async function addFromPalette(label, match = new RegExp(`^${label}$`, "i")) {
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page
      .getByRole("button", { name: "Components", exact: true })
      .first()
      .click();
  await search.fill(label);
  await page.waitForTimeout(300);
  await page
    .locator(".list-item", { hasText: match })
    .first()
    .click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
  // (Close the Components panel: it covers the Preview half in Compare Mode.)
  await page
    .getByRole("button", { name: "Components", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
}
async function compareOn() {
  const button = page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first();
  if (await button.isVisible().catch(() => false)) await button.click();
  await page.waitForTimeout(3000);
}

const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
async function newProject(name) {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
}
/** Run a catalog command in the page: `build(c, ws, find, arg)` returns the command. */
async function run(build, arg) {
  return page.evaluate(
    async ({ commands, build, arg }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      // `find(type, within)` — the first record of `type` (inside the first `within` record).
      const find = (type, within) => {
        const all = [...ws.root.canvasInputs.values()];
        const scope = within
          ? all.find((r) => ws.root.typeOf(r) === within)
          : undefined;
        const inScope = (r) => {
          if (!scope) return true;
          for (let c = r; c; c = ws.root.canvasInputs.get(c.parentId))
            if (c.id === scope.id) return true;
          return false;
        };
        return all.find((r) => ws.root.typeOf(r) === type && inScope(r));
      };
      try {
        ws.execute(
          new Function(
            "c",
            "ws",
            "find",
            "arg",
            `return (${build})(c, ws, find, arg);`,
          )(c, ws, find, arg),
        );
        await new Promise((r) => setTimeout(r, 500));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, build: build.toString(), arg },
  );
}
const preview = (fn, arg) =>
  page.evaluate(
    ({ fn, arg }) => {
      const doc = document.querySelector("#previewFrame")?.contentDocument;
      return new Function("doc", "arg", `return (${fn})(doc, arg);`)(doc, arg);
    },
    { fn: fn.toString(), arg },
  );
const press = async (selector) => {
  await page
    .frameLocator("#previewFrame")
    .locator(selector)
    .first()
    // (Compare Mode shrinks the Preview under the Builder header — RAC's virtual press.)
    .dispatchEvent("click");
  await page.waitForTimeout(800);
};
const closeOverlay = async () => {
  await page.frameLocator("#previewFrame").locator("body").press("Escape");
  await page.waitForTimeout(500);
};



const canvasProbe = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const all = [...root.canvasInputs.values()];
    const shape = (r) => [root.typeOf(r), ...r.children.map((id) => shape(root.canvasInputs.get(id)))];
    const disclosures = all.filter((r) => root.typeOf(r) === "Disclosure");
    return disclosures.map((d) => {
      const heading = root.canvasInputs.get(d.children[0]);
      const trigger = heading && root.canvasInputs.get(heading.children[0]);
      const [icon, title] = (trigger?.children ?? []).map((id) => root.canvasInputs.get(id));
      const panel = all.find((r) => r.parentId === d.id && root.typeOf(r) === "DisclosurePanel");
      const content = panel && root.canvasInputs.get(panel.children[0]);
      const g = root.getGeometry([trigger?.id, icon?.id, title?.id, content?.id].filter(Boolean));
      const box = (r) => r && g.get(r.id) && [g.get(r.id).x, g.get(r.id).y, Math.round(g.get(r.id).width * 10) / 10, Math.round(g.get(r.id).height * 10) / 10];
      return {
        shape: shape(d),
        title: title?.props.children,
        titleFont: title?.visual.fontSize,
        content: content?.props.children,
        contentFont: content?.visual.fontSize,
        panelHidden: panel?.hidden === true,
        iconName: icon?.derivedProps?.iconName ?? icon?.props.iconName,
        trigger: box(trigger),
        icon: box(icon),
        titleBox: box(title),
        contentBox: box(content),
      };
    });
  });
const domProbe = () =>
  preview((doc) =>
    [...doc.querySelectorAll(".react-aria-Disclosure")].map((d) => {
      const heading = d.querySelector(":scope > .react-aria-Heading");
      const trigger = heading?.querySelector(":scope > button[slot='trigger']");
      const icon = trigger?.querySelector(":scope > .react-aria-Icon");
      const svg = icon?.querySelector("svg");
      const title = trigger?.querySelector(":scope > .react-aria-Text");
      const panel = d.querySelector(":scope > .react-aria-DisclosurePanel");
      const content = panel?.querySelector(":scope > div > .react-aria-Text");
      const cs = (el) => el && getComputedStyle(el);
      const rect = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const t = trigger.getBoundingClientRect();
        return [Math.round((r.x - t.x) * 10) / 10, Math.round((r.y - t.y) * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10];
      };
      return {
        expanded: d.hasAttribute("data-expanded"),
        headingTag: heading?.tagName,
        triggerClass: trigger?.className,
        triggerInline: trigger?.getAttribute("style") ?? "",
        padding: cs(trigger)?.padding,
        weight: cs(trigger)?.fontWeight,
        background: cs(trigger)?.backgroundColor,
        triggerFont: cs(trigger)?.fontSize,
        rotate: svg ? cs(svg).rotate : null,
        title: title?.textContent,
        titleFont: cs(title)?.fontSize,
        panelPadding: panel ? cs(panel.firstElementChild).padding : null,
        content: content?.textContent,
        contentFont: cs(content)?.fontSize,
        trigger: rect(trigger),
        icon: rect(icon),
        titleBox: rect(title),
      };
    }),
  );
const edit = (props) =>
  page.evaluate(async ({ commands, props }) => {
    const c = await import(commands);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const d = [...ws.root.canvasInputs.values()].find((r) => ws.root.typeOf(r) === "Disclosure");
    try {
      ws.execute(
        c.setFields({
          targets: [ws.positionOfRecord(d.id).target],
          props: Object.fromEntries(Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }])),
        }),
      );
      await new Promise((r) => setTimeout(r, 800));
      return { ok: true };
    } catch (error) {
      return { ok: false, code: error?.code ?? String(error) };
    }
  }, { commands, props });
const near = (a, b, tol = 1) => Array.isArray(a) && Array.isArray(b) && a.every((v, i) => Math.abs(v - b[i]) <= tol);

await newProject(`adr256-p8c-${Date.now()}`);
await compareOn();
await addFromPalette("Disclosure");
await page.waitForTimeout(1200);

// L-1: the placed Disclosure is the reference's node tree; the panel shows (expanded), the chevron turned.
const c1 = (await canvasProbe())[0];
record(
  "L-1 Canvas: Disclosure > Heading > Button > (Icon + Text) + DisclosurePanel > Text · expanded",
  JSON.stringify(c1?.shape) ===
    JSON.stringify(["Disclosure", ["Heading", ["Button", ["Icon"], ["Text"]]], ["DisclosurePanel", ["Text"]]]) &&
    c1.title === "Section Title" && !c1.panelHidden && c1.iconName === "chevron-down",
  c1,
);
errorsAt.push(["L-1", errors.length]);

// L-2: the Preview DOM is RAC's — h3 > button[slot=trigger] (no .button-base, no inline box) > Icon + Text;
// the sheet gives its box (padding 8 12, 600, transparent) and turns the glyph; the panel div padding 8 16.
const d2 = (await domProbe())[0];
record(
  "L-2 Preview: h3 > RAC trigger (sheet box · 600 · transparent) > glyph turned 90deg + title · panel padding 8 16",
  d2?.expanded && d2.headingTag === "H3" && !/button-base/.test(d2.triggerClass) &&
    !/background|padding|gap/.test(d2.triggerInline) && d2.padding === "8px 12px" &&
    d2.weight === "600" && d2.background === "rgba(0, 0, 0, 0)" && d2.rotate === "90deg" &&
    d2.title === "Section Title" && d2.panelPadding === "8px 16px" && d2.contentFont === d2.triggerFont,
  d2,
);
errorsAt.push(["L-2", errors.length]);

// L-3: Canvas = Preview geometry in the trigger (chevron x 12 · 18px, title x 34, trigger height).
record(
  "L-3 Canvas = Preview: trigger height · chevron box · title x",
  near([c1.trigger[3]], [d2.trigger[3]]) && near(c1.icon.slice(0, 1).concat(c1.icon.slice(2)), d2.icon.slice(0, 1).concat(d2.icon.slice(2))) &&
    Math.abs(c1.titleBox[0] - d2.titleBox[0]) <= 1,
  { canvas: { trigger: c1.trigger, icon: c1.icon, title: c1.titleBox }, dom: { trigger: d2.trigger, icon: d2.icon, title: d2.titleBox } },
);
errorsAt.push(["L-3", errors.length]);

// L-4: the Preview's trigger collapses it (RAC); the glyph turns back.
await press(".react-aria-Disclosure button[slot='trigger']");
const d4 = (await domProbe())[0];
record("L-4 Preview trigger press → collapsed · glyph 0deg", d4 && !d4.expanded && d4.rotate === "0deg", d4 && { expanded: d4.expanded, rotate: d4.rotate });
errorsAt.push(["L-4", errors.length]);

// L-5: size lg and a new title reach both consumers (the trigger font, the panel font, the title text).
const r5 = await edit({ size: "lg", title: "Specs", isExpanded: true });
await page.waitForTimeout(1200);
const c5 = (await canvasProbe())[0];
const d5 = (await domProbe())[0];
record(
  "L-5 size lg + title: Canvas title 16 · content 16 · Preview trigger 16px · content 16px · 「Specs」",
  r5.ok && c5.title === "Specs" && c5.titleFont === 16 && c5.contentFont === 16 &&
    d5.title === "Specs" && d5.titleFont === "16px" && d5.contentFont === "16px",
  { r5, canvas: { title: c5.title, titleFont: c5.titleFont, contentFont: c5.contentFont }, dom: { title: d5.title, titleFont: d5.titleFont, contentFont: d5.contentFont } },
);
errorsAt.push(["L-5", errors.length]);

// L-6: collapsed in the document → the Canvas panel hides and the glyph is unturned.
const r6 = await edit({ isExpanded: false });
const c6 = (await canvasProbe())[0];
record("L-6 isExpanded false → Canvas panel hidden · chevron-right", r6.ok && c6.panelHidden && c6.iconName === "chevron-right", { r6, panelHidden: c6.panelHidden, iconName: c6.iconName });
errorsAt.push(["L-6", errors.length]);

// L-7: a DisclosureGroup's sections keep their own titles and contents (both consumers).
await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.selectRecords([]));
await addFromPalette("Disclosure", /^Disclosure ?Group$/i);
await page.waitForTimeout(1500);
const c7 = (await canvasProbe()).slice(1);
const d7 = (await domProbe()).slice(1);
record(
  "L-7 DisclosureGroup: Section 1/2 · Content 1/2 on Canvas and Preview",
  c7.map((x) => x.title).join() === "Section 1,Section 2" && c7.map((x) => x.content).join() === "Content 1,Content 2" &&
    d7.map((x) => x.title).join() === "Section 1,Section 2",
  { canvas: c7.map((x) => [x.title, x.content]), dom: d7.map((x) => [x.title, x.content, x.expanded]) },
);
errorsAt.push(["L-7", errors.length]);

// L-8: saved and reopened the same.
await page.waitForTimeout(1500);
const projectUrl = page.url();
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await page.waitForTimeout(2500);
const c8 = await canvasProbe();
record(
  "L-8 saved and reopened: 「Specs」 collapsed lg · the group's sections",
  page.url() === projectUrl && c8[0]?.title === "Specs" && c8[0].panelHidden && c8[0].titleFont === 16 &&
    c8.slice(1).map((x) => x.title).join() === "Section 1,Section 2",
  c8.map((x) => [x.title, x.panelHidden, x.titleFont]),
);
record("L-9 no page errors", errors.length === 0, { errorsAt, errors: errors.slice(0, 3) });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
