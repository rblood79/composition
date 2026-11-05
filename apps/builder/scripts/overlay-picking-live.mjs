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

const types = [
  "Dialog",
  "Popover",
  "Select",
  "ComboBox",
  "Menu",
  "DatePicker",
  "DateRangePicker",
  "Tooltip",
  "ContextualHelp",
  "PreviewTrigger",
  "Sheet",
];
try {
  await newProject(`Overlay hit test ${Date.now()}`);
  for (const type of types) {
    await page.evaluate(
      async ({ commands }) => {
        const c = await import(commands),
          ws = window.__COMPOSITION_CATALOG__.workspace;
        const ids = [
          ...ws.runtime.graph.getEntry("project:node:home-body").children,
        ];
        if (ids.length)
          ws.execute(
            c.removeTargets({
              targets: ids.map((id) => ({ kind: "node", id })),
            }),
          );
        ws.session.exitContext();
        ws.session.clearSelection();
      },
      { commands },
    );
    await addFromPalette(
      type,
      new RegExp(`^${type.replace(/([a-z])([A-Z])/g, "$1\\s*$2")}$`, "i"),
    );
    const owner = await page.evaluate(() => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const node = [...ws.root.canvasInputs.values()].find(
        (n) =>
          ws.root.canvasInputs.get(n.parentId)?.sourceId ===
          "project:node:home-body",
      );
      ws.selectRecords([node.id]);
      return node.id;
    });
    const open = page.getByRole("button", { name: "Open", exact: true });
    if (!(await open.isVisible()))
      await page.getByRole("button", { name: "Design", exact: true }).click();
    await open.click();
    await page.evaluate(() => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      ws.session.exitContext();
      ws.session.clearSelection();
    });
    await addFromPalette("Button");
    const behind = await page.evaluate(
      async ({ commands }) => {
        const c = await import(commands),
          ws = window.__COMPOSITION_CATALOG__.workspace;
        const node = [...ws.root.canvasInputs.values()].find(
          (n) =>
            ws.root.typeOf(n) === "Button" &&
            ws.root.canvasInputs.get(n.parentId)?.sourceId ===
              "project:node:home-body",
        );
        ws.execute(
          c.setFields({
            targets: [ws.itemOfRecord(node.id).target],
            sizing: {
              width: { kind: "set", value: 1800 },
              height: { kind: "set", value: 850 },
            },
          }),
        );
        ws.selectRecords([node.id]);
        return node.id;
      },
      { commands },
    );
    await page.waitForTimeout(500);
    const geometry = async () =>
      page.evaluate((owner) => {
        const h = window.__COMPOSITION_CATALOG__,
          b = h.canvas.boundsOf(owner),
          camera = h.canvas.camera();
        return {
          box: b,
          point: {
            x: camera.x + (b.x + b.width / 2) * camera.zoom,
            y: camera.y + (b.y + b.height / 2) * camera.zoom,
          },
          camera,
        };
      }, owner);
    const selected = () =>
      page.evaluate(
        () =>
          window.__COMPOSITION_CATALOG__.workspace.session.getSnapshot()
            .selection[0]?.identity,
      );
    let g = await geometry();
    const rect = await page.getByTestId("skia-canvas-unified").boundingBox();
    const point = { x: rect.x + g.point.x, y: rect.y + g.point.y };
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(100);
    const hovered = await page.evaluate(
      () =>
        window.__COMPOSITION_CATALOG__.workspace.session.getSnapshot().hover
          ?.identity,
    );
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(200);
    record(
      `${type}:hover-click`,
      hovered === owner && (await selected()) === owner,
      { owner, behind, hovered, selected: await selected(), g },
    );
    await page.screenshot({ path: `${OUT}/${type}-canvas.png` });
    if (["Dialog", "Sheet"].includes(type)) {
      await page.mouse.click(
        rect.x + g.camera.x + 100 * g.camera.zoom,
        rect.y + g.camera.y + 400 * g.camera.zoom,
      );
      await page.waitForTimeout(150);
      record(`${type}:backdrop`, (await selected()) === owner, {
        selected: await selected(),
      });
    }
    if (["Dialog", "Popover", "Select"].includes(type)) {
      await compareOn();
      const parity = await page.evaluate(
        ({ owner, type }) => {
          const h = window.__COMPOSITION_CATALOG__,
            frame = document.querySelector("#previewFrame");
          const doc = frame.contentDocument;
          const selector =
            type === "Dialog" ? ".react-aria-Modal" : ".react-aria-Popover";
          const modal = doc.querySelector(selector),
            dom = modal.getBoundingClientRect().toJSON(),
            canvas = h.canvas.boundsOf(owner);
          return {
            canvas,
            dom,
            topmost: !!doc
              .elementFromPoint(dom.x + dom.width / 2, dom.y + dom.height / 2)
              ?.closest(selector),
          };
        },
        { owner, type },
      );
      record(
        `${type}:preview`,
        parity.topmost &&
          ["x", "y", "width", "height"].every(
            (k) => Math.abs(parity.canvas[k] - parity.dom[k]) < 1.1,
          ),
        parity,
      );
      const split = page.locator(".workspace-compare-splitter");
      await split.press("End");
      await page.screenshot({ path: `${OUT}/${type}-preview.png` });
      await split.press("Home");
      // 다음 fixture는 새 Preview 세션으로 연다. 외부 Canvas 클릭은 RAC popup을 닫을 수 있다.
      await page
        .getByRole("button", {
          name: "Skia Only Mode",
          exact: true,
        })
        .click();
    }
    await page.keyboard.down("Meta");
    await page.mouse.click(point.x, point.y);
    await page.keyboard.up("Meta");
    await page.waitForTimeout(150);
    const deep = await selected();
    const inside = await page.evaluate(
      ({ deep, owner }) => {
        const ws = window.__COMPOSITION_CATALOG__.workspace;
        for (
          let n = ws.root.canvasInputs.get(deep);
          n;
          n = ws.root.canvasInputs.get(n.parentId)
        )
          if (n.id === owner) return true;
        return false;
      },
      { deep, owner },
    );
    record(`${type}:deep-click`, inside, { deep });
    await page.evaluate((owner) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      ws.session.exitContext();
      ws.selectRecords([owner]);
    }, owner);
    await open.click();
    await page.waitForTimeout(200);
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(150);
    record(`${type}:closed`, (await selected()) !== owner, {
      selected: await selected(),
    });
    await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.undo());
    await page.waitForTimeout(300);
    g = await geometry();
    await page.mouse.click(rect.x + g.point.x, rect.y + g.point.y);
    await page.waitForTimeout(150);
    record(`${type}:undo`, (await selected()) === owner, {
      selected: await selected(),
    });
  }
  record("console", errors.length === 0, { errors });
} finally {
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
if (results.some((r) => !r.pass)) process.exitCode = 1;
