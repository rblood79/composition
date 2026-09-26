#!/usr/bin/env node
// adr162-p6-row-values-live.mjs — ADR-162 Phase 6 live (실제 builder headed · Skia scene · layout map, Compare Mode · Preview 없음).
//   항목 origin 에 Image (src `{image}` · alt `{label}`) · Button (children `{action}`) 을 넣고 팔레트 GridList (ref instance) 에
//   static collection 3 행을 건다 → Canvas 카드마다 Image src · alt · Button 글자가 그 행 값인지, 카드 상자 · 자식 상자가 서는지.
// 사용: node apps/builder/scripts/adr162-p6-row-values-live.mjs [--base http://localhost:5173] [--shot-dir <dir>]
import { resolve, join } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const BASE = arg("--base", "http://localhost:5173");
const AUTH = arg("--auth", resolve("apps/builder/scripts/.auth-session.json"));
const SHOT_DIR = arg("--shot-dir", null);

const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass });
  console.log(
    `[adr162 p6 live] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail).slice(0, 3000)}`,
  );
};

const ORIGIN = "component-gridlist-item-default";
const ROWS = [
  { id: "r1", label: "Alpha", description: "first", image: "/appIcon.svg#alpha", action: "Open Alpha" },
  { id: "r2", label: "Beta", description: "second", image: "/appIcon.svg#beta", action: "Open Beta" },
  { id: "r3", label: "Gamma", description: "third", image: "/appIcon.svg#gamma", action: "Open Gamma" },
];

const browser = await chromium.launch({ headless: false });
const { page } = await createInstrumentedContext(browser, {
  storageState: loadStorageState(AUTH),
  cpuThrottle: 1,
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.stack ?? e).slice(0, 1200)));
page.on("dialog", (d) => d.dismiss().catch(() => {}));

try {
  await createIsolatedProject(page, BASE);
  await page.waitForTimeout(1500);
  await page.evaluate(async (ORIGIN) => {
    const st = window.__composition_STORE__.getState();
    const origin = st.elements.find((e) => e.id === ORIGIN);
    const now = new Date().toISOString();
    const el = (id, type, order, props) => ({
      id,
      customId: id,
      type,
      parent_id: ORIGIN,
      page_id: origin.page_id,
      order_num: order,
      created_at: now,
      updated_at: now,
      props,
    });
    await st.addComplexElement(
      el("p6-image", "Image", 9, {
        src: "{image}",
        alt: "{label}",
        style: { width: "48px", height: "48px" },
      }),
      [],
    );
    await st.addComplexElement(el("p6-button", "Button", 10, { children: "{action}" }), []);
  }, ORIGIN);

  // 팔레트 GridList — ref instance (ADR-234 상태 변형 origin 체인).
  const inst = await page.evaluate(async () => {
    const st = window.__composition_STORE__.getState();
    const before = new Set(st.elements.map((e) => e.id));
    return { before: [...before] };
  });
  void inst;
  const panelBtn = page.locator(".panel-toggle-rail button").nth(1);
  if ((await panelBtn.getAttribute("aria-pressed")) !== "true") {
    await panelBtn.click();
    await page.waitForTimeout(900);
  }
  const before = await page.evaluate(() =>
    window.__composition_STORE__.getState().elements.map((e) => e.id),
  );
  const search = page
    .locator('[data-panel-id="components"] input[type="search"], [data-panel-id="components"] input')
    .first();
  await search.fill("GridList");
  await page.waitForTimeout(400);
  const items = page.locator('[data-panel-id="components"] .list-item');
  const n = await items.count();
  for (let i = 0; i < n; i++) {
    const label = ((await items.nth(i).locator(".list-item-name").textContent()) ?? "")
      .replace(/\s+/g, "")
      .toLowerCase();
    if (label === "gridlist") {
      await items.nth(i).click();
      break;
    }
  }
  const ownerId = await page
    .waitForFunction(
      (before) =>
        window.__composition_STORE__
          .getState()
          .elements.find(
            (e) => (e.type === "GridList" || e.componentName === "GridList") && !before.includes(e.id),
          )?.id ?? null,
      before,
      { timeout: 15_000 },
    )
    .then((h) => h.jsonValue());
  await page.waitForTimeout(800);
  await panelBtn.click();
  await page.waitForTimeout(600);
  await page.evaluate(
    ({ ownerId, rows }) => {
      const st = window.__composition_STORE__.getState();
      st.updateElementProps(ownerId, {
        dataBinding: { type: "collection", source: "static", config: { data: rows } },
        layout: "grid",
        columns: 2,
        style: { width: "400px" },
      });
      st.setSelectedElement(null);
    },
    { ownerId, rows: ROWS },
  );
  await page.waitForTimeout(3000);
  await page.mouse.click(700, 600);
  await page.keyboard.press("Meta+0");
  await page.waitForTimeout(1500);

  const snap = await page.evaluate((ownerId) => {
    const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    const scene = window.__composition_SCENE_DEBUG__;
    const out = [];
    for (const [id, r] of map) {
      if (!id.includes(ownerId)) continue;
      const node = scene.readNode(id);
      const p = node?.props ?? {};
      out.push({
        id,
        rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
        src: p.src,
        alt: p.alt,
        children: typeof p.children === "string" ? p.children : undefined,
      });
    }
    return out;
  }, ownerId);
  console.log("[adr162 p6 live] nodes", JSON.stringify(snap).slice(0, 4000));

  for (const row of ROWS) {
    const card = snap.find((s) => s.id === `projection:gridlist-row:${ownerId}:${row.id}`);
    const kids = snap.filter((s) => s.id !== card?.id && s.id.includes(`:${row.id}`));
    const image = kids.find((k) => k.src != null);
    const button = kids.find((k) => k.children === row.action);
    record(
      `${row.id}: 카드 상자 · Image src/alt · Button 글자 = 행 값`,
      !!card &&
        card.rect[2] > 0 &&
        image?.src === row.image &&
        image?.alt === row.label &&
        image.rect[2] === 48 &&
        !!button &&
        button.rect[2] > 0,
      { card: card?.rect, image, button },
    );
  }
  const raw = snap.filter((s) => /\{(image|action|label)\}/.test(`${s.src ?? ""}${s.alt ?? ""}${s.children ?? ""}`));
  record("보간 안 된 `{field}` 원문 0", raw.length === 0, raw.slice(0, 4));
  if (SHOT_DIR) await page.screenshot({ path: join(SHOT_DIR, "p6-row-values.png") });
  record("page error 0", errors.length === 0, errors.slice(0, 3));
} finally {
  await browser.close();
}
const pass = findings.filter((f) => f.pass).length;
console.log(`[adr162 p6 live] ${pass}/${findings.length} ${pass === findings.length ? "PASS" : "FAIL"}`);
process.exit(pass === findings.length ? 0 : 1);
