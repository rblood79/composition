// ADR-256 Phase 7 판독 (Round 16) 수리 live — 값 바인딩 노드 트리 편집 4건, 실제 Builder (headed
// Chrome, Compare Mode 로 Preview 열림): R-1 (H1) detach 한 ProgressBar 의 값 글자를 작성 글자로
// 바꾸면 Canvas · Preview 둘 다 그 글자 · 값을 바꿔도 유지 / Label 에 새로 쓴 `{valueText}` 가 값을
// 읽음 · R-2 (M3) `{valueText}` Label 이 indeterminate 를 끄면 Canvas 에 다시 보임 · R-3 (M1)
// SliderFill 을 레퍼런스의 track frame (absolute · inset 0) 으로 감싸도 Canvas 채움 = Preview 채움 ·
// SliderTrack 을 frame 으로 감싸도 채움 · thumb 이 값 자리 · R-4 (M2) 프로젝트 변수로 쓴 valueLabel 을
// 바꾸면 Canvas 값 글자가 따라옴 · 저장 후 다시 열어 같음.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p7-review-live.mjs <out>
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
const errorsAt = [];
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
/** Run a catalog command in the page: `build(c, ws, find, arg)` returns the command. */
async function run(build, arg) {
  return page.evaluate(
    async ({ commands, build, arg }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      // `find(type, within)` — the first record of `type` (inside the first `within` record).
      const find = (type, within) => {
        const all = [...ws.root.canvasInputs.values()];
        const scope = within
          ? all.find((r) => ws.root.typeOf(r) === within)
          : undefined;
        const inScope = (r) => {
          if (!scope) return true;
          for (let c = r; c; c = ws.root.canvasInputs.get(c.parentId))
            if (c.id === scope.id) return true;
          return false;
        };
        return all.find((r) => ws.root.typeOf(r) === type && inScope(r));
      };
      try {
        ws.execute(
          new Function(
            "c",
            "ws",
            "find",
            "arg",
            `return (${build})(c, ws, find, arg);`,
          )(c, ws, find, arg),
        );
        await new Promise((r) => setTimeout(r, 500));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, build: build.toString(), arg },
  );
}
const frameEntry = (ws) => ({
  kind: "node",
  id: ws.newId("node"),
  definitionId: "lib:definition:type-frame",
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
});
/** A palette component on the page, detached (its parts are the author's own nodes). */
async function placeDetached(label, type) {
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectRecords([]),
  );
  await page.waitForTimeout(300);
  await addFromPalette(label);
  const result = await run(
    (c, ws, find, type) =>
      c.detachInstances({
        // (The last placed one — earlier ones are already detached.)
        ids: [
          [...ws.root.canvasInputs.values()]
            .filter((r) => ws.root.typeOf(r) === type)
            .at(-1).sourceId,
        ],
        newId: ws.newId,
      }),
    type,
  );
  await page.waitForTimeout(600);
  return result;
}
const preview = (fn, arg) =>
  page.evaluate(
    ({ fn, arg }) => {
      const doc = document.querySelector("#previewFrame")?.contentDocument;
      return new Function("doc", "arg", `return (${fn})(doc, arg);`)(doc, arg);
    },
    { fn: fn.toString(), arg },
  );
const press = async (selector) => {
  await page
    .frameLocator("#previewFrame")
    .locator(selector)
    .first()
    // (Compare Mode shrinks the Preview under the Builder header — RAC's virtual press.)
    .dispatchEvent("click");
  await page.waitForTimeout(800);
};
const closeOverlay = async () => {
  await page.frameLocator("#previewFrame").locator("body").press("Escape");
  await page.waitForTimeout(500);
};


// (The app's own module URL — a different URL is a separate store instance; Vite adds `?v=` / `?t=`.)
const dataUrl = () =>
  page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .find((name) => /\/stores\/data\.ts(\?|$)/.test(name)),
  );
/** The records of the last placed `type` root (by order) and its parts, Canvas + Preview. */
const probe = (rootType) =>
  page.evaluate((rootType) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const all = [...root.canvasInputs.values()];
    const owner = all.filter((r) => root.typeOf(r) === rootType).at(-1);
    const inside = (r) => {
      for (let c = r; c; c = root.canvasInputs.get(c.parentId))
        if (c.id === owner?.id) return true;
      return false;
    };
    const of = (type) => all.find((r) => root.typeOf(r) === type && inside(r));
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const el = (r) =>
      r && doc?.querySelector(`[data-catalog-id="${CSS.escape(r.id)}"]`);
    const parts = {};
    for (const type of [
      "Label",
      "ProgressBarValue",
      "ProgressBarFill",
      "ProgressBarTrack",
      "SliderTrack",
      "SliderFill",
      "SliderThumb",
    ]) {
      const r = of(type);
      if (!r) continue;
      const g = root.getGeometry([r.id]).get(r.id);
      const b = el(r)?.getBoundingClientRect();
      parts[type] = {
        id: r.id,
        source: r.sourceId,
        text: r.props.children ?? null,
        hidden: r.hidden === true,
        canvas: g ? [g.x, g.y, g.width, g.height].map((n) => Math.round(n * 10) / 10) : null,
        domText: el(r)?.textContent ?? null,
        dom: b ? [b.x, b.y, b.width, b.height].map((n) => Math.round(n * 10) / 10) : null,
      };
    }
    return { owner: owner?.id, ownerSource: owner?.sourceId, parts };
  }, rootType);
const setProps = (source, props) =>
  run(
    (c, ws, find, arg) =>
      c.setFields({
        targets: [{ kind: "node", id: arg.source }],
        props: Object.fromEntries(
          Object.entries(arg.props).map(([k, v]) => [k, { kind: "set", value: v }]),
        ),
      }),
    { source, props },
  );
const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;

await newProject("ADR-256 P7 review fixes");
await compareOn();

// R-1 (H1): a detached ProgressBar's value text replaced by the author's own text.
const r1a = await placeDetached("progress bar", "ProgressBar");
let p = await probe("ProgressBar");
const r1b = await setProps(p.ownerSource, { value: 30 });
const r1c = await setProps(p.parts.ProgressBarValue.source, { children: "custom" });
await page.waitForTimeout(800);
const r1Before = (await probe("ProgressBar")).parts.ProgressBarValue;
const r1d = await setProps(p.ownerSource, { value: 70 });
await page.waitForTimeout(800);
const r1After = (await probe("ProgressBar")).parts.ProgressBarValue;
record(
  "R-1a (H1) a detached ProgressBar's value text set to `custom`: Canvas and Preview show it, through a value edit to 70",
  r1a.ok && r1b.ok && r1c.ok && r1d.ok &&
    r1Before.text === "custom" && r1Before.domText === "custom" &&
    r1After.text === "custom" && r1After.domText === "custom",
  { r1Before, r1After },
);
const r1e = await setProps(p.parts.Label.source, { children: "Now {valueText}" });
await page.waitForTimeout(800);
const r1Label = (await probe("ProgressBar")).parts.Label;
record(
  "R-1b (H1) the detached Label written `Now {valueText}` reads the bar's value (70%) on both",
  r1e.ok && r1Label.text === "Now 70%" && r1Label.domText === "Now 70%",
  { r1Label },
);
errorsAt.push(["R-1", errors.length]);

// R-2 (M3): a Label bound to the bar's value text shows again when the bar stops being indeterminate.
await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.selectRecords([]));
await addFromPalette("progress bar");
p = await probe("ProgressBar");
const r2a = await setProps(p.ownerSource, {
  label: "{valueText}",
  value: 30,
  isIndeterminate: true,
});
await page.waitForTimeout(800);
const r2Before = (await probe("ProgressBar")).parts.Label;
const r2b = await setProps(p.ownerSource, { isIndeterminate: false });
await page.waitForTimeout(800);
const r2After = (await probe("ProgressBar")).parts.Label;
record(
  "R-2 (M3) a `{valueText}` Label: hidden while indeterminate, shown with 30% on the Canvas and the Preview after",
  r2a.ok && r2b.ok && r2Before.hidden === true &&
    r2After.hidden === false && r2After.text === "30%" && r2After.domText === "30%",
  { r2Before, r2After },
);
errorsAt.push(["R-2", errors.length]);

// R-3 (M1): the reference example's track frame around the SliderFill, and a frame around the track.
const r3a = await placeDetached("slider", "Slider");
let s = await probe("Slider");
const r3b = await setProps(s.ownerSource, { value: 30 });
const r3c = await run(
  (c, ws, find, arg) =>
    c.groupNodes({
      ids: [arg],
      group: {
        kind: "node",
        id: ws.newId("node"),
        definitionId: "lib:definition:type-frame",
        children: [],
        props: {},
        visual: {},
        sizing: {},
        descendantOverrides: [],
        layout: {
          position: { kind: "set", value: "absolute" },
          insetLeft: { kind: "set", value: "0px" },
          insetTop: { kind: "set", value: "0px" },
          insetRight: { kind: "set", value: "0px" },
          insetBottom: { kind: "set", value: "0px" },
        },
      },
      newId: ws.newId,
    }),
  s.parts.SliderFill.source,
);
await page.waitForTimeout(800);
const fillRatio = (x) => ({
  canvas: x.parts.SliderFill.canvas[2] / x.parts.SliderTrack.canvas[2],
  dom: x.parts.SliderFill.dom[2] / x.parts.SliderTrack.dom[2],
  canvasHeight: x.parts.SliderFill.canvas[3] === x.parts.SliderTrack.canvas[3],
  domHeight: near(x.parts.SliderFill.dom[3], x.parts.SliderTrack.dom[3]),
});
const r3Fill30 = fillRatio(await probe("Slider"));
const r3d = await setProps(s.ownerSource, { value: 70 });
await page.waitForTimeout(800);
const r3Fill70 = fillRatio(await probe("Slider"));
record(
  "R-3a (M1) a SliderFill in an absolute inset-0 frame: Canvas fill = Preview fill (30% → 70% of the track, full height)",
  r3a.ok && r3b.ok && r3c.ok && r3d.ok &&
    near(r3Fill30.canvas, 0.3, 0.01) && near(r3Fill30.dom, 0.3, 0.01) &&
    near(r3Fill70.canvas, 0.7, 0.01) && near(r3Fill70.dom, 0.7, 0.01) &&
    r3Fill30.canvasHeight && r3Fill30.domHeight,
  { r3Fill30, r3Fill70 },
);
const r3e = await placeDetached("slider", "Slider");
s = await probe("Slider");
const r3f = await setProps(s.ownerSource, { value: 30 });
const r3g = await run(
  (c, ws, find, arg) =>
    c.groupNodes({
      ids: [arg],
      group: {
        kind: "node",
        id: ws.newId("node"),
        definitionId: "lib:definition:type-frame",
        children: [],
        props: {},
        visual: {},
        sizing: {},
        descendantOverrides: [],
      },
      newId: ws.newId,
    }),
  s.parts.SliderTrack.source,
);
await page.waitForTimeout(800);
const t = await probe("Slider");
const thumbAt = (box, track) => (box[0] + box[2] / 2 - track[0]) / track[2];
const r3Track = {
  canvasFill: t.parts.SliderFill.canvas[2] / t.parts.SliderTrack.canvas[2],
  domFill: t.parts.SliderFill.dom[2] / t.parts.SliderTrack.dom[2],
  canvasThumb: thumbAt(t.parts.SliderThumb.canvas, t.parts.SliderTrack.canvas),
  domThumb: thumbAt(t.parts.SliderThumb.dom, t.parts.SliderTrack.dom),
};
record(
  "R-3b (M1) a SliderTrack in a frame: fill 30% and thumb at 30% on the Canvas and the Preview",
  r3e.ok && r3f.ok && r3g.ok &&
    near(r3Track.canvasFill, 0.3, 0.01) && near(r3Track.domFill, 0.3, 0.01) &&
    near(r3Track.canvasThumb, 0.3, 0.01) && near(r3Track.domThumb, 0.3, 0.01),
  { r3Track },
);
errorsAt.push(["R-3", errors.length]);

// R-4 (M2): a project variable in the bar's valueLabel — its change reaches the Canvas value text.
const data = await dataUrl();
const r4a = await page.evaluate(async (data) => {
  const { useDataStore } = await import(data);
  const projectId = location.pathname.split("/").filter(Boolean).at(-1);
  const created = await useDataStore.getState().createVariable({
    name: "caption",
    project_id: projectId,
    type: "string",
    defaultValue: "Before",
    persist: false,
    scope: "global",
  });
  return { id: created.id, projectId, data };
}, data);
await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.selectRecords([]));
await addFromPalette("progress bar");
p = await probe("ProgressBar");
const r4b = await setProps(p.ownerSource, { value: 30, valueLabel: "{{ caption }}" });
await page.waitForTimeout(800);
const r4Before = (await probe("ProgressBar")).parts.ProgressBarValue;
await page.evaluate(
  async ({ data, id }) => {
    const { useDataStore } = await import(data);
    await useDataStore.getState().updateVariable(id, { defaultValue: "After" });
  },
  { data, id: r4a.id },
);
await page.waitForTimeout(1000);
const r4After = (await probe("ProgressBar")).parts.ProgressBarValue;
record(
  "R-4 (M2) the bar's valueLabel `{{ caption }}`: the Canvas value text follows the variable (Before → After)",
  r4b.ok && r4Before.text === "Before" && r4After.text === "After",
  { r4a, r4Before, r4After },
);
errorsAt.push(["R-4", errors.length]);

// R-5: saved and reopened the same (the authored text · the bound Label · the framed fill).
await page.waitForTimeout(1500);
const projectUrl = page.url();
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
  timeout: 30000,
});
await page.waitForTimeout(2500);
const reopened = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const root = ws.root;
  const all = [...root.canvasInputs.values()];
  const texts = all
    .filter((r) => ["ProgressBarValue", "Label"].includes(root.typeOf(r)))
    .map((r) => r.props.children);
  const fills = all
    .filter((r) => root.typeOf(r) === "SliderFill")
    .map((r) => {
      let track = root.canvasInputs.get(r.parentId);
      while (track && root.typeOf(track) !== "SliderTrack")
        track = root.canvasInputs.get(track.parentId);
      const g = root.getGeometry([r.id, track.id]);
      return g.get(r.id).width / g.get(track.id).width;
    });
  return { texts, fills };
});
record(
  "R-5 saved and reopened: `custom` · `Now 70%` · the framed fills (70% · 30%) the same",
  page.url() === projectUrl &&
    reopened.texts.includes("custom") &&
    reopened.texts.includes("Now 70%") &&
    reopened.fills.some((f) => near(f, 0.7, 0.01)) &&
    reopened.fills.some((f) => near(f, 0.3, 0.01)),
  { reopened },
);
record("R-6 no page errors", errors.length === 0, { errorsAt, errors: errors.slice(0, 3) });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
