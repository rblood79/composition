// 실제 팔레트·Layers·Property만으로 13개 필드의 Label 자식을 편집한다.
// 문서/state를 직접 변경하지 않는다. 별도 scratch 프로젝트의 history만 사용한다.
// BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-label-children-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import pixelmatch from "pixelmatch";

const require = createRequire(import.meta.url);
const { PNG } = require(
  resolve("node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs"),
);

const OUT = resolve(process.argv[2] ?? "output/playwright/s2-label-children");
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const types = [
  ["TextField", "text field"],
  ["TextArea", "text area"],
  ["NumberField", "number field"],
  ["SearchField", "search field"],
  ["ColorField", "color field"],
  ["DateField", "date field"],
  ["TimeField", "time field"],
  ["DatePicker", "date picker"],
  ["DateRangePicker", "date range picker"],
  ["CheckboxGroup", "checkbox group"],
  ["RadioGroup", "radio group"],
  ["Select", "select"],
  ["ComboBox", "combo box"],
];
const state = JSON.parse(
  readFileSync("apps/builder/scripts/.auth-session.json", "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1800, height: 1100 },
  locale: "ko-KR",
  deviceScaleFactor: 2,
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
});
const results = [];
const instances = [];
const check = (name, ok, detail) => {
  results.push({ name, status: ok ? "PASS" : "FAIL", detail });
  console.log(
    `${ok ? "PASS" : "FAIL"} ${name} ${JSON.stringify(detail ?? "")}`,
  );
  writeFileSync(
    `${OUT}/results.json`,
    JSON.stringify({ url: page.url(), results, errors, instances }, null, 2),
  );
};
const panel = () => page.locator('[data-panel-id="properties"]');
const layers = () =>
  page.getByRole("treegrid", { name: "Layers", exact: true });
const pause = () => page.waitForTimeout(250);
async function rail(name) {
  const button = page
    .getByRole("toolbar", { name: /panel controls$/ })
    .getByRole("button", { name, exact: true });
  if ((await button.getAttribute("aria-pressed")) !== "true")
    await button.click();
}
async function select(id) {
  const target = layers().locator(`[role="row"][data-key="${id}"]`);
  if (!(await target.count())) {
    const ancestors = await page.evaluate((id) => {
      const root = window.__COMPOSITION_CATALOG__.workspace.root;
      const result = [];
      for (
        let n = root.domInputs.get(id);
        n;
        n = root.domInputs.get(n.parentId)
      )
        result.unshift(n.id);
      return result.slice(0, -1);
    }, id);
    for (const ancestor of ancestors) {
      const row = layers().locator(`[role="row"][data-key="${ancestor}"]`);
      if (await row.count()) {
        await row.press("ArrowRight");
        await pause();
      }
    }
  }
  await target.scrollIntoViewIfNeeded();
  await pause();
  await target.press("Space");
  await page.waitForFunction(
    (id) =>
      window.__COMPOSITION_CATALOG__.workspace.session.getSnapshot()
        .selection[0]?.identity === id,
    id,
  );
  await rail("Design");
  await panel().getByRole("tab", { name: "Property", exact: true }).click();
  await pause();
}
async function snapshot(source) {
  return page.evaluate((source) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const field = [...root.canvasInputs.values()].find(
      (n) => n.sourceId === source,
    );
    if (!field) throw new Error(`No field ${source}`);
    const descendants = [];
    const visit = (n) => {
      descendants.push(n);
      for (const id of n.children) {
        const child = root.canvasInputs.get(id);
        if (child) visit(child);
      }
    };
    visit(field);
    const label = descendants.find((n) => root.typeOf(n) === "Label");
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const part = (slot) => {
      const n = descendants.find(
        (n) => n.parentId === label?.id && n.props.slot === slot,
      );
      if (!n) return null;
      const el = doc?.querySelector(`[data-catalog-id="${n.id}"]`);
      return {
        id: n.id,
        value: n.props.children,
        iconName: n.props.iconName,
        hidden: n.hidden,
        canvas: root.getGeometry([n.id]).get(n.id),
        domText: el?.textContent,
        domWidth: el?.getBoundingClientRect().width,
        domHeight: el?.getBoundingClientRect().height,
        domLineHeight: el ? getComputedStyle(el).lineHeight : undefined,
        fontSmoothing: el
          ? getComputedStyle(el).getPropertyValue("-webkit-font-smoothing")
          : undefined,
        fontWeight: {
          visual: n.visual.fontWeight,
          derived: n.derivedProps?.fontWeight,
          dom: el ? getComputedStyle(el).fontWeight : undefined,
        },
        fontFamily: {
          visual: n.visual.fontFamily,
          dom: el ? getComputedStyle(el).fontFamily : undefined,
        },
        whiteSpace: el ? getComputedStyle(el).whiteSpace : undefined,
        svg: el?.querySelector("svg")?.innerHTML,
      };
    };
    return {
      field: {
        id: field.id,
        type: root.typeOf(field),
        label: field.props.label,
      },
      label: { id: label?.id },
      body: part("label-content"),
      icon: part("necessity-icon"),
      indicator: part("necessity-label"),
      history: ws.history.getSnapshot(),
    };
  }, source);
}
async function editText(value) {
  const input = panel()
    .getByRole("group", { name: "Text", exact: true })
    .getByRole("textbox");
  await input.fill(value);
  await input.press("Tab");
  await pause();
}
async function history(redo = false) {
  await panel().getByRole("tab", { name: "Property", exact: true }).click();
  await page.keyboard.press(redo ? "Meta+Shift+z" : "Meta+z");
  await pause();
}
try {
  // Vite가 S2 oracle의 의존성을 먼저 최적화하게 해 live 편집 중 reload를 막는다.
  await page.goto(`${BASE}/dashboard`);
  await page.evaluate(() => import("/scripts/s2-label-oracle.browser.mjs"));
  for (const [type, paletteName] of types.filter(
    ([type]) =>
      !process.env.S2_FIELDS || process.env.S2_FIELDS.split(",").includes(type),
  )) {
    try {
      await page.goto(`${BASE}/dashboard`);
      await page
        .getByRole("button", { name: "New project", exact: true })
        .first()
        .click();
      await page
        .getByRole("textbox", { name: "Project name" })
        .fill(`S2 ${type} children ${Date.now()}`);
      await page.getByRole("button", { name: "Create", exact: true }).click();
      await page.waitForURL(/\/builder\//);
      await page.waitForFunction(
        () => window.__COMPOSITION_CATALOG__?.workspace,
      );
      await rail("Design");
      await rail("Navigator");
      await rail("Components");
      await page
        .getByRole("button", {
          name: "Compare Mode (Preview + Skia)",
          exact: true,
        })
        .click();
      await page.frameLocator("#previewFrame").locator("body").waitFor();
      await layers().getByRole("row").first().press("Home");
      await pause();
      await layers()
        .getByRole("row", { name: "Body", exact: true })
        .press("Space");
      await page
        .locator('[data-panel-id="components"]')
        .getByRole("searchbox")
        .fill(paletteName);
      await page
        .locator('[data-panel-id="components"]')
        .getByRole("button", { name: paletteName, exact: true })
        .click();
      await pause();
      const source = await page.evaluate(
        () =>
          window.__COMPOSITION_CATALOG__.workspace.session.getSnapshot()
            .selection[0]?.target.id,
      );
      const original = await snapshot(source);
      instances.push({ type, source, url: page.url() });
      await panel().getByRole("tab", { name: "Property", exact: true }).click();
      const labelText = `Long ${type} label with several words to wrap at a narrow width`;
      const labelInput = panel()
        .getByRole("group", { name: "Label", exact: true })
        .getByRole("textbox");
      await labelInput.fill(labelText);
      await labelInput.press("Tab");
      await panel()
        .getByRole("button", { name: "Required", exact: true })
        .click();
      await select(original.label.id);
      const initial = await snapshot(source);
      check(
        `${type}: real children`,
        initial.body &&
          initial.icon &&
          initial.indicator &&
          !initial.icon.hidden,
        initial,
      );
      check(
        `${type}: CJK default Label line height`,
        initial.body.domLineHeight === "21px" &&
          initial.body.canvas.height === 21,
        initial.body,
      );
      if (!process.env.S2_QUICK) {
        await select(initial.body.id);
        await panel().getByRole("tab", { name: "Text", exact: true }).click();
        check(
          `${type}: body Design typography`,
          (await panel()
            .getByRole("combobox", { name: "Font Size", exact: true })
            .inputValue()) === "14" &&
            (await panel()
              .getByRole("combobox", { name: "Line Height", exact: true })
              .inputValue()) === "21",
        );
        const lineHeight = panel().getByRole("combobox", {
          name: "Line Height",
          exact: true,
        });
        await lineHeight.fill("28");
        await lineHeight.press("Enter");
        await panel().getByRole("tab", { name: "Text", exact: true }).click();
        await pause();
        let styled = await snapshot(source);
        check(
          `${type}: body 28px style → Canvas/Preview`,
          styled.body.domLineHeight === "28px" &&
            styled.body.canvas.height === 28,
          styled.body,
        );
        await history();
        styled = await snapshot(source);
        check(
          `${type}: body style Undo`,
          styled.body.domLineHeight === "21px" &&
            styled.body.canvas.height === 21,
          styled.body,
        );
        await history(true);
        styled = await snapshot(source);
        check(
          `${type}: body style Redo`,
          styled.body.domLineHeight === "28px" &&
            styled.body.canvas.height === 28,
          styled.body,
        );
        await panel().getByRole("tab", { name: "Text", exact: true }).click();
        await panel()
          .getByRole("button", { name: "Reset section", exact: true })
          .click();
        await pause();
        styled = await snapshot(source);
        check(
          `${type}: body style Reset`,
          styled.body.domLineHeight === "21px" &&
            styled.body.canvas.height === 21,
          styled.body,
        );
        await select(initial.body.id);
        await editText(`Edited ${type} child`);
        let read = await snapshot(source);
        check(
          `${type}: body Property → Canvas/Preview`,
          read.body.value === `Edited ${type} child` &&
            read.body.domText === read.body.value &&
            read.body.canvas.width > 0,
          read.body,
        );
        await history();
        read = await snapshot(source);
        check(
          `${type}: body Undo`,
          read.body.value === labelText && read.body.domText === labelText,
          read.body,
        );
        await history(true);
        read = await snapshot(source);
        check(
          `${type}: body Redo`,
          read.body.domText === `Edited ${type} child`,
          read.body,
        );
        await select(read.body.id);
        await panel()
          .getByRole("button", { name: "Reset Text to default", exact: true })
          .click();
        await pause();
        read = await snapshot(source);
        check(
          `${type}: body Reset binding`,
          read.body.value === labelText && read.body.domText === labelText,
          read.body,
        );
        await select(read.icon.id);
        await panel()
          .getByRole("button", { name: "s2-asterisk", exact: true })
          .click();
        await page
          .getByRole("dialog", { name: "Icons" })
          .getByRole("searchbox", { name: "Search icons" })
          .fill("check");
        await page.locator('[role="option"][data-key="check"]').click();
        await pause();
        read = await snapshot(source);
        check(
          `${type}: Icon child editing`,
          read.icon.iconName === "check" &&
            !!read.icon.svg &&
            read.icon.canvas.width > 0,
          read.icon,
        );
        await history();
        read = await snapshot(source);
        check(
          `${type}: Icon Undo restores S2`,
          read.icon.iconName === "s2-asterisk",
          read.icon,
        );
      }
      let read = await snapshot(source);
      await select(read.field.id);
      await panel().getByRole("tab", { name: "Layout", exact: true }).click();
      await panel()
        .getByRole("button", { name: "Width Size mode", exact: true })
        .click();
      await page.getByRole("option", { name: "Fixed", exact: true }).click();
      const width = panel().getByRole("combobox", {
        name: "Width",
        exact: true,
      });
      await width.fill("160");
      await width.press("Enter");
      await panel().getByRole("tab", { name: "Property", exact: true }).click();
      await panel()
        .getByRole("radiogroup", { name: "Necessity Indicator", exact: true })
        .getByRole("radio", { name: "Label", exact: true })
        .click();
      await pause();
      read = await snapshot(source);
      await select(read.label.id);
      await select(read.indicator.id);
      await editText(`Required ${type}`);
      read = await snapshot(source);
      check(
        `${type}: necessity text child`,
        read.indicator.value === `Required ${type}` &&
          read.indicator.domText === read.indicator.value &&
          read.indicator.canvas.width > 0,
        read.indicator,
      );
      check(
        `${type}: narrow necessity remains one line`,
        read.indicator.whiteSpace === "nowrap" &&
          read.indicator.domHeight <=
            Number.parseFloat(read.indicator.domLineHeight) + 0.5 &&
          read.indicator.canvas.height <=
            Number.parseFloat(read.indicator.domLineHeight) + 0.5,
        read.indicator,
      );
      // Camera-only positioning keeps the Label clear of floating panels; document data is unchanged.
      await page.evaluate((id) => {
        const cat = window.__COMPOSITION_CATALOG__;
        const box = cat.canvas.boundsOf(id);
        cat.canvas.setCamera({ scale: 1, x: 450 - box.x, y: 200 - box.y });
      }, read.label.id);
      await page.waitForTimeout(1500);
      writeFileSync(
        `${OUT}/${type}-paint.json`,
        JSON.stringify(
          await page.evaluate(
            async (id) =>
              (
                await import("/scripts/s2-label-oracle.browser.mjs")
              ).inspectLabelPaint(id),
            read.body.id,
          ),
          null,
          2,
        ),
      );
      const split = page.getByRole("separator", {
        name: "Resize the CSS / Canvas compare split",
        exact: true,
      });
      await split.press("Home");
      await page.mouse.click(1100, 700);
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      // The page itself gets a blue hover outline. Keep the pointer in the
      // canvas gutter so that both captures contain only resting page chrome.
      await page.mouse.move(350, 900);
      await page.waitForFunction(() => {
        const state =
          window.__COMPOSITION_CATALOG__.workspace.session.getSnapshot();
        return state.selection.length === 0 && !state.hover;
      });
      await pause();
      const clip = await page.evaluate((id) => {
        const frame = document.querySelector("#previewFrame");
        const label = frame.contentDocument.querySelector(
          `[data-catalog-id="${id}"]`,
        );
        const r = label.getBoundingClientRect();
        const f = frame.getBoundingClientRect();
        return {
          x: Math.floor(r.x + f.x) - 2,
          y: Math.floor(r.y + f.y) - 2,
          width: Math.ceil(r.width) + 4,
          height: Math.ceil(r.height) + 4,
        };
      }, read.label.id);
      await page.waitForTimeout(400);
      const canvas = await page.screenshot({
        path: `${OUT}/${type}-label-canvas.png`,
        clip,
      });
      await split.press("End");
      await page.mouse.move(350, 900);
      await page.waitForTimeout(400);
      const dom = await page.screenshot({
        path: `${OUT}/${type}-label-preview.png`,
        clip,
      });
      const a = PNG.sync.read(canvas),
        b = PNG.sync.read(dom);
      const diff = new PNG({ width: a.width, height: a.height });
      const differing = pixelmatch(
        a.data,
        b.data,
        diff.data,
        a.width,
        a.height,
        { threshold: 0.1 },
      );
      writeFileSync(`${OUT}/${type}-label-diff.png`, PNG.sync.write(diff));
      check(
        `${type}: Label raster Canvas/Preview`,
        differing / (a.width * a.height) <= 0.001,
        { differing, pixels: a.width * a.height, clip },
      );
      await split.press("Home");
      await page.screenshot({ path: `${OUT}/${type}-visible.png` });
      const editor = page.locator(
        '.catalog-text-editor-input[contenteditable="true"]',
      );
      for (let attempt = 0; attempt < 4 && !(await editor.count()); attempt++) {
        await page.mouse.dblclick(clip.x + 12, clip.y + 12);
        await pause();
      }
      check(
        `${type}: Canvas fragment double-click opens source editor`,
        (await editor.count()) === 1,
      );
      if (await editor.count()) {
        const editorBox = await editor.boundingBox();
        check(
          `${type}: source editor keeps wrapping width`,
          !!editorBox &&
            Math.abs(editorBox.width - read.body.canvas.width) <= 1,
          { editorBox, sourceBox: read.body.canvas },
        );
        await editor.fill(`Canvas edited ${type}`);
        await page.mouse.click(1100, 750);
        await pause();
        const edited = await snapshot(source);
        check(
          `${type}: Canvas text edit writes real child`,
          edited.body.value === `Canvas edited ${type}` &&
            edited.body.domText === edited.body.value,
          edited.body,
        );
        await select(edited.body.id);
        await panel()
          .getByRole("button", { name: "Reset Text to default", exact: true })
          .click();
        await pause();
      }
      await page.screenshot({ path: `${OUT}/${type}.png` });
      await page
        .getByRole("button", { name: "Saved", exact: true })
        .waitFor({ timeout: 20000 });
      const before = await page.evaluate(() =>
        window.__COMPOSITION_CATALOG__.workspace.history.getSnapshot(),
      );
      await page.reload();
      await page.waitForFunction(
        () => window.__COMPOSITION_CATALOG__?.workspace,
      );
      if (!(await page.locator("#previewFrame").count()))
        await page
          .getByRole("button", {
            name: "Compare Mode (Preview + Skia)",
            exact: true,
          })
          .click();
      await page.frameLocator("#previewFrame").locator("body").waitFor();
      await page.waitForTimeout(1500);
      {
        const read = await snapshot(source);
        check(
          `${type}: saved reload`,
          read.body.domText === read.field.label &&
            read.indicator.domText === `Required ${type}`,
          read,
        );
      }
      check(
        `${type}: dedicated project history`,
        before.labels.length >= 4,
        before,
      );
      if (process.env.S2_PUBLISH_URL) {
        const content = await page.evaluate(async () =>
          (
            await import("/scripts/s2-label-oracle.browser.mjs")
          ).exportLabelProject(),
        );
        writeFileSync(`${OUT}/${type}-project.json`, JSON.stringify(content));
        const publication = await context.newPage();
        publication.on("pageerror", (e) =>
          errors.push(`publish: ${e.message}`),
        );
        publication.on("console", (message) => {
          if (message.type() === "error")
            errors.push(`publish: ${message.text()}`);
        });
        const pub = process.env.S2_PUBLISH_URL;
        await publication.route("**/s2-label-fixture.json", (route) =>
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(content),
          }),
        );
        await publication.goto(
          `${pub}/?project=${encodeURIComponent(`${pub}/s2-label-fixture.json`)}`,
        );
        try {
          await publication
            .locator('[slot="label-content"]')
            .waitFor({ timeout: 20000 });
        } catch (error) {
          await publication.screenshot({
            path: `${OUT}/${type}-publish-failure.png`,
          });
          writeFileSync(
            `${OUT}/${type}-publish-failure.html`,
            await publication.content(),
          );
          throw error;
        }
        await publication.waitForFunction(() =>
          [...document.fonts].some(
            (f) => /korean/.test(f.family) && f.status === "loaded",
          ),
        );
        await publication.evaluate(() => document.fonts.ready);
        await publication.waitForTimeout(1000);
        const actual = await publication.evaluate(() => {
          const body = document.querySelector('[slot="label-content"]');
          const indicator = document.querySelector('[slot="necessity-label"]');
          const style = getComputedStyle(body);
          return {
            body: body.textContent,
            indicator: indicator?.textContent,
            lineHeight: style.lineHeight,
            fontWeight: style.fontWeight,
            fontSmoothing: style.getPropertyValue("-webkit-font-smoothing"),
            display: style.display,
            indicatorWhiteSpace: indicator
              ? getComputedStyle(indicator).whiteSpace
              : null,
            height: body.getBoundingClientRect().height,
          };
        });
        const preview = await snapshot(source);
        check(
          `${type}: actual Publish matches Preview Label`,
          actual.body === preview.body.domText &&
            actual.indicator === preview.indicator.domText &&
            actual.lineHeight === preview.body.domLineHeight &&
            actual.fontSmoothing === preview.body.fontSmoothing &&
            actual.display === "inline" &&
            actual.indicatorWhiteSpace === "nowrap" &&
            Math.abs(actual.height - preview.body.domHeight) <= 0.75,
          actual,
        );
        await publication.screenshot({ path: `${OUT}/${type}-publish.png` });
        await publication.close();
        await page.bringToFront();
      }
    } catch (e) {
      check(`${type}: exercise`, false, e.message);
      await page.screenshot({ path: `${OUT}/${type}-failure.png` });
      throw e;
    }
  }
  check("browser errors", errors.length === 0, errors);
} finally {
  writeFileSync(
    `${OUT}/results.json`,
    JSON.stringify({ url: page.url(), results, errors, instances }, null, 2),
  );
  await browser.close();
}
if (results.some((r) => r.status === "FAIL")) process.exitCode = 1;
