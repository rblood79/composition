// Tag selection live (사용자 2026-10-09 「tags 레퍼런스 확인해봐 Variant 옵션이 별도로 존재하지는 않는듯」
// → 「선택으로 대체」) — real Builder (headed Chrome, Compare Mode): a Tag's Design panel offers
// Selected (no Variant); turning it on selects the Tag on the Canvas (the rule's selected paint) and in
// the Preview (RAC `aria-selected` · accent chip); a TagGroup that does not select (`selectionMode`
// none) shows no selected Tag on either; after a reload the selection stays · no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/tag-group-selection-live.mjs <out>
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
await page.keyboard.type("Tag group selection");
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
const view = () =>
  page.evaluate(async (repo) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const { catalogStateValue } = await import(
      `/@fs${repo}/packages/shared/src/catalog/runtime/presence.ts`
    );
    const tags = [...root.canvasInputs.values()].filter(
      (r) => root.typeOf(r) === "Tag",
    );
    const doc = document.querySelector("#previewFrame").contentDocument;
    const probe = doc.createElement("div");
    probe.style.backgroundColor = "var(--accent)";
    doc.body.append(probe);
    const accent = doc.defaultView.getComputedStyle(probe).backgroundColor;
    probe.remove();
    return {
      accent,
      tags: tags.map((t) => {
        const el = doc.querySelector(`[data-catalog-id="${t.id}"]`);
        return {
          authored: t.props.isSelected === true,
          canvas: catalogStateValue(
            t,
            "isSelected",
            (id) => root.canvasInputs.get(id),
            (r) => root.typeOf(r),
          ),
          preview: el?.getAttribute("aria-selected") === "true",
          accentChip:
            !!el &&
            doc.defaultView.getComputedStyle(el).backgroundColor === accent,
          chipText: el && doc.defaultView.getComputedStyle(el).color,
          labelText:
            el &&
            doc.defaultView.getComputedStyle(
              el.querySelector(".react-aria-Text"),
            ).color,
          glyph: el?.querySelector('[slot="remove"] svg')
            ? doc.defaultView.getComputedStyle(
                el.querySelector('[slot="remove"] svg'),
              ).color
            : null,
        };
      }),
    };
  }, REPO);
const before = await view();
// the Design panel of the first Tag: Selected, no Variant
await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const t = [...ws.root.canvasInputs.values()].find(
    (r) => ws.root.typeOf(r) === "Tag",
  );
  ws.session.select([
    { identity: t.id, target: ws.positionOfRecord(t.id).target },
  ]);
});
await page
  .getByRole("button", { name: /^Design/ })
  .first()
  .click()
  .catch(() => {});
await page.waitForTimeout(1200);
const panel = await page.evaluate(() => {
  const labels = [...document.querySelectorAll("label, legend, span")]
    .map((e) => e.textContent?.trim())
    .filter(Boolean);
  return {
    selected: labels.includes("Selected"),
    variant: labels.includes("Variant"),
  };
});
record(
  "the Tag's Design panel offers Selected and no Variant",
  panel.selected && !panel.variant,
  panel,
);
const control = page
  .getByRole("button", { name: "Selected", exact: true })
  .first();
await control.click();
await page.waitForTimeout(1000);
const on = await view();
record(
  "Selected on: the Tag is selected on the Canvas and in the Preview (accent chip), the others not",
  before.tags.every((t) => !t.canvas && !t.preview) &&
    on.tags[0].authored &&
    on.tags[0].canvas &&
    on.tags[0].preview &&
    on.tags[0].accentChip &&
    on.tags.slice(1).every((t) => !t.canvas && !t.preview && !t.accentChip),
  { before: before.tags, on: on.tags },
);
await page.screenshot({ path: `${OUT}/tag-selected.png` });
// Preview presses (RAC's run selection): the label and the remove X take the chip's colour —
// deselecting the authored Tag returns its text to the default, selecting another whitens it
await exec((c, ws) => {
  const g = [...ws.root.canvasInputs.values()].find(
    (r) => ws.root.typeOf(r) === "TagGroup",
  );
  return c.setFields({
    targets: [ws.positionOfRecord(g.id).target],
    props: { allowsRemoving: { kind: "set", value: true } },
  });
});
const pressRow = async (index) => {
  await page
    .frameLocator("#previewFrame")
    .locator('.react-aria-TagList [role="row"]')
    .nth(index)
    .dispatchEvent("click");
  await page.waitForTimeout(600);
};
await pressRow(0);
await pressRow(1);
const pressed = await view();
const follows = (t) =>
  t.labelText === t.chipText && (t.glyph === null || t.glyph === t.chipText);
record(
  "Preview presses: the authored Tag deselects, another selects — each label and X takes its chip's colour",
  !pressed.tags[0].preview &&
    !pressed.tags[0].accentChip &&
    pressed.tags[1].preview &&
    pressed.tags[1].accentChip &&
    pressed.tags.every(follows) &&
    pressed.tags[0].labelText !== pressed.tags[1].labelText,
  pressed.tags,
);
await page.screenshot({ path: `${OUT}/tag-pressed.png` });
const setGroup = (value) =>
  exec((c, ws, arg) => {
    const g = [...ws.root.canvasInputs.values()].find(
      (r) => ws.root.typeOf(r) === "TagGroup",
    );
    return c.setFields({
      targets: [ws.positionOfRecord(g.id).target],
      props: { selectionMode: { kind: "set", value: arg } },
    });
  }, value);
await setGroup("none");
const none = await view();
record(
  "a TagGroup that does not select shows no selected Tag (Canvas · Preview)",
  none.tags.every((t) => !t.canvas && !t.preview && !t.accentChip) &&
    none.tags[0].authored,
  none.tags,
);
await setGroup("multiple");
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
const reloaded = await view();
record(
  "reload: the Tag stays selected (Canvas · Preview)",
  reloaded.tags[0].canvas &&
    reloaded.tags[0].preview &&
    reloaded.tags[0].accentChip,
  reloaded.tags,
);
record("no errors", errors.length === 0, { errors: errors.slice(0, 6) });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors, url: page.url() }, null, 2),
);
await browser.close();
