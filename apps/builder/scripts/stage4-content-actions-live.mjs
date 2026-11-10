// 실제 Builder UI의 LinkButton/LabeledValue 편집·저장·navigation을 검증한다.
// pnpm exec node apps/builder/scripts/stage4-content-actions-live.mjs <out>
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
const browser = await chromium.launch({
  headless: process.env.HEADLESS === "1",
  channel: "chrome",
});
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
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace);
  return page.evaluate((type) => {
    const catalog = window.__COMPOSITION_CATALOG__;
    const ws = catalog.workspace;
    const owner = [...ws.root.canvasInputs.values()].find(
      (node) => ws.root.typeOf(node) === type,
    );
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el = owner && doc.querySelector(`[data-catalog-id="${owner.id}"]`);
    const measure = (element) => {
      const css = doc.defaultView.getComputedStyle(element);
      return {
        fontFamily: css.fontFamily,
        fontSize: css.fontSize,
        lineHeight: css.lineHeight,
        display: css.display,
        height: element.getBoundingClientRect().height,
        paddingBottom: css.paddingBottom,
        textDecorationLine: css.textDecorationLine,
      };
    };
    return {
      id: owner?.id,
      props: owner?.props,
      text: el?.textContent,
      href: el?.getAttribute("href"),
      domRect: el?.getBoundingClientRect().toJSON(),
      canvasRect: owner ? catalog.canvas.boundsOf(owner.id) : undefined,
      typography: el ? [el, ...el.children].map(measure) : [],
      save: ws.autosave.getSnapshot().state,
    };
  }, type);
}
async function selectOwner(id) {
  const box = await page.evaluate((id) => {
    const cat = window.__COMPOSITION_CATALOG__;
    const bounds = cat.canvas.boundsOf(id);
    cat.canvas.setCamera({ scale: 1, x: 450 - bounds.x, y: 200 - bounds.y });
    return bounds;
  }, id);
  await split().press("Home");
  await pause();
  await page.mouse.click(450 + box.width / 2, 200 + box.height / 2);
  await page.waitForFunction(
    (id) =>
      window.__COMPOSITION_CATALOG__.workspace.session
        .getSnapshot()
        .selection.some((item) => item.identity === id),
    id,
  );
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
async function enterCompare() {
  const compare = page
    .getByRole("button", {
      name: "Compare mode (Preview + Skia)",
      exact: true,
    })
    .first();
  if ((await compare.getAttribute("aria-pressed")) !== "true")
    await compare.click();
  await page.waitForSelector("#previewFrame");
  await pause();
}
async function reload() {
  await page.reload();
  await page.waitForSelector(".app:not(.builder-booting)");
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace);
  await enterCompare();
}
const destinationPath = "/linkbutton-keyboard-target";
try {
  for (const [type, palette] of [
    ["LinkButton", "link button"],
    ["LabeledValue", "labeled value"],
  ]) {
    await page.goto(`${BASE}/dashboard`);
    await page
      .getByRole("button", { name: /new project/i })
      .first()
      .click();
    await page.waitForTimeout(300);
    await page.keyboard.type(`Stage4 ${type} ${Date.now()}`);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/builder\//, { timeout: 30000 });
    await page.waitForSelector(".app:not(.builder-booting)");
    await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace);
    await enterCompare();
    await addFromPalette(palette);
    await pause();
    const before = await read(type);
    record(`${type} palette assembly`, !!before.id && !!before.text, before);
    if (type === "LinkButton")
      record(
        "LinkButton native underline reset",
        before.typography.every((style) => style.textDecorationLine === "none"),
        before.typography,
      );
    await selectOwner(before.id);
    const panel = page.locator('[data-panel-id="properties"]');
    const field = (name) =>
      panel.getByRole("group", { name, exact: true }).getByRole("textbox");
    await field("Label").fill("Edited label");
    await field("Label").press("Tab");
    await pause();
    const value = field(type === "LinkButton" ? "URL" : "Value");
    await value.fill(type === "LinkButton" ? destinationPath : "Edited value");
    await value.press("Tab");
    await pause();
    let edited = await read(type);
    const persisted = (item) =>
      item.text.includes("Edited label") &&
      (type === "LinkButton"
        ? item.href === destinationPath
        : item.text.includes("Edited value"));
    record(`${type} Property updates Preview`, persisted(edited), edited);
    record(
      `${type} Canvas/Preview geometry`,
      Math.abs(edited.domRect.width - edited.canvasRect.width) < 0.75 &&
        Math.abs(edited.domRect.height - edited.canvasRect.height) < 0.75,
      edited,
    );
    await page.evaluate((id) => {
      const cat = window.__COMPOSITION_CATALOG__;
      const box = cat.canvas.boundsOf(id);
      cat.canvas.setCamera({ scale: 1, x: 450 - box.x, y: 200 - box.y });
    }, edited.id);
    for (const name of ["Navigator", "Design", "Components"]) {
      const rail = page
        .getByRole("toolbar", { name: /panel controls$/ })
        .getByRole("button", { name, exact: true });
      if ((await rail.getAttribute("aria-pressed")) === "true")
        await rail.click();
    }
    await pause();
    await split().press("Home");
    await page.mouse.move(350, 900);
    await pause();
    await page.screenshot({ path: `${OUT}/${type}-canvas.png` });
    await split().press("End");
    await pause();
    await page.screenshot({ path: `${OUT}/${type}-preview.png` });
    if (type === "LinkButton") {
      const frame = page.frameLocator("#previewFrame");
      const link = frame.getByRole("link", { name: "Edited label" });
      await link.focus();
      await link.press("Enter");
      const destination = frame.locator(".preview-not-found__path");
      await destination.waitFor();
      record(
        "LinkButton keyboard router navigation",
        (await destination.textContent()) === destinationPath,
      );
    }
    await page.waitForFunction(
      () =>
        window.__COMPOSITION_CATALOG__.workspace.autosave.getSnapshot()
          .state === "saved",
    );
    await reload();
    edited = await read(type);
    record(`${type} saved reload`, persisted(edited), edited);
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
if (results.some((result) => !result.pass)) process.exitCode = 1;
