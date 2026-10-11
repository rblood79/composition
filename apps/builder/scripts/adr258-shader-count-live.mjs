#!/usr/bin/env node
// adr258-shader-count-live.mjs — ADR-258 G5 (R7): how many gradient shaders the Canvas makes for
//   a page of Color controls. CanvasKit's `Shader.MakeLinearGradient` / `MakeSweepGradient` are
//   wrapped in the page (a count, no code change) and three phases are read: idle frames (the
//   camera still), one value edit on one control, and a camera pan (the content redrawn).
//   Each phase runs twice — the same numbers twice = a deterministic (A-grade) count.
// Use: node apps/builder/scripts/adr258-shader-count-live.mjs <outDir> [--controls 10]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const H = resolve("apps/builder/scripts/adr256-g5/harness.mjs");
const { launch, newProject } = await import(H);
const OUT = process.argv[2] ?? "/private/tmp/adr258-shaders";
const N = Number(process.argv[process.argv.indexOf("--controls") + 1]) || 10;
mkdirSync(OUT, { recursive: true });
const COMMANDS = `/@fs${process.cwd()}/packages/shared/src/catalog/commands/index.ts`;
// (The app's own module URL — a `/@fs` import would be a second instance with no CanvasKit.)
const CK = "/src/builder/workspace/canvas/skia/initCanvasKit.ts";

const { browser, page, errors } = await launch();
await newProject(page, `adr258-g5-${Date.now()}`);

// N controls: ColorArea · ColorSlider · ColorWheel in turn (hsl ColorAreas — two layers each).
const ids = await page.evaluate(
  async ({ COMMANDS, N }) => {
    const c = await import(COMMANDS);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const body = [...ws.root.canvasInputs.values()].find((r) =>
      r.sourceId.endsWith("home-body"),
    );
    const kinds = [
      ["colorarea", { defaultValue: "hsl(210, 60%, 40%)", colorSpace: "hsl" }],
      ["colorslider", { defaultValue: "hsl(200, 80%, 50%)" }],
      ["colorwheel", { defaultValue: "hsl(90, 100%, 50%)" }],
    ];
    const entries = Array.from({ length: N }, (_, i) => {
      const [origin, props] = kinds[i % 3];
      return {
        kind: "node",
        id: ws.newId("node"),
        definitionId: `lib:definition:origin-component-${origin}`,
        children: [],
        props: Object.fromEntries(
          Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
        ),
        visual: {},
        sizing: {},
        descendantOverrides: [],
      };
    });
    ws.execute(
      c.insertNodes({
        parent: { kind: "node", id: body.sourceId },
        entries,
        rootIds: entries.map((e) => e.id),
        newId: ws.newId,
      }),
    );
    ws.selectRecords?.([]);
    await new Promise((r) => setTimeout(r, 2000));
    return entries.map((e) => e.id);
  },
  { COMMANDS, N },
);

await page.evaluate(async (CK) => {
  const { getCanvasKit } = await import(CK);
  const ck = getCanvasKit();
  const count = (window.__ADR258_SHADERS__ = { linear: 0, sweep: 0 });
  const linear = ck.Shader.MakeLinearGradient.bind(ck.Shader);
  const sweep = ck.Shader.MakeSweepGradient.bind(ck.Shader);
  ck.Shader.MakeLinearGradient = (...a) => (count.linear++, linear(...a));
  ck.Shader.MakeSweepGradient = (...a) => (count.sweep++, sweep(...a));
}, CK);

const reset = () =>
  page.evaluate(() =>
    Object.assign(window.__ADR258_SHADERS__, { linear: 0, sweep: 0 }),
  );
const read = () => page.evaluate(() => ({ ...window.__ADR258_SHADERS__ }));
const frames = (n) =>
  page.evaluate(
    (n) =>
      new Promise((r) => {
        let k = 0;
        const f = () => (++k >= n ? r() : requestAnimationFrame(f));
        requestAnimationFrame(f);
      }),
    n,
  );

const runs = [];
for (let run = 0; run < 2; run++) {
  await frames(30);
  await reset();
  await frames(60);
  const idle = await read();

  await reset();
  await page.evaluate(
    async ({ COMMANDS, id, run }) => {
      const c = await import(COMMANDS);
      window.__COMPOSITION_CATALOG__.workspace.execute(
        c.setFields({
          targets: [{ kind: "node", id }],
          props: {
            defaultValue: {
              kind: "set",
              value: run ? "hsl(30, 60%, 40%)" : "hsl(120, 60%, 40%)",
            },
          },
        }),
      );
    },
    { COMMANDS, id: ids[0], run },
  );
  await frames(60);
  const edit = await read();

  await reset();
  await page.evaluate(() => {
    const cat = window.__COMPOSITION_CATALOG__.canvas;
    const cam = cat.camera();
    cat.setCamera({ ...cam, x: cam.x + 7 });
  });
  await frames(60);
  const pan = await read();
  runs.push({ idle, edit, pan });
  console.log(
    `run ${run}: idle ${JSON.stringify(idle)} · one value edit ${JSON.stringify(edit)} · pan ${JSON.stringify(pan)}`,
  );
}
const same = JSON.stringify(runs[0]) === JSON.stringify(runs[1]);
console.log(
  `controls ${N} · deterministic ${same} · page errors ${errors.length}`,
);
writeFileSync(
  `${OUT}/shaders.json`,
  JSON.stringify({ controls: N, runs, same, errors }, null, 2),
);
await browser.close();
