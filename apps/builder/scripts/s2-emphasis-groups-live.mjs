// S2 그룹 강조 live (사용자 2026-10-10 「toggle 강조 축 전환」 Phase 2): real Builder (headed
// Chrome, Compare Mode). RadioGroup · CheckboxGroup 의 Emphasized 토글이 안의 toggle 들을
// 다시 해석해 (재해석 큐) Preview 의 선택 표시 색과 Canvas record 의 파생 variant 가 같이
// 바뀐다. Form 의 Emphasized 는 자기 값을 안 적은 field 에 채워진다 (S2 Form context).
// Radio 기본 고리는 S2 대로 중립이 됐다 (Changed — 종전 항상 accent).
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-emphasis-groups-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const paletteModule = `/@fs${REPO}/apps/builder/src/builder/catalogRuntime/paletteInsert.ts`;
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
  await page.evaluate(() => {
    window.__COMPOSITION_CATALOG__.workspace.selectRecords([]);
  });
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
  await page
    .getByRole("button", { name: "Components", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
}
const panelText = (label) =>
  page
    .locator(".panel-wrapper[data-panel='properties']")
    .getByText(label, { exact: true })
    .first();
const toggleBool = async (label) => {
  await panelText(label).click();
  await page.waitForTimeout(1500);
};
const openDesign = async (label) => {
  for (let i = 0; i < 3; i++) {
    if (await panelText(label).isVisible().catch(() => false)) return true;
    await page
      .getByRole("button", { name: "Design", exact: true })
      .first()
      .click();
    await page.waitForTimeout(1200);
  }
  return panelText(label).isVisible().catch(() => false);
};
const select = (kind) =>
  page.evaluate((kind) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()]
      .filter((r) => root.typeOf(r) === kind)
      .at(-1);
    ws.selectRecords([node.id]);
    return { id: node.id, source: node.sourceId };
  }, kind);
const setProps = (source, props) =>
  page.evaluate(
    async ({ commands, source, props }) => {
      const c = await import(commands);
      window.__COMPOSITION_CATALOG__.workspace.execute(
        c.setFields({
          targets: [{ kind: "node", id: source }],
          props: Object.fromEntries(
            Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
          ),
        }),
      );
      await new Promise((r) => setTimeout(r, 1000));
    },
    { commands, source, props },
  );
// 그룹 안 toggle 들의 Preview 표시 색 + Canvas record 파생 variant.
const groupState = (groupId, itemType, boxSelector) =>
  page.evaluate(
    ({ groupId, itemType, boxSelector }) => {
      const doc = document.querySelector("#previewFrame").contentDocument;
      const owner = doc.querySelector(`[data-catalog-id="${groupId}"]`);
      const dom = owner
        ? [...owner.querySelectorAll(boxSelector)].map((box) => ({
            emphasized: box
              .closest("[class*='react-aria-']")
              ?.closest(`.react-aria-${itemType}`)
              ? box
                  .closest(`.react-aria-${itemType}`)
                  .hasAttribute("data-emphasized")
              : null,
            color:
              itemType === "Radio"
                ? getComputedStyle(box).borderColor
                : getComputedStyle(box).backgroundColor,
          }))
        : null;
      const root = window.__COMPOSITION_CATALOG__.workspace.root;
      const variants = [...root.canvasInputs.values()]
        .filter((r) => root.typeOf(r) === itemType)
        .map((r) => ({
          variant: r.props.variant,
          isEmphasized: r.props.isEmphasized,
        }));
      return { dom, variants };
    },
    { groupId, itemType, boxSelector },
  );

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("S2 emphasis groups");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
const compare = page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await page.waitForTimeout(1500);

// ── RadioGroup: Emphasized 토글이 안의 Radio 들에 닿는다 (재해석 큐) ──
await addFromPalette("radio group");
const rg = await select("RadioGroup");
const radioSource = await page.evaluate(() => {
  const root = window.__COMPOSITION_CATALOG__.workspace.root;
  const radio = [...root.canvasInputs.values()].find(
    (r) => root.typeOf(r) === "Radio",
  );
  return radio.sourceId ?? radio.id;
});
const hasEmphasized = await openDesign("Emphasized");
record("Design offers Emphasized on a RadioGroup", hasEmphasized, { rg });
const rgBefore = await groupState(rg.id, "Radio", ".indicator");
record(
  "default RadioGroup: the Radios' derived variant is default (S2 — a neutral ring, not the old always-accent)",
  rgBefore.variants.length > 0 &&
    rgBefore.variants.every((v) => v.variant === "default"),
  rgBefore,
);
await select("RadioGroup");
await toggleBool("Emphasized");
const rgAfter = await groupState(rg.id, "Radio", ".indicator");
await page.screenshot({ path: `${OUT}/radiogroup-emphasized.png` });
record(
  "Emphasized RadioGroup: every Radio re-resolves to the emphasized variant (data-emphasized in the Preview)",
  rgAfter.variants.length > 0 &&
    rgAfter.variants.every(
      (v) => v.variant === "emphasized" && v.isEmphasized === true,
    ) &&
    rgAfter.dom.every((d) => d.emphasized === true),
  rgAfter,
);

// ── CheckboxGroup: 선택된 Checkbox 의 상자 색이 그룹 토글로 바뀐다 ──
await addFromPalette("checkbox group");
const cg = await select("CheckboxGroup");
const firstBox = await page.evaluate((groupId) => {
  const root = window.__COMPOSITION_CATALOG__.workspace.root;
  const walk = (ids) =>
    ids.flatMap((id) => {
      const child = root.canvasInputs.get(id);
      if (!child) return [];
      return root.typeOf(child) === "Checkbox"
        ? [child]
        : walk(child.children);
    });
  const box = walk(root.canvasInputs.get(groupId)?.children ?? [])[0];
  return box ? box.target : null;
}, cg.id);
if (firstBox)
  await page.evaluate(
    async ({ commands, target }) => {
      const c = await import(commands);
      window.__COMPOSITION_CATALOG__.workspace.execute(
        c.setFields({
          targets: [target],
          props: { isSelected: { kind: "set", value: true } },
        }),
      );
      await new Promise((r) => setTimeout(r, 1000));
    },
    { commands, target: firstBox },
  );
const cgBox = (groupId) =>
  page.evaluate((groupId) => {
    const doc = document.querySelector("#previewFrame").contentDocument;
    const owner = doc.querySelector(`[data-catalog-id="${groupId}"]`);
    // 선택 여부와 무관한 신호 — 시트의 `--selected-color` (emphasized 에서 accent) 를 읽는다.
    const item = owner?.querySelector(".react-aria-Checkbox");
    const selected = item;
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const walk = (ids) =>
      ids.flatMap((id) => {
        const child = root.canvasInputs.get(id);
        if (!child) return [];
        return root.typeOf(child) === "Checkbox" ? [child] : walk(child.children);
      });
    const variants = walk(
      root.canvasInputs.get(groupId)?.children ?? [],
    ).map((r) => r.props.variant);
    return {
      color: selected
        ? getComputedStyle(selected).getPropertyValue("--selected-color").trim()
        : null,
      variants,
    };
  }, groupId);
const cgBefore = await cgBox(cg.id);
await select("CheckboxGroup");
await openDesign("Emphasized");
await toggleBool("Emphasized");
const cgAfter = await cgBox(cg.id);
await page.screenshot({ path: `${OUT}/checkboxgroup-emphasized.png` });
record(
  "Emphasized CheckboxGroup: the selected box turns accent in the Preview and every Checkbox derives emphasized",
  cgBefore.color !== null &&
    cgAfter.color !== null &&
    cgAfter.color !== cgBefore.color &&
    cgBefore.variants.every((v) => v === "default") &&
    cgAfter.variants.every((v) => v === "emphasized"),
  { before: cgBefore, after: cgAfter },
);

// ── Form: Emphasized 가 자기 값을 안 적은 Checkbox 에 채워진다 (S2 Form context) ──
await addFromPalette("form");
const form = await select("Form");
const cbInForm = await page.evaluate(
  async ({ commands, paletteModule, formSource }) => {
    const c = await import(commands);
    const palette = await import(paletteModule);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const graph = ws.runtime.graph;
    const id = ws.newId("node");
    ws.execute(
      c.insertNodes({
        parent: { kind: "node", id: formSource },
        entries: [
          {
            kind: "node",
            id,
            definitionId: palette.catalogPaletteDefinitionId(
              graph.library,
              "Checkbox",
            ),
            children: [],
            props: { isSelected: { kind: "set", value: true } },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootIds: [id],
        newId: ws.newId,
        label: "Add element",
      }),
    );
    await new Promise((r) => setTimeout(r, 1000));
    return id;
  },
  { commands, paletteModule, formSource: form.source },
);
const formBoxState = (source) =>
  page.evaluate((source) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const box = [...root.canvasInputs.values()].find(
      (r) => r.sourceId === source,
    );
    return box
      ? { variant: box.props.variant, isEmphasized: box.props.isEmphasized }
      : null;
  }, source);
const formBefore = await formBoxState(cbInForm);
await select("Form");
await openDesign("Emphasized");
await toggleBool("Emphasized");
const formAfter = await formBoxState(cbInForm);
await page.screenshot({ path: `${OUT}/form-emphasized.png` });
record(
  "Form Emphasized fills the Checkbox inside (S2 useFormProps — it set no own value)",
  formBefore?.variant === "default" &&
    formAfter?.variant === "emphasized" &&
    formAfter?.isEmphasized === true,
  { before: formBefore, after: formAfter, cbInForm },
);

record("no page or console errors", errors.length === 0, { errors });
process.stdout.write(
  `\nRESULT ${results.filter((r) => r.pass).length}/${results.length} PASS\n`,
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
