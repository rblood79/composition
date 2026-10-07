// ADR-256 Phase 3b live: a Switch is RAC `SwitchField > SwitchButton (track + text)`, a Radio
// `RadioField > RadioButton (ring + text)`. A Switch and a RadioGroup are placed: the Preview draws the
// reference structure, the Canvas row matches the Preview row (track · ring · text positions), Space
// toggles the Switch and the second Radio (RAC state), a Switch description shows on both sides.
// Real Builder, headed Chrome.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p3b-switch-radio-live.mjs <out>
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
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1200)}\n`,
  );
};
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
async function addFromPalette(label) {
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page
      .getByRole("button", { name: "Components", exact: true })
      .first()
      .click();
  await search.fill(label);
  await page.waitForTimeout(300);
  await page
    .locator(".list-item", { hasText: new RegExp(`^${label}$`, "i") })
    .first()
    .click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
}
const frameDoc = () => page.frameLocator("#previewFrame");

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-256 P3b switch radio");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
await addFromPalette("switch");
await addFromPalette("radio group");
await page.waitForTimeout(800);
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const ids = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const of = (type) =>
    [...ws.root.canvasInputs.values()].find((r) => ws.root.typeOf(r) === type)
      .sourceId;
  return { switch: of("Switch"), group: of("RadioGroup") };
});
await page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first()
  .click();
await page.waitForTimeout(3000);
// One toggle (Switch, or the RadioGroup's first Radio) in the Preview.
const preview = (id, cls) =>
  page.evaluate(
    ({ id, cls }) => {
      const doc = document.querySelector("#previewFrame")?.contentDocument;
      const owner = [
        ...(doc?.querySelectorAll("[data-catalog-id]") ?? []),
      ].find((e) => e.getAttribute("data-catalog-id").endsWith(`::${id}`));
      const root = owner?.classList.contains(cls)
        ? owner
        : owner?.querySelector(`.${cls}`);
      if (!root) return null;
      const button = root.querySelector(":scope > label");
      const rect = (e) => {
        const r = e?.getBoundingClientRect();
        return r
          ? [
              Math.round(r.x),
              Math.round(r.y),
              Math.round(r.width),
              Math.round(r.height),
            ]
          : null;
      };
      return {
        tag: root.tagName.toLowerCase(),
        button: button?.className ?? null,
        indicator: !!button?.querySelector(":scope > div.indicator"),
        text:
          button?.querySelector(":scope > span.react-aria-Label")
            ?.textContent ?? null,
        hint: root.querySelector('[slot="description"]')?.textContent ?? null,
        rects: {
          root: rect(root),
          indicator: rect(button?.querySelector("div.indicator")),
          text: rect(button?.querySelector("span.react-aria-Label")),
        },
        ring: button
          ? getComputedStyle(button.querySelector("div.indicator"))
              .borderTopWidth
          : null,
      };
    },
    { id, cls },
  );
const canvas = (id, type) =>
  page.evaluate(
    ({ id, type }) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const root = ws.root;
      const owner = [...root.canvasInputs.values()].find(
        (r) => r.sourceId === id,
      );
      const find = (r) => {
        if (root.typeOf(r) === type) return r;
        for (const c of r.children) {
          const x = root.canvasInputs.get(c);
          const f = x && find(x);
          if (f) return f;
        }
      };
      const top = find(owner);
      const all = [];
      const visit = (r, d) => {
        for (const c of r.children) {
          const child = root.canvasInputs.get(c);
          if (!child) continue;
          all.push({
            id: child.id,
            type: root.typeOf(child),
            depth: d,
            hidden: !!child.hidden,
          });
          visit(child, d + 1);
        }
      };
      visit(top, 1);
      const abs = (rid) => {
        let x = 0,
          y = 0,
          cur = root.canvasInputs.get(rid);
        while (cur && cur.id !== top.id) {
          const g = root.getGeometry([cur.id]).get(cur.id);
          x += g.x;
          y += g.y;
          cur = root.canvasInputs.get(cur.parentId);
        }
        return [Math.round(x), Math.round(y)];
      };
      const ind = all.find((n) => n.type.endsWith("Indicator"));
      const label = all.find((n) => n.type === "Label");
      return {
        tree: all.map(
          (n) =>
            `${"  ".repeat(n.depth)}${n.type}${n.hidden ? " (hidden)" : ""}`,
        ),
        indicator: abs(ind.id),
        text: abs(label.id),
      };
    },
    { id, type },
  );
const rel = (p, k) => [
  p.rects[k][0] - p.rects.root[0],
  p.rects[k][1] - p.rects.root[1],
];
const near = (c, p) =>
  ["indicator", "text"].every((k) =>
    c[k].every((v, i) => Math.abs(v - rel(p, k)[i]) <= 1),
  );
const sw = await preview(ids.switch, "react-aria-Switch");
const swc = await canvas(ids.switch, "Switch");
record(
  "P3b-1 Switch: div field > label.SwitchButton > (div.indicator track, text); Canvas row = Preview (±1px)",
  !!sw &&
    sw.tag === "div" &&
    /SwitchButton/.test(sw.button) &&
    sw.indicator &&
    sw.text === "Switch" &&
    swc.tree
      .join("|")
      .includes("  SwitchButton|    SwitchIndicator|    Label") &&
    near(swc, sw),
  { preview: sw, canvas: swc },
);
const ra = await preview(ids.group, "react-aria-Radio");
const rac = await canvas(ids.group, "Radio");
record(
  "P3b-2 Radio: div field > label.RadioButton > (div.indicator ring, text); ring = selected 6px border; Canvas row = Preview (±1px)",
  !!ra &&
    ra.tag === "div" &&
    /RadioButton/.test(ra.button) &&
    ra.indicator &&
    ra.text === "Option 1" &&
    ra.ring === "6px" &&
    rac.tree.join("|").includes("  RadioButton|    RadioIndicator|    Label") &&
    near(rac, ra),
  { preview: ra, canvas: rac },
);
// Space toggles the Switch; Space on the second Radio selects it (RAC state).
await frameDoc()
  .locator(`div.react-aria-Switch[data-catalog-id$="::${ids.switch}"] input`)
  .press("Space");
await frameDoc()
  .locator(`[data-catalog-id$="::${ids.group}"] div.react-aria-Radio input`)
  .nth(1)
  .focus();
await page.keyboard.press("Space");
await page.waitForTimeout(500);
const toggled = await page.evaluate(
  ({ s, g }) => {
    const doc = document.querySelector("#previewFrame").contentDocument;
    const sw = [...doc.querySelectorAll("[data-catalog-id]")].find((e) =>
      e.getAttribute("data-catalog-id").endsWith(`::${s}`),
    );
    const group = [...doc.querySelectorAll("[data-catalog-id]")].find((e) =>
      e.getAttribute("data-catalog-id").endsWith(`::${g}`),
    );
    return {
      switchChecked: sw.querySelector("input").checked,
      radios: [...group.querySelectorAll("input[type=radio]")].map(
        (i) => i.checked,
      ),
    };
  },
  { s: ids.switch, g: ids.group },
);
record(
  "P3b-3 Space toggles the Switch off and selects the second Radio (RAC state)",
  toggled.switchChecked === false &&
    JSON.stringify(toggled.radios) === "[false,true]",
  toggled,
);
await page.evaluate(
  async ({ commands, id }) => {
    const { setFields } = await import(commands);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.execute(
      setFields({
        targets: [{ kind: "node", id }],
        props: { description: { kind: "set", value: "Connect automatically" } },
      }),
    );
  },
  { commands, id: ids.switch },
);
await page.waitForTimeout(1500);
const sw2 = await preview(ids.switch, "react-aria-Switch");
const swc2 = await canvas(ids.switch, "Switch");
record(
  "P3b-4 a Switch description shows in the Preview and on the Canvas",
  sw2?.hint === "Connect automatically" &&
    swc2.tree.some((t) => t.trim() === "Description"),
  { preview: sw2?.hint, canvas: swc2.tree },
);
await page.mouse.click(265, 77);
await page.waitForTimeout(300);
await page.keyboard.down("Control");
for (let i = 0; i < 10; i += 1) {
  await page.mouse.move(846, 312);
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(80);
}
await page.keyboard.up("Control");
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/switch-radio-compare.png` });
record("P3b-5 no page errors", errors.length === 0, { errors });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
