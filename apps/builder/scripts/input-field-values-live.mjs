// 실제 Builder UI로 TextArea/ColorField의 빈 값 편집, Property 수정, 저장 재로드를 검증한다.
// pnpm exec node apps/builder/scripts/input-field-values-live.mjs <out>
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
page.setDefaultTimeout(10000);
const errors = [];
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail ?? null).slice(0, 1500)}\n`,
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
  await page
    .getByRole("button", { name: "Components", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
}
const pause = () => page.waitForTimeout(500);
const split = () =>
  page.getByRole("separator", {
    name: "Resize the CSS / Canvas compare split",
    exact: true,
  });
async function read(type) {
  return page.evaluate((type) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const all = [...ws.root.canvasInputs.values()];
    const owner = all.find((n) => ws.root.typeOf(n) === type);
    const input = all.find(
      (n) => n.bindingId === "input" && n.parentId === owner.id,
    );
    const frame = document.querySelector("#previewFrame");
    const element = frame.contentDocument.querySelector(
      `[data-catalog-id="${input.id}"]`,
    );
    const r = element.getBoundingClientRect(),
      f = frame.getBoundingClientRect();
    return {
      owner: owner.id,
      input: input.id,
      value: owner.props.value ?? "",
      canvas: input.derivedProps?.value,
      preview: element.value,
      canvasWhiteSpace: input.visual.whiteSpace,
      domWhiteSpace: getComputedStyle(element).whiteSpace,
      x: f.x + r.x + 10,
      y: f.y + r.y + 10,
      save: ws.autosave.getSnapshot().state,
    };
  }, type);
}
async function selectOwner(id) {
  const navigator = page
    .getByRole("toolbar", { name: /panel controls$/ })
    .getByRole("button", { name: "Navigator", exact: true });
  if ((await navigator.getAttribute("aria-pressed")) !== "true")
    await navigator.click();
  await pause();
  const layers = page.getByRole("treegrid", { name: "Layers", exact: true });
  // The page body has a presentation identity in Layers. Its document parent id
  // is not necessarily an address in canvasInputs after hydration.
  const expandBody = layers.getByRole("button", {
    name: "Expand Body",
    exact: true,
  });
  if (await expandBody.count()) await expandBody.click();
  await pause();
  const ancestors = await page.evaluate((id) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root,
      out = [];
    for (
      let n = root.canvasInputs.get(id);
      n;
      n = root.canvasInputs.get(n.parentId)
    )
      out.unshift(n.id);
    return out.slice(0, -1);
  }, id);
  for (const id of ancestors) {
    const row = layers.locator(`[role="row"][data-key="${id}"]`);
    if (await row.count()) {
      await row.press("ArrowRight");
      await pause();
    }
  }
  await layers.locator(`[role="row"][data-key="${id}"]`).press("Space");
  const design = page
    .getByRole("toolbar", { name: /panel controls$/ })
    .getByRole("button", { name: "Design", exact: true });
  if ((await design.getAttribute("aria-pressed")) !== "true")
    await design.click();
  await pause();
  await page
    .locator('[data-panel-id="properties"]')
    .getByRole("tab", { name: "Property", exact: true })
    .click();
}
try {
  for (const [type, palette, value, replacement] of [
    [
      "TextArea",
      "text area",
      "Canvas multiline\nsecond line",
      "Property value",
    ],
    ["ColorField", "color field", "#336699", "#112233"],
  ]) {
    await page.goto(`${BASE}/dashboard`);
    await page
      .getByRole("button", { name: /new project/i })
      .first()
      .click();
    await page.waitForTimeout(300);
    await page.keyboard.type(`Input value live ${type} ${Date.now()}`);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/builder\//, { timeout: 30000 });
    await page.waitForSelector(".app:not(.builder-booting)");
    await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace);
    await page
      .getByRole("button", {
        name: "Compare Mode (Preview + Skia)",
        exact: true,
      })
      .first()
      .click();
    await addFromPalette(palette);
    await pause();
    const initial = await read(type);
    record(
      `${type} starts empty`,
      initial.canvas === "" && initial.preview === "",
      initial,
    );
    await split().press("Home");
    await page.mouse.click(1100, 750);
    await page.keyboard.press("Escape");
    const editor = page.locator(
      '.catalog-text-editor-input[contenteditable="true"]',
    );
    for (let i = 0; i < 4 && !(await editor.count()); i++) {
      await page.mouse.dblclick(initial.x, initial.y);
      await pause();
    }
    record(`${type} empty Canvas opens editor`, (await editor.count()) === 1);
    await editor.focus();
    await page.keyboard.press("Meta+a");
    const lines = value.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (i) await page.keyboard.press("Enter");
      await page.keyboard.type(lines[i]);
    }
    await page.mouse.click(1100, 750);
    await pause();
    const edited = await read(type);
    record(
      `${type} Canvas edit writes owner and Preview`,
      edited.value === value &&
        edited.canvas === value &&
        edited.preview.toLowerCase() === value.toLowerCase(),
      edited,
    );
    if (type === "TextArea")
      record(
        `${type} multiline wrapping contract`,
        edited.canvasWhiteSpace === "pre-wrap" &&
          edited.domWhiteSpace === "pre-wrap",
        edited,
      );
    await page.screenshot({ path: `${OUT}/${type}-canvas-edited.png` });
    await page.keyboard.press("Meta+z");
    await pause();
    const undone = await read(type);
    record(
      `${type} Canvas value Undo`,
      undone.value === "" && undone.canvas === "" && undone.preview === "",
      undone,
    );
    await page.keyboard.press("Meta+Shift+z");
    await pause();
    const redone = await read(type);
    record(
      `${type} Canvas value Redo`,
      redone.value === value &&
        redone.canvas === value &&
        redone.preview.toLowerCase() === value.toLowerCase(),
      redone,
    );
    await selectOwner(edited.owner);
    const field = page
      .locator('[data-panel-id="properties"] fieldset', {
        has: page.locator("legend", { hasText: /^Value$/ }),
      })
      .first()
      .locator("input,textarea")
      .first();
    await field.fill(replacement);
    await field.press("Enter");
    await pause();
    const property = await read(type);
    record(
      `${type} Property value updates both consumers`,
      property.value === replacement &&
        property.canvas === replacement &&
        property.preview.toLowerCase() === replacement.toLowerCase(),
      property,
    );
    await page.waitForFunction(
      () =>
        window.__COMPOSITION_CATALOG__.workspace.autosave.getSnapshot()
          .state === "saved",
    );
    await page.screenshot({ path: `${OUT}/${type}-value.png` });
    await page.reload();
    await page.waitForSelector(".app:not(.builder-booting)");
    const compare = page.getByRole("button", {
      name: "Compare Mode (Preview + Skia)",
      exact: true,
    });
    if ((await compare.getAttribute("aria-pressed")) !== "true")
      await compare.click();
    await page.waitForFunction(() =>
      document
        .querySelector("#previewFrame")
        ?.contentDocument?.querySelector("input,textarea"),
    );
    const restored = await read(type);
    record(
      `${type} saved reload restores value`,
      restored.value === replacement &&
        restored.canvas === replacement &&
        restored.preview.toLowerCase() === replacement.toLowerCase(),
      restored,
    );
    for (const name of ["Navigator", "Design"]) {
      const rail = page
        .getByRole("toolbar", { name: /panel controls$/ })
        .getByRole("button", { name, exact: true });
      if ((await rail.getAttribute("aria-pressed")) === "true")
        await rail.click();
    }
    await split().press("Home");
    await pause();
    for (let i = 0; i < 4 && !(await editor.count()); i++) {
      await page.mouse.dblclick(restored.x, restored.y);
      await pause();
    }
    await editor.fill("");
    await page.mouse.click(1100, 750);
    await pause();
    const cleared = await read(type);
    record(
      `${type} clear restores empty`,
      cleared.value === "" && cleared.canvas === "" && cleared.preview === "",
      cleared,
    );
  }
} catch (error) {
  record("harness completed", false, String(error));
  await page.screenshot({ path: `${OUT}/failure.png` });
} finally {
  record("no console errors", errors.length === 0, errors);
  writeFileSync(
    `${OUT}/results.json`,
    JSON.stringify({ results, errors, url: page.url() }, null, 2),
  );
  await browser.close();
}
if (results.some((r) => !r.pass)) process.exitCode = 1;
