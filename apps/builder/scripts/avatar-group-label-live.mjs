// AvatarGroup S2 label node live (사용자 2026-10-09 「AvatarGroup label 노드 전환 진행해」) — real
// Builder (headed Chrome, Compare Mode): the palette's AvatarGroup is `Avatar × 3 + Text {label}`; for
// xs · sm · md · lg · xl the Canvas boxes (root + children, relative to the root) equal the Preview's
// (±1px) and the label font is the Preview span's; the Preview root is `role="group"` named by the
// label; the first avatar sits at the group's start and each next one overlaps by a quarter of the
// avatar size (S2); an origin `label` edit reaches both; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/avatar-group-label-live.mjs <out>
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
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Avatar group label");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
await addFromPalette("avatar group");
await compareOn();
await page.waitForTimeout(800);
const snapshot = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const records = [...root.canvasInputs.values()];
    const group = records.find((r) => root.typeOf(r) === "AvatarGroup");
    const kids = records.filter((r) => r.parentId === group.id);
    const geo = (id) => root.getGeometry([id]).get(id);
    const base = geo(group.id);
    const box = (g, b) => ({
      x: Math.round((g.x - b.x) * 10) / 10,
      y: Math.round((g.y - b.y) * 10) / 10,
      w: Math.round(g.width * 10) / 10,
      h: Math.round(g.height * 10) / 10,
    });
    const canvas = [group, ...kids].map((r) => ({
      type: root.typeOf(r),
      ...box(geo(r.id), base),
    }));
    const label = kids.find((r) => root.typeOf(r) === "Text");
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el = doc.querySelector(`[data-catalog-id="${group.id}"]`);
    const rect = (node) => {
      const r = node.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    };
    const domBase = rect(el);
    const dom = [el, ...el.children].map((node) => box(rect(node), domBase));
    const span = el.lastElementChild;
    return {
      canvas,
      dom,
      font: {
        canvas: label?.visual.fontSize,
        dom: parseFloat(doc.defaultView.getComputedStyle(span).fontSize),
      },
      attrs: {
        role: el.getAttribute("role"),
        name: el.getAttribute("aria-label"),
        tag: span.tagName,
        text: span.textContent,
        canvasText: label?.props.children,
      },
      target: ws.positionOfRecord(group.id).target,
    };
  });
let target;
for (const size of ["xs", "sm", "md", "lg", "xl"]) {
  if (!target) target = (await snapshot()).target;
  const result = await exec(
    (c, ws, arg) =>
      c.setFields({
        targets: [arg.target],
        props: { size: { kind: "set", value: arg.size } },
      }),
    { target, size },
  );
  await page.waitForTimeout(600);
  const s = await snapshot();
  const same =
    s.canvas.length === 5 &&
    s.dom.length === 5 &&
    s.canvas.every((c, i) =>
      ["x", "y", "w", "h"].every((k) => Math.abs(c[k] - s.dom[i][k]) <= 1),
    );
  // S2: the first avatar at the group's start, each next one overlapping by a quarter of its size.
  const avatars = s.canvas.slice(1, 4);
  const overlap =
    avatars[0].x === 0 &&
    avatars
      .slice(1)
      .every((a, i) => a.x - (avatars[i].x + avatars[i].w) === -a.w / 4);
  record(
    `${size}: Canvas boxes = Preview boxes (root + Avatar × 3 + label) · first avatar at 0 · overlap ${avatars[0].w / 4} · label font ${s.font.canvas}px`,
    result.ok &&
      same &&
      overlap &&
      s.font.canvas === s.font.dom &&
      s.canvas[4].type === "Text",
    { result, canvas: s.canvas, dom: s.dom, font: s.font },
  );
  await page.screenshot({ path: `${OUT}/${size}.png` });
}
const edit = await exec(
  (c, ws, arg) =>
    c.setFields({
      targets: [arg.target],
      props: { label: { kind: "set", value: "Design team" } },
    }),
  { target },
);
await page.waitForTimeout(800);
const edited = await snapshot();
record(
  "origin `label` edit reaches the Canvas Text and the Preview span · group name",
  edit.ok &&
    edited.attrs.canvasText === "Design team" &&
    edited.attrs.text === "Design team" &&
    edited.attrs.name === "Design team" &&
    edited.attrs.role === "group" &&
    edited.attrs.tag === "SPAN",
  { edit, attrs: edited.attrs },
);
await page.screenshot({ path: `${OUT}/edited.png` });
record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
