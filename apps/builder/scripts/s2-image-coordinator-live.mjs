#!/usr/bin/env node
// S2 ImageCoordinator live (2026-11-24, S2 체크리스트 부록 D.2 — 사용자 결정 「S2 레퍼런스 대로」):
//   팔레트 ImageCoordinator 를 놓고 그 안에 Image 셋 — A (빠름) · B (2.5 초 늦음) · C (빠름, group 「other」)
//   1. Canvas: 빈 ImageCoordinator 는 점선 자리 (스크린샷 1 — 1920 × 48) · Image 셋이 그 안
//   2. Design 패널: ImageCoordinator 에 Timeout · Image group 칸, Image 에 Image group 칸
//   3. Publish 0.8 초: A 는 받았지만 B 를 기다림 (loaded · 투명) · C 는 다른 group 이라 보임 (shown)
//   4. Publish 4 초: A · B 함께 보임 (shown · opacity 1)
//   5. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-image-coordinator-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-image-coordinator-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
// a 1×1 red PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64",
);
const HOST = "https://img.coordinator.test";

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
await context.route(`${HOST}/**`, async (route) => {
  if (route.request().url().includes("/slow-"))
    await new Promise((r) => setTimeout(r, 2500));
  await route.fulfill({ status: 200, contentType: "image/png", body: PNG });
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

try {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type("image coordinator live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
    timeout: 30000,
  });
  await page.waitForTimeout(1500);

  const empty = await page.evaluate(() => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const r = ws.root;
    const before = new Set(r.canvasInputs.keys());
    ws.execute(
      h.palette.catalogPaletteInsertPlan(
        {
          graph: ws.runtime.graph,
          records: r.domInputs,
          selection: () => [],
          itemOfRecord: (i) => ws.itemOfRecord(i),
          pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
          newId: ws.newId,
        },
        "ImageCoordinator",
      ).command,
    );
    const coordinator = [...r.canvasInputs.values()].find(
      (x) => r.typeOf(x) === "ImageCoordinator" && !before.has(x.id),
    );
    return { source: coordinator.sourceId, id: coordinator.id };
  });
  await page.waitForTimeout(800);
  // (the drop spot's engine box — `catalogEmptyDropSpot` 48 px)
  const emptyBox = await page.evaluate((source) => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    const rec = [...r.canvasInputs.values()].find(
      (x) => x.sourceId === source && r.typeOf(x) === "ImageCoordinator",
    );
    return { children: rec.children.length };
  }, empty.source);
  await page.screenshot({ path: `${OUT}/1-canvas-empty.png` });

  const placed = await page.evaluate(
    ({ coordinator, HOST }) => {
      const h = window.__COMPOSITION_CATALOG__;
      const ws = h.workspace;
      const r = ws.root;
      const out = {};
      for (const [key, file, group] of [
        ["A", "fast-a.png", ""],
        ["B", "slow-b.png", ""],
        ["C", "fast-c.png", "other"],
      ]) {
        const host = [...r.canvasInputs.values()].find(
          (x) => x.sourceId === coordinator && r.typeOf(x) === "ImageCoordinator",
        );
        ws.selectRecords([host.id]);
        const before = new Set(r.canvasInputs.keys());
        const plan = h.palette.catalogPaletteInsertPlan(
          {
            graph: ws.runtime.graph,
            records: r.domInputs,
            selection: () => ws.session.getSnapshot().selection,
            itemOfRecord: (i) => ws.itemOfRecord(i),
            pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
            newId: ws.newId,
          },
          "Image",
        );
        ws.execute(plan.command);
        const image = [...r.canvasInputs.values()].find(
          (x) => r.typeOf(x) === "Image" && !before.has(x.id),
        );
        ws.execute(
          h.commands.setFields({
            targets: [{ kind: "node", id: image.sourceId }],
            props: Object.fromEntries(
              Object.entries({
                src: `${HOST}/${file}`,
                alt: key,
                ...(group ? { group } : {}),
              }).map(([k, v]) => [k, { kind: "set", value: v }]),
            ),
          }),
        );
        const parent = r.canvasInputs.get(
          [...r.canvasInputs.values()].find((x) => x.sourceId === image.sourceId)
            .parentId,
        );
        out[key] = { source: image.sourceId, parentType: r.typeOf(parent) };
      }
      ws.selectRecords([]);
      return out;
    },
    { coordinator: empty.source, HOST },
  );
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/2-canvas-filled.png` });
  record(
    "1. Canvas — 빈 ImageCoordinator 는 점선 자리 · Image 셋이 그 안",
    emptyBox.children === 0 &&
      Object.values(placed).every((p) => p.parentType === "ImageCoordinator"),
    { emptyBox, placed },
  );

  // 2. Design panel
  let designOpen = false;
  const fieldsOf = async (source, type) => {
    await page.evaluate(
      ({ source, type }) => {
        const ws = window.__COMPOSITION_CATALOG__.workspace;
        const r = ws.root;
        const rec = [...r.canvasInputs.values()].find(
          (x) => x.sourceId === source && r.typeOf(x) === type,
        );
        ws.selectRecords([rec.id]);
      },
      { source, type },
    );
    const labels = await page.evaluate(() =>
      [...document.querySelectorAll("button[aria-label]")].map((b) =>
        b.getAttribute("aria-label"),
      ),
    );
    const design = labels.find((l) => /^(Design|디자인)$/i.test(l ?? ""));
    // (the Design button toggles the panel — open it once)
    if (design && !designOpen) {
      await page.locator(`button[aria-label="${design}"]`).first().click();
      designOpen = true;
    }
    await page.waitForTimeout(900);
    return page.evaluate(() => document.body.innerText);
  };
  const coordinatorPanel = await fieldsOf(empty.source, "ImageCoordinator");
  await page.screenshot({ path: `${OUT}/3-design-coordinator.png` });
  const imagePanel = await fieldsOf(placed.A.source, "Image");
  await page.screenshot({ path: `${OUT}/4-design-image.png` });
  const has = (text, ...labels) => labels.every((l) => text.includes(l));
  record(
    "2. Design 패널 — ImageCoordinator: Timeout · Image group / Image: Image group",
    (has(coordinatorPanel, "Timeout", "Image group") ||
      has(coordinatorPanel, "제한 시간", "이미지 묶음")) &&
      (imagePanel.includes("Image group") || imagePanel.includes("이미지 묶음")),
    {
      coordinator: ["Timeout", "Image group", "제한 시간", "이미지 묶음"].filter((l) =>
        coordinatorPanel.includes(l),
      ),
      image: ["Image group", "이미지 묶음"].filter((l) => imagePanel.includes(l)),
    },
  );
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
  await pub.waitForSelector('img[alt="C"]', { timeout: 60000 });
  const read = () =>
    pub.evaluate(() =>
      Object.fromEntries(
        ["A", "B", "C"].map((alt) => {
          const img = document.querySelector(`img[alt="${alt}"]`);
          return [
            alt,
            img && {
              state: img.parentElement.getAttribute("data-image-state"),
              opacity: getComputedStyle(img).opacity,
            },
          ];
        }),
      ),
    );
  await pub.waitForTimeout(800);
  const early = await read();
  await pub.screenshot({ path: `${OUT}/5-publish-early.png` });
  record(
    "3. Publish 0.8 초 — A 는 B 를 기다림 (loaded · 투명) · C (다른 group) 보임",
    early.A?.state === "loaded" &&
      early.A.opacity === "0" &&
      early.B?.state === "loading" &&
      early.C?.state === "shown",
    { early },
  );
  await pub.waitForTimeout(3500);
  const late = await read();
  await pub.screenshot({ path: `${OUT}/6-publish-late.png` });
  record(
    "4. Publish 4 초 — A · B 함께 보임",
    late.A?.state === "shown" &&
      late.B?.state === "shown" &&
      late.A.opacity === "1" &&
      late.B.opacity === "1",
    { late },
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
