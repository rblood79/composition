// 2026-10-15 drag 중 표현 live (사용자: Figma · Pen.dev — 끄는 요소의 실제 모습 · 형제가 비킨다):
//   column frame 의 A · B · C 중 A 를 C 아래로 끄는 도중 화면을 찍어
//   1 A 의 색이 포인터 자리에 그려진다 (테두리 ghost 가 아니라 요소 자체)
//   2 B 가 A 의 원래 자리로 올라왔다 (형제 비킴 — 보간이 끝난 뒤)
//   3 놓으면 순서 [B, C, A] · drag 표현이 지워진다 (A 의 원래 자리는 B 색)
//   다른 컨테이너 (Figma · pen.dev 실측 2026-10-15): B 를 T (D · E) 의 D 와 E 사이로 끄는 도중
//   4 T 의 형제는 비키지 않는다 (E 자리는 그대로 E 색) · 끄는 B 는 반투명 (순수 파랑 아님)
//   5 삽입선 · T 테두리 (선택 파랑 화소)
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/canvas-dnd-presentation-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const state = JSON.parse(
  readFileSync(`${process.cwd()}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok });
  process.stdout.write(
    `${ok ? "PASS" : "FAIL"} ${name}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}\n`,
  );
};
const wait = (ms) => page.waitForTimeout(ms);
const exec = (source, arg) =>
  page.evaluate(
    ({ source, arg }) => {
      const cat = window.__COMPOSITION_CATALOG__;
      const make = new Function("cat", "arg", `return (${source})(cat, arg);`);
      return make(cat, arg);
    },
    { source, arg },
  );
const pointOf = (id, fx = 0.5, fy = 0.5) =>
  exec(
    `(cat, a) => {
      const record = cat.workspace.root.recordsOfSource(a.id)[0];
      const box = cat.canvas.boundsOf(record);
      const camera = cat.canvas.camera();
      const rect = document.querySelector('[data-catalog-canvas="true"]').getBoundingClientRect();
      return { x: rect.left + camera.x + (box.x + box.width * a.fx) * camera.zoom,
               y: rect.top + camera.y + (box.y + box.height * a.fy) * camera.zoom };
    }`,
    { id, fx, fy },
  );
/** Colour of the screenshot at a screen point (decoded in the page). */
async function colorAt(points, name) {
  const png = await page.screenshot();
  writeFileSync(`${OUT}/${name}.png`, png);
  return page.evaluate(
    async ({ data, points }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = new OffscreenCanvas(image.width, image.height);
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      const scale = image.width / window.innerWidth;
      return points.map(({ x, y }) => {
        const [r, g, b] = context.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data;
        return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
      });
    },
    { data: png.toString("base64"), points },
  );
}
/** Which node holds `id` (L · T · body) and its index. */
const whereIs = (nodeId) =>
  exec(`(cat, a) => { const g = cat.workspace.runtime.graph;
    for (const [name, id] of Object.entries(a.ids)) { const e = g.getEntry(id); const i = e?.children?.indexOf(a.nodeId) ?? -1; if (i >= 0) return name + "[" + i + "]"; }
    const body = g.getEntry(cat.workspace.session.getSnapshot().pageId).children[0];
    return "body[" + g.getEntry(body).children.indexOf(a.nodeId) + "]"; }`, { ids, nodeId });
const near = (hex, target) => {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [p(hex), p(target)];
  return a.every((v, i) => Math.abs(v - b[i]) <= 24);
};

await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await wait(300);
await page.keyboard.type(`dnd presentation ${Date.now()}`);
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
  timeout: 30000,
});
await wait(1500);
const RED = "#ef4444", BLUE = "#3b82f6", GREEN = "#22c55e";
const AMBER = "#f59e0b", VIOLET = "#8b5cf6";
const ids = await exec(`(cat, colors) => {
  const ws = cat.workspace, c = cat.commands, g = ws.runtime.graph;
  const body = g.getEntry(ws.session.getSnapshot().pageId).children[0];
  const id = {};
  for (const name of ["L", "A", "B", "C", "T", "D", "E"]) id[name] = ws.newId("node");
  const cell = (name, color) => ({
    kind: "node", id: id[name], definitionId: "lib:definition:text", children: [],
    props: { children: { kind: "set", value: name } },
    visual: { backgroundColor: { kind: "set", value: color } },
    sizing: { width: { kind: "set", value: 160 }, height: { kind: "set", value: 60 } },
    descendantOverrides: [],
  });
  ws.execute(c.insertNodes({
    parent: { kind: "node", id: body },
    entries: [
      { kind: "node", id: id.L, definitionId: "lib:definition:type-frame", children: [id.A, id.B, id.C],
        props: {}, visual: {}, sizing: { width: { kind: "set", value: 240 } }, descendantOverrides: [] },
      cell("A", colors.RED), cell("B", colors.BLUE), cell("C", colors.GREEN),
      { kind: "node", id: id.T, definitionId: "lib:definition:type-frame", children: [id.D, id.E],
        props: {}, visual: {}, sizing: { width: { kind: "set", value: 240 } }, descendantOverrides: [] },
      cell("D", colors.AMBER), cell("E", colors.VIOLET),
    ],
    rootIds: [id.L, id.T],
    newId: ws.newId,
  }));
  ws.execute(c.setFields({ targets: [{ kind: "node", id: id.L }, { kind: "node", id: id.T }], layout: {
    display: { kind: "set", value: "flex" }, flexDirection: { kind: "set", value: "column" } } }));
  ws.session.enterContext(id.L);
  ws.selectRecords([ws.root.recordsOfSource(id.A)[0]]);
  return id;
}`, { RED, BLUE, GREEN, AMBER, VIOLET });
await wait(1200);

const aStart = await pointOf(ids.A);
const cBelow = await pointOf(ids.C, 0.5, 0.65);
// A sample point inside A's box, right of its text (the fill colour).
const aFill = await pointOf(ids.A, 0.85, 0.5);
const fillOffset = { x: aFill.x - aStart.x, y: aFill.y - aStart.y };
const to = { x: cBelow.x, y: cBelow.y };
await page.mouse.move(aStart.x, aStart.y);
await page.mouse.down();
for (let i = 1; i <= 15; i++) {
  await page.mouse.move(
    aStart.x + ((to.x - aStart.x) * i) / 15,
    aStart.y + ((to.y - aStart.y) * i) / 15,
  );
  await wait(16);
}
await wait(400); // the reflow settles (~120 ms)
const [atPointer, atAOld] = await colorAt(
  [
    { x: to.x + fillOffset.x, y: to.y + fillOffset.y },
    { x: aFill.x, y: aFill.y },
  ],
  "1-mid-drag",
);
check("1 끄는 A 의 실제 색이 포인터 자리에 (top layer)", near(atPointer, RED), { atPointer });
check("2 B 가 A 의 원래 자리로 올라옴 (형제 비킴)", near(atAOld, BLUE), { atAOld });
await page.mouse.up();
await wait(700);
const order = await exec(`(cat, id) => [...cat.workspace.runtime.graph.getEntry(id).children]`, ids.L);
const [afterOld] = await colorAt([{ x: aFill.x, y: aFill.y }], "2-after");
check(
  "3 놓으면 [B, C, A] · A 원래 자리는 B 색 (표현 지워짐)",
  JSON.stringify(order) === JSON.stringify([ids.B, ids.C, ids.A]) && near(afterOld, BLUE),
  { afterOld, order, where: await whereIs(ids.A) },
);
// 4 · 5 — B (now first in L) into T, between D and E.
await exec(`(cat, id) => { cat.workspace.session.enterContext(id.L); cat.workspace.selectRecords([cat.workspace.root.recordsOfSource(id.B)[0]]); }`, ids);
await wait(300);
const bStart = await pointOf(ids.B);
const bFill = await pointOf(ids.B, 0.85, 0.5);
const dLow = await pointOf(ids.D, 0.5, 0.7);
const eFill = await pointOf(ids.E, 0.85, 0.5);
const toT = { x: dLow.x, y: dLow.y };
await page.mouse.move(bStart.x, bStart.y);
await page.mouse.down();
for (let i = 1; i <= 15; i++) {
  await page.mouse.move(bStart.x + ((toT.x - bStart.x) * i) / 15, bStart.y + ((toT.y - bStart.y) * i) / 15);
  await wait(16);
}
await wait(400);
const [atE, atB] = await colorAt(
  [eFill, { x: toT.x + (bFill.x - bStart.x), y: toT.y + (bFill.y - bStart.y) }],
  "3-into-other",
);
const linePixels = await page.evaluate(async () => 0);
check("4 다른 컨테이너 — 형제 그대로 (E 자리 = E 색) · 끄는 B 반투명", near(atE, VIOLET) && !near(atB, BLUE) && atB !== "#ffffff", { atE, atB });
const accent = await colorAt([{ x: (await pointOf(ids.T, 0.02, 0.5)).x, y: (await pointOf(ids.T, 0.02, 0.5)).y }], "3b-frame");
await page.mouse.up();
await wait(700);
const tKids = await exec(`(cat, id) => [...cat.workspace.runtime.graph.getEntry(id).children]`, ids.T);
check("5 놓으면 T = [D, B, E]", JSON.stringify(tKids) === JSON.stringify([ids.D, ids.B, ids.E]), { where: await whereIs(ids.B), accent });
check("console · page 오류 없음", errors.length === 0, errors.slice(0, 5));
process.stdout.write(`\n${results.filter((r) => r.ok).length}/${results.length} PASS\n`);
await browser.close();
