// ADR-236 Phase 2 G2 — skia · layout 소비처 파생 (FORM_INHERITING_FIELD_TAGS · DATE_INPUT_PARENT_TAGS ·
// IMAGE_TAGS · IMAGE_INTRINSIC_TAGS) 전후 layout rect · Skia 픽셀 비교.
// 사용: node apps/builder/scripts/adr236-phase2-live.mjs <before|after>  →  output/playwright/adr236/<phase>/
//       node apps/builder/scripts/adr236-phase2-live.mjs compare
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { waitReady } from "./perf-baseline.mjs";

const RAIL_ORDER = [
  "navigator",
  "components",
  "datatable",
  "datatableEditor",
  "theme",
  "ai",
  "properties",
  "styles",
  "interactions",
  "history",
];
const OUT = "output/playwright/adr236";
const phase = process.argv[2] ?? "after";

if (phase === "compare") {
  // pngjs · pixelmatch 는 워크스페이스 직접 의존이 아니다 — pnpm store 경로로 읽는다.
  const store = resolve("node_modules/.pnpm");
  const { PNG } = await import(
    `${store}/pngjs@7.0.0/node_modules/pngjs/lib/png.js`
  );
  const { default: pixelmatch } = await import(
    `${store}/pixelmatch@7.2.0/node_modules/pixelmatch/index.js`
  );
  const [a, b] = await Promise.all(
    ["before", "after"].map((p) =>
      readFile(`${OUT}/${p}/rects.json`, "utf8").then(JSON.parse),
    ),
  );
  const rectDiff = a.rects.filter((r, i) => {
    const o = b.rects[i];
    return (
      !o ||
      o.type !== r.type ||
      ["x", "y", "width", "height"].some(
        (k) => Math.abs((o.rect?.[k] ?? NaN) - (r.rect?.[k] ?? NaN)) > 0.01,
      )
    );
  });
  const [pa, pb] = await Promise.all(
    ["before", "after"].map((p) =>
      readFile(`${OUT}/${p}/canvas.png`).then((buf) => PNG.sync.read(buf)),
    ),
  );
  const diffPng = new PNG({ width: pa.width, height: pa.height });
  const pixels = pixelmatch(
    pa.data,
    pb.data,
    diffPng.data,
    pa.width,
    pa.height,
    { threshold: 0 },
  );
  await writeFile(`${OUT}/diff.png`, PNG.sync.write(diffPng));
  console.log(
    JSON.stringify(
      {
        rects: a.rects.length,
        rectDiff: rectDiff.length,
        rectDiffSample: rectDiff.slice(0, 5),
        pixelDiff: pixels,
        size: [pa.width, pa.height],
      },
      null,
      2,
    ),
  );
  process.exit(rectDiff.length === 0 && pixels === 0 ? 0 : 1);
}

async function setPanel(page, panelId, open) {
  const button = page
    .locator(".panel-toggle-rail button")
    .nth(RAIL_ORDER.indexOf(panelId));
  if (((await button.getAttribute("aria-pressed")) === "true") !== open) {
    await button.click();
    await page.waitForTimeout(900);
  }
}

async function addFromPalette(page, type, parentId = null) {
  await setPanel(page, "components", true);
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    parentId,
  );
  await page.waitForTimeout(300);
  const before = await page.evaluate(() =>
    window.__composition_STORE__.getState().elements.map((e) => e.id),
  );
  const search = page
    .locator(
      '[data-panel-id="components"] input[type="search"], [data-panel-id="components"] input',
    )
    .first();
  await search.waitFor({ state: "visible", timeout: 20_000 });
  await search.fill(type);
  await page.waitForTimeout(400);
  const items = page.locator(`[data-panel-id="components"] .list-item`);
  const n = await items.count();
  let item = null;
  for (let i = 0; i < n; i++) {
    const label =
      (await items.nth(i).locator(".list-item-name").textContent()) ?? "";
    if (label.replace(/\s+/g, "").toLowerCase() === type.toLowerCase()) {
      item = items.nth(i);
      break;
    }
  }
  if (!item) throw new Error(`팔레트에 ${type} 없음 (${n} items)`);
  await item.click();
  const id = await page
    .waitForFunction(
      ({ t, before }) =>
        window.__composition_STORE__
          .getState()
          .elements.find(
            (e) =>
              (e.type === t || e.componentName === t) && !before.includes(e.id),
          )?.id ?? null,
      { t: type, before },
      { timeout: 15_000 },
    )
    .then((h) => h.jsonValue())
    .catch(() => null);
  await page.waitForTimeout(800);
  if (!id) throw new Error(`${type} 미생성`);
  return id;
}

const out = `${OUT}/${phase}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  storageState: resolve("apps/builder/scripts/.auth-session.json"),
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
try {
  await page.goto("http://localhost:5173/dashboard", {
    waitUntil: "networkidle",
  });
  await page.locator("button.dashboard-create-button").first().click();
  const name = page.locator("#new-project-name");
  await name.fill("adr236-g2"); // 전후 같은 이름 — 헤더 픽셀이 갈리지 않게
  await name.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90000 });
  await waitReady(page);
  await page.bringToFront();

  const root = await addFromPalette(page, "frame");
  await page.evaluate(
    (id) =>
      window.__composition_STORE__.getState().updateElementProps(id, {
        style: {
          display: "flex",
          flexDirection: "column",
          width: "640px",
          gap: "12px",
          padding: "12px",
        },
      }),
    root,
  );
  const form = await addFromPalette(page, "Form", root);
  const fixture = { root, form, placed: {} };
  // textInputField (Form 상속) — Form 안.
  for (const type of ["TextField", "NumberField"]) {
    fixture.placed[type] = await addFromPalette(page, type, form);
  }
  // dateField · image — frame 안.
  for (const type of ["DateField", "DatePicker", "Image", "Avatar"]) {
    fixture.placed[type] = await addFromPalette(page, type, root);
  }
  await setPanel(page, "components", false);
  await page.evaluate(() =>
    window.__composition_STORE__.getState().setSelectedElement(null),
  );
  await page.mouse.move(720, 450);
  await page.keyboard.press("Meta+0"); // Fit to Screen — 전후 같은 viewport
  await page.mouse.move(2, 880);
  await page.waitForTimeout(2500);

  const rects = await page.evaluate((rootId) => {
    const st = window.__composition_STORE__.getState();
    const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    const byParent = new Map();
    for (const e of st.elements) {
      const list = byParent.get(e.parent_id) ?? [];
      list.push(e);
      byParent.set(e.parent_id, list);
    }
    const outRects = [];
    const visit = (id, depth, path) => {
      const el = st.elements.find((e) => e.id === id);
      const l = map?.get(id);
      outRects.push({
        path,
        depth,
        type: el?.type,
        rect: l ? { x: l.x, y: l.y, width: l.width, height: l.height } : null,
      });
      const kids = (byParent.get(id) ?? []).sort(
        (a, b) => (a.order_num ?? 0) - (b.order_num ?? 0),
      );
      kids.forEach((k, i) => visit(k.id, depth + 1, `${path}/${i}`));
    };
    visit(rootId, 0, "0");
    return outRects;
  }, root);
  await writeFile(
    `${out}/rects.json`,
    JSON.stringify({ fixture, rects }, null, 2),
  );
  const canvas = page.locator("canvas").first();
  await canvas.screenshot({ path: `${out}/canvas.png` });
  console.log(
    JSON.stringify({
      phase,
      elements: rects.length,
      nullRects: rects.filter((r) => !r.rect).length,
      errors,
    }),
  );
} finally {
  await browser.close();
}
