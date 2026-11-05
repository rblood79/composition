// Compare Mode에서 실제 옵션 선택 후 size 편집이 선택값에 전달되는지 확인한다.
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
async function addFromPalette(label, match = new RegExp(`^${label}$`, "i")) {
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page
      .getByRole("button", { name: "Components", exact: true })
      .first()
      .click();
  await search.fill(label);
  await page.waitForTimeout(300);
  await page.locator(".list-item", { hasText: match }).first().click();
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
  if (
    !(await page.locator("#previewFrame").count()) &&
    (await button.isVisible().catch(() => false))
  )
    await button.click();
  await page.waitForSelector("#previewFrame", { timeout: 15000 });
  await page.waitForFunction(
    () =>
      !!document
        .querySelector("#previewFrame")
        ?.contentDocument?.querySelector("[data-catalog-id]"),
    null,
    { timeout: 15000 },
  );
  await page.waitForTimeout(1500);
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

try {
  for (const mode of ["single", "multiple"]) {
    await newProject(`Select value size ${mode} ${Date.now()}`);
    await addFromPalette("Select");
    const owner = await page.evaluate(
      async ({ commands, mode }) => {
        const c = await import(commands),
          ws = window.__COMPOSITION_CATALOG__.workspace;
        const node = [...ws.root.canvasInputs.values()].find(
          (n) => ws.root.typeOf(n) === "Select",
        );
        ws.execute(
          c.setFields({
            targets: [ws.itemOfRecord(node.id).target],
            props: { selectionMode: { kind: "set", value: mode } },
          }),
        );
        ws.selectRecords([node.id]);
        return node.id;
      },
      { commands, mode },
    );
    await compareOn();
    const frame = page.frames().find((f) => f.url().includes("preview.html"));
    for (const count of mode === "single" ? [1] : [1, 2]) {
      if (!(await frame.getByRole("option").count()))
        await frame
          .locator(".react-aria-Select button")
          .first()
          .evaluate((el) => el.click());
      await frame
        .getByRole("option")
        .nth(count - 1)
        .evaluate((el) => el.click());
      await page.waitForTimeout(250);
      for (const [size, px] of [
        ["S", 12],
        ["M", 14],
        ["L", 16],
        ["XL", 18],
      ]) {
        const canvas = await page.evaluate(
          async ({ commands, owner, size, repo }) => {
            const c = await import(commands),
              ws = window.__COMPOSITION_CATALOG__.workspace;
            ws.execute(
              c.setFields({
                targets: [ws.itemOfRecord(owner).target],
                props: { size: { kind: "set", value: size } },
              }),
            );
            const value = [...ws.root.canvasInputs.values()].find(
              (n) => n.bindingId === "selectvalue",
            );
            const metrics = await import(
              `/@fs${repo}/packages/shared/src/catalog/runtime/boxModel.ts`
            );
            return metrics.catalogTextMetrics(value).fontSize;
          },
          { commands, owner, size, repo: REPO },
        );
        await page.waitForTimeout(250);
        const css = await frame
          .locator(".react-aria-SelectValue")
          .evaluate((el) => {
            const text = el.querySelector('[slot="label"]') ?? el;
            return {
              font: parseFloat(getComputedStyle(text).fontSize),
              text: text.textContent,
              placeholder: el.hasAttribute("data-placeholder"),
              summary: !!el.querySelector("[data-picker-selected-count]"),
            };
          });
        record(
          `${mode}:${count}:${size}`,
          css.font === px &&
            canvas === px &&
            !css.placeholder &&
            css.summary === count > 1,
          { canvas, css },
        );
        if (["S", "XL"].includes(size)) {
          const split = page.locator(".workspace-compare-splitter");
          await split.press("End");
          await page.waitForTimeout(150);
          await page.screenshot({
            path: `${OUT}/${mode}-${count}-${size}.png`,
          });
        }
      }
    }
  }
  record("console", errors.length === 0, { errors });
} finally {
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
if (results.some((r) => !r.pass)) process.exitCode = 1;
