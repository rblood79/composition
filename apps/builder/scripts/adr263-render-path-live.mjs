// ADR-263 Phase 2 · 3 live — 그리기 명령의 새 경로가 같은 상태의 선형 full 재기록과 같은 픽셀을 내는가.
//
//   viewport 공간 질의 경로 (Phase 2) · damage 부분 재기록 (Phase 3) 으로 그린 화면을 찍고, 같은 상태를
//   `__composition_RENDER_PATH_DEBUG__` 로 선형 실행 (컬링 점프 없음) · full 로 다시 그려 찍는다. oracle =
//   같은 상태의 full 재기록 (수정 전 경로). 편집 유형마다 어느 경로를 탔는지 dev 카운터로 같이 본다.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr263-render-path-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const state = JSON.parse(
  readFileSync(
    `${process.cwd()}/apps/builder/scripts/.auth-session.json`,
    "utf8",
  ),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail });
  process.stdout.write(
    `${ok ? "PASS" : "FAIL"} ${name}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}\n`,
  );
};
const wait = (ms) => page.waitForTimeout(ms);
const exec = (source, arg) =>
  page.evaluate(
    ({ source, arg }) =>
      new Function("cat", "arg", `return (${source})(cat, arg);`)(
        window.__COMPOSITION_CATALOG__,
        arg,
      ),
    { source, arg },
  );
const debug = (source) =>
  page.evaluate(
    (source) =>
      new Function("d", `return (${source})(d);`)(
        window.__composition_RENDER_PATH_DEBUG__,
      ),
    source,
  );
const counters = () =>
  page.evaluate(() => window.__composition_RENDER_COUNTERS__.snapshot());
const resetCounters = () =>
  page.evaluate(() => window.__composition_RENDER_COUNTERS__.reset());
const settle = async () => {
  await wait(350);
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
};

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await wait(300);
await page.keyboard.type(`adr263 render path ${Date.now()}`);
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
if (process.env.TRACE) {
  await page.goto(
    `${page.url()}${page.url().includes("?") ? "&" : "?"}adr189Metrics=1`,
  );
}
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForFunction(
  () => window.__composition_RENDER_PATH_DEBUG__?.forceFull,
  null,
  { timeout: 30000 },
);
await wait(1500);

// P (900 × 3,600 — 아래쪽은 화면 밖) > 색 상자 40 · 글자 8 · 중첩 묶음 1 (자식 4)
const ids = await exec(`(cat) => {
  const ws = cat.workspace, c = cat.commands, g = ws.runtime.graph;
  const body = g.getEntry(ws.session.getSnapshot().pageId).children[0];
  const set = (value) => ({ kind: "set", value });
  const id = { boxes: [], texts: [], inner: [] };
  id.P = ws.newId("node"); id.G = ws.newId("node");
  const colors = ["#60a5fa", "#34d399", "#fda4af", "#fbbf24", "#a78bfa", "#f472b6", "#94a3b8", "#22d3ee"];
  const entries = [];
  for (let i = 0; i < 40; i++) {
    const nid = ws.newId("node"); id.boxes.push(nid);
    entries.push({ kind: "node", id: nid, definitionId: "lib:definition:type-frame", children: [], props: {},
      visual: { backgroundColor: set(colors[i % 8]) },
      sizing: { width: set(70), height: set(50) },
      placement: { kind: "absolute", x: 20 + (i % 8) * 100, y: 20 + Math.floor(i / 8) * 1500 }, descendantOverrides: [] });
  }
  for (let i = 0; i < 8; i++) {
    const nid = ws.newId("node"); id.texts.push(nid);
    entries.push({ kind: "node", id: nid, definitionId: "lib:definition:text", children: [], props: { children: set("글자 " + i) },
      visual: {}, sizing: {}, placement: { kind: "absolute", x: 20 + (i % 4) * 200, y: 100 + Math.floor(i / 4) * 40 }, descendantOverrides: [] });
  }
  for (let i = 0; i < 4; i++) {
    const nid = ws.newId("node"); id.inner.push(nid);
    entries.push({ kind: "node", id: nid, definitionId: "lib:definition:type-frame", children: [], props: {},
      visual: { backgroundColor: set(colors[(i + 3) % 8]) },
      sizing: { width: set(40), height: set(40) }, descendantOverrides: [] });
  }
  entries.push({ kind: "node", id: id.G, definitionId: "lib:definition:type-frame", children: id.inner, props: {},
    visual: { backgroundColor: set("#e2e8f0") },
    layout: { display: set("flex") },
    sizing: { width: set(300), height: set(60) },
    placement: { kind: "absolute", x: 20, y: 200 }, descendantOverrides: [] });
  id.S = ws.newId("node"); id.T = ws.newId("node");
  entries.push({ kind: "node", id: id.T, definitionId: "lib:definition:type-frame", children: [], props: {},
    visual: { backgroundColor: set("#0ea5e9") }, sizing: { width: set(120), height: set(400) }, descendantOverrides: [] });
  entries.push({ kind: "node", id: id.S, definitionId: "lib:definition:type-frame", children: [id.T], props: {},
    visual: { backgroundColor: set("#fef3c7"), overflow: set("auto") },
    sizing: { width: set(200), height: set(150) },
    placement: { kind: "absolute", x: 520, y: 200 }, descendantOverrides: [] });
  entries.unshift({ kind: "node", id: id.P, definitionId: "lib:definition:type-frame",
    children: [...id.boxes, ...id.texts, id.G, id.S], props: {},
    visual: { backgroundColor: set("#f8fafc") },
    sizing: { width: set(900), height: set(7600) }, descendantOverrides: [] });
  ws.execute(c.insertNodes({ parent: { kind: "node", id: body }, entries, rootIds: [id.P], newId: ws.newId }));
  return id;
}`);
await settle();
await exec(
  `(cat, a) => {
  const b = cat.canvas.boundsOf(cat.workspace.root.recordsOfSource(a.P)[0]);
  cat.canvas.setCamera({ scale: 1, x: 120 - b.x, y: 80 - b.y });
  cat.workspace.selectRecords([]);
}`,
  ids,
);
await page.mouse.move(5, 995);
await settle();
await wait(2500); // 카메라 이동 뒤 viewport scrollbar 가 사라질 때까지

const canvasRect = await page.evaluate(() => {
  const r = document
    .querySelector('[data-catalog-canvas="true"]')
    .getBoundingClientRect();
  return {
    x: Math.round(r.left),
    y: Math.round(r.top),
    width: Math.round(r.width),
    height: Math.round(r.height),
  };
});
const shot = async (name) => {
  const buf = await page.screenshot({ clip: canvasRect });
  writeFileSync(`${OUT}/${name}.png`, buf);
  return buf.toString("base64");
};
/** 두 PNG 의 다른 픽셀 수 (페이지 안에서 decode). */
const diffPixels = (a, b) =>
  page.evaluate(
    async ([a, b]) => {
      const decode = async (b64) => {
        const bitmap = await createImageBitmap(
          await (await fetch(`data:image/png;base64,${b64}`)).blob(),
        );
        const c = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = c.getContext("2d");
        ctx.drawImage(bitmap, 0, 0);
        return ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
      };
      const [x, y] = await Promise.all([decode(a), decode(b)]);
      if (x.length !== y.length) return -1;
      let diff = 0;
      for (let i = 0; i < x.length; i += 4)
        if (
          x[i] !== y[i] ||
          x[i + 1] !== y[i + 1] ||
          x[i + 2] !== y[i + 2] ||
          x[i + 3] !== y[i + 3]
        )
          diff += 1;
      return diff;
    },
    [a, b],
  );

/** 지금 화면 (새 경로) ↔ 같은 상태를 선형 · full 로 다시 그린 화면. */
async function compareWithLinearFull(name) {
  const fresh = await shot(`${name}-a`);
  await debug(
    `(d) => { d.setLinearOnly(true); d.setDamageOff(true); d.forceFull(); }`,
  );
  await settle();
  const reference = await shot(`${name}-b`);
  await debug(`(d) => { d.setLinearOnly(false); d.setDamageOff(false); }`);
  return diffPixels(fresh, reference);
}

// 1. 정지 상태 full: viewport 공간 질의 경로 ↔ 선형
await resetCounters();
await debug(`(d) => d.forceFull()`);
await settle();
let c = await counters();
let diff = await compareWithLinearFull("1-viewport");
check(
  "1 viewport 경로 = 선형 full (픽셀 0 차)",
  diff === 0 && c.viewportSequences > 0,
  {
    diff,
    viewportSequences: c.viewportSequences,
    fallbacks: c.viewportFallbacks,
  },
);

async function editCase(label, file, source, expectDamage) {
  await resetCounters();
  await exec(source, ids);
  await settle();
  const k = await counters();
  const d = await compareWithLinearFull(file);
  const pathOk =
    expectDamage === null
      ? true
      : expectDamage
        ? k.contentDamageRenders > 0
        : k.contentDamageRenders === 0;
  check(label, d === 0 && pathOk, {
    diff: d,
    damage: k.contentDamageRenders,
    full: k.contentFullRenders,
    damageFallbacks: k.contentDamageFallbacks,
  });
}
const set = `(value) => ({ kind: "set", value })`;
const fields = (target, body) =>
  `(cat, a) => { const s = ${set}; cat.workspace.execute(cat.commands.setFields({ targets: [{ kind: "node", id: ${target} }], ${body} })); }`;

await editCase(
  "2 값 (fill) — damage · 픽셀 0",
  "2-fill",
  fields("a.boxes[3]", `visual: { backgroundColor: s("#111827") }`),
  true,
);
await editCase(
  "3 글자 길이 — damage · 픽셀 0",
  "3-text",
  fields(
    "a.texts[1]",
    `props: { children: s("글자가 길어졌다 — damage 확인") }`,
  ),
  true,
);
await editCase(
  "4 이동 — damage · 픽셀 0",
  "4-move",
  `(cat, a) => cat.workspace.execute(cat.commands.setWholeField({ targets: [{ kind: "node", id: a.boxes[5] }], field: "placement", value: { kind: "absolute", x: 560, y: 140 } }))`,
  true,
);
await editCase(
  "5 크기 — damage · 픽셀 0",
  "5-size",
  fields("a.boxes[6]", `sizing: { width: s(140), height: s(30) }`),
  true,
);
await editCase(
  "6 중첩 자식 크기 (형제 재배치) — damage · 픽셀 0",
  "6-sibling",
  fields("a.inner[0]", `sizing: { width: s(90) }`),
  true,
);
await editCase(
  "7 그림자 추가 (safe → unsafe) — full · 픽셀 0",
  "7-shadow-add",
  fields(
    "a.boxes[2]",
    `visual: { boxShadow: s("-30px 0 0 0 rgba(0,0,0,0.5)") }`,
  ),
  false,
);
await editCase(
  "8 그림자 제거 (unsafe → safe) — full · 픽셀 0 (잔상 없음)",
  "8-shadow-remove",
  fields("a.boxes[2]", `visual: { boxShadow: { kind: "remove" } }`),
  false,
);
await editCase(
  "9 그림자 뺀 뒤 다음 편집은 다시 damage",
  "9-after-shadow",
  fields("a.boxes[2]", `visual: { backgroundColor: s("#16a34a") }`),
  true,
);
await editCase(
  "10 삭제 — 픽셀 0",
  "10-delete",
  `(cat, a) => cat.workspace.execute(cat.commands.removeTargets({ targets: [{ kind: "node", id: a.boxes[1] }] }))`,
  null,
);

// 글자가 상자 밖으로 넘치는 편집 (R1 — 글자는 clipText 가 아니면 자르지 않는다)
await editCase(
  "10a 글자 상자 고정 (넘침 없음) — damage",
  "10a-text-box",
  fields("a.texts[2]", `sizing: { width: s(60), height: s(40) }`),
  true,
);
await editCase(
  "10b 새로 넘침 — damage 를 버리고 full · 픽셀 0",
  "10b-overflow-new",
  fields(
    "a.texts[2]",
    `props: { children: s("고정 상자를 넘는 아주 긴 글자 줄 하나 둘 셋") }`,
  ),
  false,
);
await editCase(
  "10c 넘쳤던 글자를 줄임 — full · 픽셀 0 (잔상 없음)",
  "10c-overflow-was",
  fields("a.texts[2]", `props: { children: s("짧게") }`),
  false,
);
await editCase(
  "10d 넘침이 사라진 뒤 다음 편집은 다시 damage",
  "10d-after-overflow",
  fields("a.texts[2]", `props: { children: s("짧다") }`),
  true,
);

// 10f page 밖 (body 가 잘라 보이지 않는) 요소 — 다시 그릴 것이 없다 (빈 damage, full 아님)
await editCase(
  "10f page 가 잘라 안 보이는 요소 — 빈 damage · 픽셀 0",
  "10f-clipped",
  fields("a.boxes[8]", `visual: { backgroundColor: s("#000000") }`),
  true,
);

// 10g scroll 상자: 휠로 내리고 → 내용을 늘리고 → 더 내린다 (범위 증분 · 스크롤 damage)
{
  const center = await exec(
    `(cat, a) => {
    const rec = cat.workspace.root.recordsOfSource(a.S)[0];
    cat.workspace.selectRecords([rec]);
    const b = cat.canvas.boundsOf(rec), c = cat.canvas.camera();
    const r = document.querySelector('[data-catalog-canvas="true"]').getBoundingClientRect();
    return { x: r.left + c.x + (b.x + b.width / 2) * c.zoom, y: r.top + c.y + (b.y + b.height / 2) * c.zoom };
  }`,
    ids,
  );
  const tTop = () =>
    exec(
      `(cat, a) => cat.canvas.boundsOf(cat.workspace.root.recordsOfSource(a.T)[0]).y`,
      ids,
    );
  const t0 = await tTop();
  await page.mouse.move(center.x, center.y);
  await page.mouse.wheel(0, 200);
  await settle();
  const t1 = await tTop();
  await exec(`(cat) => cat.workspace.selectRecords([])`);
  await page.mouse.move(5, 995);
  await settle();
  let d = await compareWithLinearFull("10g-scroll-1");
  check(
    "10g-1 휠 200 스크롤 (범위 250 안) = 선형 full",
    d === 0 && t0 - t1 === 200,
    { diff: d, moved: t0 - t1 },
  );
  await editCase(
    "10g-2 scroll 내용 늘림 — damage · 픽셀 0",
    "10g-grow",
    fields("a.T", `sizing: { height: s(700) }`),
    true,
  );
  await exec(
    `(cat, a) => cat.workspace.selectRecords([cat.workspace.root.recordsOfSource(a.S)[0]])`,
    ids,
  );
  await page.mouse.move(center.x, center.y);
  await page.mouse.wheel(0, 400);
  await settle();
  const t2 = await tTop();
  await exec(`(cat) => cat.workspace.selectRecords([])`);
  await page.mouse.move(5, 995);
  await settle();
  d = await compareWithLinearFull("10g-scroll-2");
  check(
    "10g-3 늘린 범위 (550) 까지 더 스크롤 = 선형 full",
    d === 0 && t0 - t2 === 550,
    { diff: d, moved: t0 - t2 },
  );
}

// 10e 화면 아래 padding 안 요소를 바꾸고 (damage 가 surface 로 잘린다) 화면으로 끌어온 camera-only blit
//     ↔ 같은 카메라의 선형 full. cleanup (200 ms) 전에 찍는다. 가장자리 scrollbar 는 비교에서 뺀다.
{
  // 줌 2 — 첫 줄 상자를 화면 아래 (padding 안) 로. 그 아래 page 안이라 clip 되지 않는다.
  await exec(
    `(cat, a) => { const b = cat.canvas.boundsOf(cat.workspace.root.recordsOfSource(a.boxes[4])[0]);
    cat.canvas.setCamera({ scale: 2, x: 300 - b.x * 2, y: 1100 - b.y * 2 }); }`,
    ids,
  );
  await wait(2500);
  await resetCounters();
  if (process.env.TRACE)
    await page.evaluate(() => window.__composition_DAMAGE_METRICS__?.reset());
  await exec(
    fields("a.boxes[4]", `visual: { backgroundColor: s("#7c3aed") }`),
    ids,
  );
  await settle();
  const k = await counters();
  if (process.env.TRACE)
    console.log(
      "TRACE",
      JSON.stringify(
        await page.evaluate(() =>
          window.__composition_DAMAGE_METRICS__
            ?.snapshot()
            .invalidationTrace.slice(-6),
        ),
      ),
    );
  await exec(
    `(cat, a) => { const b = cat.canvas.boundsOf(cat.workspace.root.recordsOfSource(a.boxes[4])[0]);
    cat.canvas.setCamera({ scale: 2, x: 300 - b.x * 2, y: 700 - b.y * 2 }); }`,
    ids,
  );
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  const inner = {
    ...canvasRect,
    width: canvasRect.width - 24,
    height: canvasRect.height - 24,
  };
  const blit = (await page.screenshot({ clip: inner })).toString("base64");
  await debug(
    `(d) => { d.setLinearOnly(true); d.setDamageOff(true); d.forceFull(); }`,
  );
  await settle();
  const full = (await page.screenshot({ clip: inner })).toString("base64");
  await debug(`(d) => { d.setLinearOnly(false); d.setDamageOff(false); }`);
  const d = await diffPixels(blit, full);
  check(
    "10e padding 안 damage → 끌어온 blit = 선형 full",
    d === 0 && k.contentDamageRenders > 0,
    { diff: d, k },
  );
}

// 11 · 12. 줌을 바꾼 뒤 정지 full: viewport ↔ 선형
for (const [n, zoom] of [
  [11, 0.5],
  [12, 2],
]) {
  await exec(
    `(cat, a) => { const b = cat.canvas.boundsOf(cat.workspace.root.recordsOfSource(a.P)[0]);
    cat.canvas.setCamera({ scale: ${zoom}, x: 120 - b.x * ${zoom}, y: 80 - b.y * ${zoom} }); }`,
    ids,
  );
  await wait(2500);
  await resetCounters();
  await debug(`(d) => d.forceFull()`);
  await settle();
  c = await counters();
  diff = await compareWithLinearFull(`${n}-zoom-${zoom}`);
  check(`${n} 줌 ${zoom} viewport = 선형 full`, diff === 0, {
    diff,
    viewportSequences: c.viewportSequences,
    fallbacks: c.viewportFallbacks,
  });
}

check("페이지 오류 0", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
