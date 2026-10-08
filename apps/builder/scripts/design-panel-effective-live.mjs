// Design 패널 표시값 = 선택 record 의 실효값 (2026-10-09) — in the real Builder (headed Chrome):
//   L-1 Checkbox > CheckboxButton: Layout tab Direction = Row · Gap 8 (the parent rule's
//       `.react-aria-CheckboxButton` block, not Block · 0)
//   L-2 TextField root: Layout tab Padding 0 on every side (the Input's size padding 12 is not the root's)
//   L-3 Checkbox size xl → its Label: Text tab Font Size 18 (parent size propagation, not the Label rule's 14)
//   L-5 multi-select CheckboxButton + Frame → Direction Column: the button keeps inline-flex (no display
//       written), the Frame gets display flex (each target judged on its own — Codex review 2026-10-09)
//   L-4 no page / console errors
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/design-panel-effective-live.mjs <out>
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
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});

await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await page.waitForTimeout(300);
await page.keyboard.type(`design-effective-${Date.now()}`);
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
  timeout: 30000,
});

const addFromPalette = async (query, name) => {
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page.getByRole("button", { name: "Components", exact: true }).first().click();
  await search.fill(query);
  await page.waitForTimeout(300);
  await page.locator(".list-item", { hasText: name }).first().click();
  await page.waitForTimeout(800);
};
await addFromPalette("checkbox", /^checkbox$/i);
await addFromPalette("textfield", /^text ?field$/i);
await page.getByRole("button", { name: "Components", exact: true }).first().click();
await page.waitForTimeout(500);
if (!(await page.getByRole("tab", { name: "Layout", exact: true }).isVisible().catch(() => false)))
  await page.getByRole("button", { name: /^design/i }).last().click();
await page.waitForTimeout(600);

/** Records by type (the drawn tree), as the Canvas sees them. */
const recordsOf = (type, under) =>
  page.evaluate(
    ({ type, under }) => {
      const root = window.__COMPOSITION_CATALOG__.workspace.root;
      const all = [...root.canvasInputs.values()];
      const typeOf = (r) => root.typeOf(r);
      const underId = under ? all.find((r) => typeOf(r) === under)?.id : undefined;
      const isUnder = (r) => {
        for (let p = r; p; p = root.canvasInputs.get(p.parentId))
          if (p.id === underId) return true;
        return false;
      };
      return all
        .filter((r) => typeOf(r) === type && (!underId || isUnder(r)))
        .map((r) => r.id);
    },
    { type, under },
  );
const select = async (id) => {
  await page.evaluate(
    (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
    id,
  );
  await page.waitForTimeout(500);
};
const tab = async (name) => {
  await page.getByRole("tab", { name, exact: true }).click();
  await page.waitForTimeout(500);
};
const inputValue = (label) =>
  page
    .locator(`input[aria-label="${label}"]`)
    .first()
    .inputValue()
    .catch(() => null);
const pressed = (groupLabel) =>
  page.evaluate((groupLabel) => {
    const group = document.querySelector(`[aria-label="${groupLabel}"]`);
    if (!group) return null;
    return [...group.querySelectorAll("button, [role=radio]")]
      .filter(
        (b) =>
          b.getAttribute("aria-pressed") === "true" ||
          b.getAttribute("aria-checked") === "true" ||
          b.dataset.selected === "true",
      )
      .map((b) => b.getAttribute("aria-label") ?? b.textContent?.trim());
  }, groupLabel);
const paddings = () =>
  page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('input[aria-label^="Padding"]')].map((i) => [
        i.getAttribute("aria-label"),
        i.value,
      ]),
    ),
  );

// L-1 CheckboxButton
const [checkboxButton] = await recordsOf("CheckboxButton");
await select(checkboxButton);
await tab("Layout");
await page.screenshot({ path: `${OUT}/1-checkboxbutton-layout.png` });
const l1 = { direction: await pressed("Flex direction"), gap: await inputValue("Gap") };
record(
  "L-1 CheckboxButton Layout = Row · Gap 8",
  l1.direction?.some((d) => /row/i.test(d ?? "")) && /^8(px)?$/.test(l1.gap ?? ""),
  l1,
);

// L-2 TextField root
const [textField] = await recordsOf("TextField");
await select(textField);
await tab("Layout");
await page.screenshot({ path: `${OUT}/2-textfield-layout.png` });
const l2 = await paddings();
const sides = Object.values(l2);
record(
  "L-2 TextField root Padding 0 (4 sides)",
  sides.length >= 4 && sides.every((v) => /^0(px)?$/.test(v)),
  l2,
);

// L-3 Checkbox size xl → Label 18px
let l3 = { status: "UNVERIFIED" };
try {
  const [checkbox] = await recordsOf("Checkbox");
  await select(checkbox);
  await tab("Property");
  await page.screenshot({ path: `${OUT}/3a-checkbox-property.png` });
  // The Size field: a RAC Select (`aria-label="Size"` on the select) or a toggle group.
  const sizeSelect = page.locator('.react-aria-Select[aria-label="Size"] button').first();
  const sizeGroup = page.locator('[aria-label="Size"]').first();
  if (await sizeSelect.isVisible().catch(() => false)) {
    await sizeSelect.click();
    await page.waitForTimeout(300);
    await page.getByRole("option", { name: /^(xl|XL|Extra large)$/ }).first().click();
  } else if (await sizeGroup.isVisible().catch(() => false)) {
    await sizeGroup.locator("button, [role=radio]", { hasText: /^xl$/i }).first().click();
  } else {
    const labels = await page.evaluate(() =>
      [...document.querySelectorAll('.panel [aria-label], .panel legend')].map(
        (e) => e.getAttribute("aria-label") ?? e.textContent?.trim(),
      ),
    );
    throw new Error(`no Size control; labels=${JSON.stringify(labels).slice(0, 600)}`);
  }
  await page.waitForTimeout(800);
  const size = await page.evaluate(
    (id) => window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.get(id)?.props.size,
    checkbox,
  );
  const [label] = await recordsOf("Label", "Checkbox");
  await select(label);
  await tab("Text");
  await page.screenshot({ path: `${OUT}/3-xl-label-text.png` });
  l3 = {
    size,
    fontSize: await inputValue("Font Size"),
    lineHeight: await inputValue("Line Height"),
  };
  record(
    "L-3 Checkbox xl → Label Font Size 18 · Line Height 28",
    size === "xl" && /^18(px)?$/.test(l3.fontSize ?? "") && /^28(px)?$/.test(l3.lineHeight ?? ""),
    l3,
  );
} catch (e) {
  record("L-3 Checkbox xl → Label Font Size 18", false, { ...l3, error: String(e).slice(0, 300) });
}

// L-5 multi-select Direction
try {
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.selectRecords([]));
  await page.waitForTimeout(300);
  await addFromPalette("frame", /^frame$/i);
  await page.getByRole("button", { name: "Components", exact: true }).first().click();
  await page.waitForTimeout(400);
  const [frame] = await recordsOf("frame");
  const [button] = await recordsOf("CheckboxButton");
  await page.evaluate(
    (ids) => window.__COMPOSITION_CATALOG__.workspace.selectRecords(ids),
    [button, frame],
  );
  await page.waitForTimeout(500);
  if (!(await page.getByRole("tab", { name: "Layout", exact: true }).isVisible().catch(() => false)))
    await page.getByRole("button", { name: /^design/i }).last().click();
  await tab("Layout");
  await page
    .locator('[aria-label="Flex direction"]')
    .getByRole("radio", { name: "Column" })
    .or(page.locator('[aria-label="Flex direction"] [aria-label="Column"]'))
    .first()
    .click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/5-multi-direction.png` });
  const l5 = await page.evaluate((ids) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    return ids.map((id) => {
      const target = ws.itemOfRecord(id)?.target;
      const own = target ? ws.readModel.ownFields(target) : undefined;
      // Own fields hold write values (`{ kind: "set", value }`).
      const value = (field) => (field?.kind === "set" ? field.value : field);
      return {
        authoredDisplay: value(own?.layout?.display),
        authoredDirection: value(own?.layout?.flexDirection),
        drawnDisplay: ws.root.domInputs.get(id)?.layout.display,
      };
    });
  }, [button, frame]);
  record(
    "L-5 multi-select Direction Column — button inline-flex kept · Frame flex",
    l5[0].authoredDisplay === undefined &&
      l5[0].drawnDisplay === "inline-flex" &&
      l5[0].authoredDirection === "column" &&
      l5[1].authoredDisplay === "flex" &&
      l5[1].authoredDirection === "column",
    l5,
  );
} catch (e) {
  record("L-5 multi-select Direction", false, { error: String(e).slice(0, 300) });
}

record("L-4 no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
