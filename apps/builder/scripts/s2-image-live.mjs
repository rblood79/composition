#!/usr/bin/env node
// S2 Image live (2026-11-23, S2 체크리스트 부록 D.2 — 사용자 결정 「속성 · 런타임」 · 「오류 대체 내용」):
//   A: 정상 data URL + loading=lazy · fetchPriority=high · width/height
//   B: 받을 수 없는 URL + 안에 Text 「no picture」 (S2 renderError)
//   C: src 없음 + 안에 Text 「no picture」
//   1. Canvas: B 의 Text 숨김 (source 있음) · C 의 Text 보임 (source 없음)
//   2. Publish A: img 보임 (state shown · opacity 1) · loading / fetchpriority / width / height 속성
//   3. Publish B: 받다가 오류 → img 대신 「no picture」 (state error) · C: 처음부터 「no picture」 (state empty)
//   4. Design 패널: Image 를 골라도 Cross origin · Loading … 칸이 없다 (11-11 속성 감사 — editorHidden)
//   5. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-image-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-image-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
// a 4×4 red picture
const RED =
  "data:image/svg+xml," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='4' height='4'><rect width='4' height='4' fill='#ff0000'/></svg>",
  );
const BROKEN = "https://invalid.example.test/missing.png";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1500)}\n`,
  );
};

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

try {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type("image live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
    timeout: 30000,
  });
  await page.waitForTimeout(1500);

  const placed = await page.evaluate(
    ({ RED, BROKEN }) => {
      const h = window.__COMPOSITION_CATALOG__;
      const ws = h.workspace;
      const r = ws.root;
      const ctx = (parent) => ({
        graph: ws.runtime.graph,
        records: ws.root.domInputs,
        selection: () => [],
        itemOfRecord: (i) => ws.itemOfRecord(i),
        pageContent: () => parent,
        newId: ws.newId,
      });
      const body = { kind: "node", id: "project:node:home-body" };
      const add = (type, parent) => {
        const before = new Set(r.canvasInputs.keys());
        ws.execute(h.palette.catalogPaletteInsertPlan(ctx(parent), type).command);
        return [...r.canvasInputs.values()].find(
          (x) => r.typeOf(x) === type && !before.has(x.id),
        );
      };
      const set = (source, props) =>
        ws.execute(
          h.commands.setFields({
            targets: [{ kind: "node", id: source }],
            props: Object.fromEntries(
              Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
            ),
          }),
        );
      const out = {};
      for (const [key, src] of [["A", RED], ["B", BROKEN], ["C", ""]]) {
        const image = add("Image", body);
        set(image.sourceId, {
          src,
          alt: key === "A" ? "red square" : "",
          ...(key === "A"
            ? { loading: "lazy", fetchPriority: "high", width: 4, height: 4 }
            : {}),
        });
        if (key !== "A") {
          const text = add("Text", { kind: "node", id: image.sourceId });
          set(text.sourceId, { children: "no picture" });
        }
        out[key] = image.sourceId;
      }
      ws.selectRecords([]);
      return out;
    },
    { RED, BROKEN },
  );
  await page.waitForTimeout(1200);

  const canvas = await page.evaluate((placed) => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    const out = {};
    for (const [key, source] of Object.entries(placed)) {
      const image = [...r.canvasInputs.values()].find(
        (x) => x.sourceId === source && r.typeOf(x) === "Image",
      );
      const child = image.children[0] && r.canvasInputs.get(image.children[0]);
      out[key] = child ? { childHidden: child.hidden === true } : { childHidden: null };
    }
    return out;
  }, placed);
  await page.screenshot({ path: `${OUT}/1-canvas.png` });
  record(
    "1. Canvas — B (source 있음) 의 Text 숨김 · C (source 없음) 의 Text 보임",
    canvas.B.childHidden === true && canvas.C.childHidden === false,
    { canvas },
  );

  // 4. Design panel — no fetch attribute fields for an Image
  await page.evaluate((source) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const r = ws.root;
    const image = [...r.canvasInputs.values()].find(
      (x) => x.sourceId === source && r.typeOf(x) === "Image",
    );
    ws.selectRecords([image.id]);
  }, placed.A);
  const labels = await page.evaluate(() =>
    [...document.querySelectorAll("button[aria-label]")].map((b) => b.getAttribute("aria-label")),
  );
  const design = labels.find((l) => /^(Design|디자인)$/i.test(l ?? ""));
  if (design) await page.locator(`button[aria-label="${design}"]`).first().click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/2-design-panel.png` });
  const panelText = await page.evaluate(() => document.body.innerText);
  const leaked = ["Cross origin", "Fetch priority", "Referrer policy", "Intrinsic width", "Decoding"].filter(
    (label) => panelText.includes(label),
  );
  record("4. Design 패널 — Image 의 img 속성 칸 없음", leaked.length === 0, { leaked });
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.selectRecords([]));

  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => ["Preview", "미리보기"].includes(b.getAttribute("aria-label")))
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector(".react-aria-Image", { timeout: 60000 });
  await pub.waitForTimeout(2500);
  await pub.screenshot({ path: `${OUT}/3-publish.png` });
  const dom = await pub.evaluate((placed) => {
    const out = {};
    const boxes = [...document.querySelectorAll(".react-aria-Image")];
    const keys = Object.keys(placed);
    boxes.forEach((box, i) => {
      const img = box.querySelector("img");
      out[keys[i]] = {
        state: box.getAttribute("data-image-state"),
        text: box.innerText.trim(),
        img: img && {
          opacity: getComputedStyle(img).opacity,
          loading: img.getAttribute("loading"),
          fetchpriority: img.getAttribute("fetchpriority"),
          width: img.getAttribute("width"),
          height: img.getAttribute("height"),
        },
        center: (() => {
          const b = box.getBoundingClientRect();
          return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
        })(),
      };
    });
    return out;
  }, placed);
  // (the picture covers the box — its center pixel is the picture's red)
  const centerPx = await pub
    .screenshot({ clip: { x: dom.A.center.x, y: dom.A.center.y, width: 1, height: 1 } })
    .then((png) =>
      pub.evaluate(async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = c.height = 1;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0);
        return Array.from(g.getImageData(0, 0, 1, 1).data).slice(0, 3);
      }, png.toString("base64")),
    );
  dom.A.centerPx = centerPx;
  record(
    "2. Publish A — img 보임 (가운데 픽셀 빨강) · loading / fetchpriority / width / height 속성",
    dom.A?.state === "shown" && dom.A.img?.opacity === "1" && dom.A.img.loading === "lazy" &&
      centerPx[0] > 200 && centerPx[1] < 60 && centerPx[2] < 60 &&
      dom.A.img.fetchpriority === "high" && dom.A.img.width === "4" && dom.A.img.height === "4",
    { A: dom.A },
  );
  record(
    "3. Publish B — 오류 → 「no picture」 · C — source 없음 → 「no picture」",
    dom.B?.state === "error" && dom.B.text === "no picture" && !dom.B.img &&
      dom.C?.state === "empty" && dom.C.text === "no picture" && !dom.C.img,
    { B: dom.B, C: dom.C },
  );
} catch (e) {
  record("run", false, { error: String(e?.stack ?? e) });
} finally {
  record("5. page error 0", errors.length === 0, { errors });
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(`\n${results.length - failed}/${results.length} PASS\n`);
  process.exit(failed ? 1 : 0);
}
