// IllustratedMessage S2 node tree live (사용자 2026-10-09 「IllustratedMessage 제목 · 설명 노드 전환」 →
// 「레퍼런스에 맞게」 → 「(a) 로 진행해, orientation 도 같이 넣어」) — real Builder (headed Chrome,
// Compare Mode): the palette's IllustratedMessage is `Illustration + Heading + Description` nodes; for
// vertical · horizontal × sm · md · lg the Canvas boxes (root + parts, relative to the root) equal
// the Preview's (±1px); the Preview root carries the S2 attributes and loads its sheet; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/illustrated-message-live.mjs <out>
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
  await search.fill(label instanceof RegExp ? "chart" : label);
  await page.waitForTimeout(300);
  await page
    .locator(".list-item", {
      hasText: label instanceof RegExp ? label : new RegExp(`^${label}$`, "i"),
    })
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
await page.keyboard.type("Illustrated message");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
await addFromPalette("illustrated message");
await compareOn();
await page.waitForTimeout(800);
const snapshot = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const records = [...root.canvasInputs.values()];
    const message = records.find((r) => root.typeOf(r) === "IllustratedMessage");
    const kids = records.filter((r) => r.parentId === message.id);
    const geo = (id) => root.getGeometry([id]).get(id);
    const base = geo(message.id);
    const canvas = [message, ...kids].map((r) => {
      const g = geo(r.id);
      return {
        type: root.typeOf(r),
        x: Math.round((g.x - base.x) * 10) / 10,
        y: Math.round((g.y - base.y) * 10) / 10,
        w: Math.round(g.width * 10) / 10,
        h: Math.round(g.height * 10) / 10,
      };
    });
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el = doc.querySelector(`[data-catalog-id="${message.id}"]`);
    const box = el.getBoundingClientRect();
    const dom = [el, ...el.children].map((node) => {
      const r = node.getBoundingClientRect();
      return {
        x: Math.round((r.left - box.left) * 10) / 10,
        y: Math.round((r.top - box.top) * 10) / 10,
        w: Math.round(r.width * 10) / 10,
        h: Math.round(r.height * 10) / 10,
      };
    });
    const view = doc.defaultView;
    return {
      canvas,
      dom,
      attrs: {
        className: el.className,
        size: el.dataset.size,
        orientation: el.dataset.orientation,
        display: view.getComputedStyle(el).display,
        texts: [...el.children].map((node) => node.textContent),
      },
      target: ws.positionOfRecord(message.id).target,
    };
  });
let target;
for (const orientation of ["vertical", "horizontal"])
  for (const size of ["sm", "md", "lg"]) {
    if (!target) target = (await snapshot()).target;
    const result = await exec(
      (c, ws, arg) =>
        c.setFields({
          targets: [arg.target],
          props: {
            size: { kind: "set", value: arg.size },
            orientation: { kind: "set", value: arg.orientation },
          },
        }),
      { target, size, orientation },
    );
    await page.waitForTimeout(600);
    const s = await snapshot();
    const same =
      s.canvas.length === 4 &&
      s.dom.length === 4 &&
      s.canvas.every((c, i) =>
        ["x", "y", "w", "h"].every((k) => Math.abs(c[k] - s.dom[i][k]) <= 1),
      );
    record(
      `${orientation} ${size}: Canvas boxes = Preview boxes (root + Illustration · Heading · Description)`,
      result.ok &&
        same &&
        s.attrs.orientation === orientation &&
        s.attrs.size === size &&
        s.attrs.display === (orientation === "vertical" ? "flex" : "grid"),
      { result, canvas: s.canvas, dom: s.dom, attrs: s.attrs },
    );
    await page.screenshot({ path: `${OUT}/${orientation}-${size}.png` });
  }
// The origin's `title` · `description` (the template binding) reach the Heading · Description.
const edit = await exec(
  (c, ws, arg) =>
    c.setFields({
      targets: [arg.target],
      props: {
        title: { kind: "set", value: "Nothing here" },
        description: { kind: "set", value: "Upload a file to start." },
      },
    }),
  { target },
);
await page.waitForTimeout(600);
const edited = await page.evaluate(() => {
  const root = window.__COMPOSITION_CATALOG__.workspace.root;
  const records = [...root.canvasInputs.values()];
  const text = (type) =>
    records.find((r) => root.typeOf(r) === type)?.props.children;
  const doc = document.querySelector("#previewFrame").contentDocument;
  const el = doc.querySelector(".react-aria-IllustratedMessage");
  return {
    canvas: [text("Heading"), text("Description")],
    preview: [...el.children].slice(1).map((node) => node.textContent),
  };
});
record(
  "origin title · description edit reaches the Heading · Description (Canvas · Preview)",
  edit.ok &&
    JSON.stringify(edited.canvas) ===
      JSON.stringify(["Nothing here", "Upload a file to start."]) &&
    JSON.stringify(edited.preview) === JSON.stringify(edited.canvas),
  { edit, ...edited },
);
await page.screenshot({ path: `${OUT}/edited.png` });
record("no errors", errors.length === 0, { errors: errors.slice(0, 6) });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors, url: page.url() }, null, 2),
);
await browser.close();
