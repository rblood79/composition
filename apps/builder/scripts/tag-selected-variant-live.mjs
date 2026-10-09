// Tag variant selected live (사용자 2026-10-09 「tagGroup 내의 tag 에 variant 를 selected 로 했을때
// compare-css 에는 배경색이 변경되지 않고」) — real Builder (headed Chrome, Compare Mode): a Tag set to
// `variant="selected"` in a TagGroup with removable tags draws the rule's selected chip in the
// Preview (accent fill and border, on-accent label and remove X), its default siblings stay
// default · after a reload the same · no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/tag-selected-variant-live.mjs <out>
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
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1500)}\n`,
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
const exec = (build, arg) =>
  page.evaluate(
    async ({ commands, build, arg }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      try {
        ws.execute(
          new Function("c", "ws", "arg", `return (${build})(c, ws, arg);`)(
            c,
            ws,
            arg,
          ),
        );
        await new Promise((r) => setTimeout(r, 800));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, build: build.toString(), arg },
  );

await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i });
await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Tag selected variant");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
await addFromPalette("tag group");
await compareOn();
await exec((c, ws) => {
  const g = [...ws.root.canvasInputs.values()].find(
    (r) => ws.root.typeOf(r) === "TagGroup",
  );
  return c.setFields({
    targets: [ws.positionOfRecord(g.id).target],
    props: { allowsRemoving: { kind: "set", value: true } },
  });
});
await exec((c, ws) => {
  const t = [...ws.root.canvasInputs.values()].find(
    (r) => ws.root.typeOf(r) === "Tag",
  );
  return c.setFields({
    targets: [ws.positionOfRecord(t.id).target],
    props: { variant: { kind: "set", value: "selected" } },
  });
});
await page.waitForTimeout(800);
const out = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const tags = [...ws.root.canvasInputs.values()].filter(
    (r) => ws.root.typeOf(r) === "Tag",
  );
  const doc = document.querySelector("#previewFrame").contentDocument;
  return tags.slice(0, 2).map((t) => {
    const el = doc.querySelector(`[data-catalog-id="${t.id}"]`);
    const cs = doc.defaultView.getComputedStyle(el);
    const label = [...el.children].find(
      (c) => c.textContent && !c.matches("button, .react-aria-Button"),
    );
    const remove = el.querySelector('[slot="remove"]');
    const svg = remove?.querySelector("svg");
    return {
      variant: t.props.variant,
      bg: cs.backgroundColor,
      text: cs.color,
      border: cs.borderTopColor,
      label: label && {
        tag: label.tagName,
        color: doc.defaultView.getComputedStyle(label).color,
        style: label.getAttribute("style"),
      },
      remove: remove && {
        color: doc.defaultView.getComputedStyle(remove).color,
        svgColor: svg && doc.defaultView.getComputedStyle(svg).color,
      },
      rect: (() => {
        const r = el.getBoundingClientRect();
        return {
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      })(),
    };
  });
});
const accent = await page.evaluate(() => {
  const doc = document.querySelector("#previewFrame").contentDocument;
  const probe = doc.createElement("div");
  probe.style.backgroundColor = "var(--accent)";
  doc.body.append(probe);
  const value = doc.defaultView.getComputedStyle(probe).backgroundColor;
  probe.remove();
  return value;
});
const [chosen, plain] = out;
record(
  "the selected Tag draws the accent chip with an on-accent label and X (Preview)",
  chosen.variant === "selected" &&
    chosen.bg === accent &&
    chosen.border === accent &&
    chosen.text === "rgb(255, 255, 255)" &&
    chosen.label?.color === "rgb(255, 255, 255)" &&
    chosen.remove?.svgColor === "rgb(255, 255, 255)",
  { accent, chosen },
);
record(
  "its default sibling stays the default chip",
  plain.variant === "default" && plain.bg !== accent,
  plain,
);
await page.screenshot({ path: `${OUT}/tag-selected.png` });
await page.waitForTimeout(1500);
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(2500);
await compareOn();
const reloaded = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const t = [...ws.root.canvasInputs.values()].find(
    (r) => ws.root.typeOf(r) === "Tag",
  );
  const doc = document.querySelector("#previewFrame").contentDocument;
  const el = doc.querySelector(`[data-catalog-id="${t.id}"]`);
  return {
    variant: t.props.variant,
    bg: doc.defaultView.getComputedStyle(el).backgroundColor,
  };
});
record(
  "reload: the same",
  reloaded.variant === "selected" && reloaded.bg === accent,
  reloaded,
);
record("no errors", errors.length === 0, { errors: errors.slice(0, 6) });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors, url: page.url() }, null, 2),
);
await browser.close();
