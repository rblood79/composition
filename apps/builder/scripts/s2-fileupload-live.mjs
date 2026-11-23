#!/usr/bin/env node
// FileUpload live (2026-11-23, S2 체크리스트 §4.1 FileUpload — 비활성 전달 · 목록 행 · 썸네일 · 오류 표시):
//   1. 비활성 FileUpload — Canvas: DropZone · Button 이 파생 isDisabled, Button 글자가 disabled 색 (≈198)
//   2. 비활성 FileUpload — Publish: Button · DropZone 이 data-disabled, 컨테이너 opacity 1 (옛 0.38 없음),
//      Button 글자 색 = Canvas 와 같은 단 (±16)
//   3. Publish 런타임 행 (endpoint 연결 · 미리보기 dry run · maxFileSize 1000 B · showPreview):
//      작은 PNG = 썸네일 40×40 + 그 오른쪽 ProgressBar · 오류 없음, 큰 파일 = 그 행 아래 S2 InlineAlert
//      (negative · 문장 · 코드는 data-code 만)
//   4. endpoint 없는 FileUpload — Preview 는 dry run 이라 막히지 않는다 (HC 규칙): 행이 나오고 경고 없음
//      (막힌 상태의 InlineAlert 는 단위 테스트 `fileUploadComponent` — E_ENGINE_UNAVAILABLE)
//   5. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-fileupload-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-fileupload-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1500)}\n`,
  );
};

// a 1×1 PNG (68 B) and a 2,000 B file over the 1,000 B limit
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const BIG = Buffer.alloc(2000, 7);

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

const darkest = (where, clip) =>
  where.screenshot({ clip }).then((png) =>
    where.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let best = [255, 255, 255];
      let lum = 765;
      for (let i = 0; i < d.length; i += 4) {
        const l = d[i] + d[i + 1] + d[i + 2];
        if (l < lum) {
          lum = l;
          best = [d[i], d[i + 1], d[i + 2]];
        }
      }
      return best;
    }, png.toString("base64")),
  );

try {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type("fileupload live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
    timeout: 30000,
  });
  await page.waitForTimeout(1500);

  // two FileUploads: A (disabled first, then an endpoint) · B (no endpoint)
  const placed = await page.evaluate(() => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const r = ws.root;
    const ctx = {
      graph: ws.runtime.graph,
      records: ws.root.domInputs,
      selection: () => [],
      itemOfRecord: (i) => ws.itemOfRecord(i),
      pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
      newId: ws.newId,
    };
    const ids = [];
    for (let i = 0; i < 2; i++) {
      const before = new Set(r.canvasInputs.keys());
      ws.execute(h.palette.catalogPaletteInsertPlan(ctx, "FileUpload").command);
      const rec = [...r.canvasInputs.values()].find(
        (x) => r.typeOf(x) === "FileUpload" && !before.has(x.id),
      );
      ids.push({ id: rec.id, source: rec.sourceId });
    }
    ws.execute(
      h.commands.setFields({
        targets: [{ kind: "node", id: ids[0].source }],
        props: { isDisabled: { kind: "set", value: true } },
      }),
    );
    ws.selectRecords([]);
    return ids;
  });
  await page.waitForTimeout(800);

  const inside = (fileUpload, type) =>
    page.evaluate(
      ({ fileUpload, type }) => {
        const r = window.__COMPOSITION_CATALOG__.workspace.root;
        const out = [];
        const visit = (id) => {
          const n = r.canvasInputs.get(id);
          if (!n) return;
          if (r.typeOf(n) === type) out.push({ id: n.id, disabled: n.derivedProps?.isDisabled === true });
          for (const k of n.children ?? []) visit(k);
        };
        visit(fileUpload);
        return out;
      },
      { fileUpload, type },
    );
  const zones = await inside(placed[0].id, "DropZone");
  const buttons = await inside(placed[0].id, "Button");
  await page.evaluate((id) => {
    const h = window.__COMPOSITION_CATALOG__;
    const b = h.canvas.boundsOf(id);
    h.canvas.setCamera({ scale: 1, x: 120 - b.x, y: 200 - b.y });
  }, buttons[0].id);
  await page.waitForTimeout(800);
  const clipOf = (id) =>
    page.evaluate((id) => {
      const h = window.__COMPOSITION_CATALOG__;
      const b = h.canvas.boundsOf(id);
      const cam = h.canvas.camera();
      const el =
        document.querySelector('[data-canvas-container="true"]') ??
        document.querySelector('[data-catalog-canvas="true"]');
      const rr = el.getBoundingClientRect();
      return { x: rr.left + b.x * cam.zoom + cam.x, y: rr.top + b.y * cam.zoom + cam.y, width: b.width * cam.zoom, height: b.height * cam.zoom };
    }, id);
  await page.screenshot({ path: `${OUT}/1-canvas-disabled.png` });
  const canvasButtonText = await darkest(page, await clipOf(buttons[0].id));
  record(
    "1. Canvas 비활성 — DropZone · Button 파생 isDisabled, Button 글자 disabled 색",
    zones.every((z) => z.disabled) && buttons.every((b) => b.disabled) && canvasButtonText[0] > 150,
    { zones, buttons, canvasButtonText },
  );

  const openPublish = async () => {
    const popup = context.waitForEvent("page", { timeout: 30000 });
    await page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .find((b) => ["Preview", "미리보기"].includes(b.getAttribute("aria-label")))
        ?.click(),
    );
    const pub = await popup;
    pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
    await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
    await pub.waitForSelector(".react-aria-FileUpload", { timeout: 60000 });
    await pub.waitForTimeout(1200);
    return pub;
  };

  let pub = await openPublish();
  const dom = await pub.evaluate((id) => {
    const root = document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
    // (the FileTrigger's Button — RAC DropZone holds a hidden button of its own)
    const button = [...root.querySelectorAll(".react-aria-Button")].find(
      (b) => !b.closest(".react-aria-DropZone"),
    );
    const zone = root.querySelector(".react-aria-DropZone");
    const b = button.getBoundingClientRect();
    return {
      opacity: getComputedStyle(root).opacity,
      buttonDisabled: button.hasAttribute("data-disabled") || button.disabled,
      zoneDisabled: zone?.hasAttribute("data-disabled"),
      clip: { x: b.x, y: b.y, width: b.width, height: b.height },
    };
  }, placed[0].id);
  await pub.screenshot({ path: `${OUT}/2-publish-disabled.png` });
  const pubButtonText = await darkest(pub, dom.clip);
  record(
    "2. Publish 비활성 — Button · DropZone data-disabled · opacity 1 · Button 글자 = Canvas (±16)",
    dom.buttonDisabled && dom.zoneDisabled && dom.opacity === "1" &&
      pubButtonText.every((v, i) => Math.abs(v - canvasButtonText[i]) <= 16),
    { dom, pubButtonText, canvasButtonText },
  );
  await pub.close();

  // A: enabled again, an upload endpoint (preview dry run — no bytes sent), 1,000 B limit, previews on
  await page.evaluate(async (fileUpload) => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const { useDataStore } = await import("/src/builder/stores/data.ts");
    const result = await useDataStore.getState().applyDataChange(
      {
        ops: [
          {
            op: "define_endpoint",
            endpoint: { name: "files", method: "POST", baseUrl: "https://upload.example.test", path: "/files" },
          },
        ],
        origin: "user",
      },
      { projectId: ws.runtime.graph.projectId },
    );
    ws.execute(
      h.commands.setFields({
        targets: [{ kind: "node", id: fileUpload }],
        props: {
          isDisabled: { kind: "set", value: false },
          endpoint: { kind: "set", value: result.endpointIds[0] },
          maxFileSize: { kind: "set", value: 1000 },
          showPreview: { kind: "set", value: true },
        },
      }),
    );
  }, placed[0].source);
  await page.waitForTimeout(800);

  pub = await openPublish();
  const inputOf = (id) =>
    pub.locator(`[data-catalog-id="${id}"] input[type=file]`).first();
  await inputOf(placed[0].id).setInputFiles([
    { name: "dot.png", mimeType: "image/png", buffer: PNG },
    { name: "big.bin", mimeType: "application/octet-stream", buffer: BIG },
  ]);
  await pub.waitForSelector(".react-aria-FileUpload-item", { timeout: 30000 });
  await pub.waitForTimeout(1500);
  await pub.screenshot({ path: `${OUT}/3-publish-rows.png` });
  const rows = await pub.evaluate((id) => {
    const root = document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
    return [...root.querySelectorAll(".react-aria-FileUpload-item")].map((item) => {
      const thumb = item.querySelector(".react-aria-FileUpload-thumb");
      const bar = item.querySelector(".react-aria-FileUpload-row > .react-aria-ProgressBar");
      const alert = item.querySelector(".react-aria-FileUpload-error");
      const tb = thumb?.getBoundingClientRect();
      const bb = bar?.getBoundingClientRect();
      const ab = alert?.getBoundingClientRect();
      return {
        status: item.getAttribute("data-status"),
        thumb: tb && { w: Math.round(tb.width), h: Math.round(tb.height), right: tb.right },
        bar: bb && { left: bb.left, top: bb.top, bottom: bb.bottom, width: Math.round(bb.width) },
        alert: alert && {
          code: alert.getAttribute("data-code"),
          variant: alert.getAttribute("data-variant"),
          role: alert.getAttribute("role"),
          text: alert.textContent,
          border: getComputedStyle(alert).borderTopColor,
          top: ab.top,
        },
      };
    });
  }, placed[0].id);
  const [small, big] = rows;
  record(
    "3. Publish 행 — 썸네일 40×40 · 그 오른쪽 ProgressBar · 큰 파일만 그 아래 InlineAlert (문장 · 코드는 data-code)",
    rows.length === 2 &&
      small.thumb?.w === 40 && small.thumb?.h === 40 && small.bar.left >= small.thumb.right && !small.alert &&
      big.alert?.code === "E_TOO_LARGE" && big.alert.variant === "negative" && big.alert.role === "alert" &&
      /(The file is larger than the allowed size\.|허용된 크기보다 큰 파일입니다\.)/.test(big.alert.text) &&
      !big.alert.text.includes("E_TOO_LARGE") &&
      big.alert.top >= big.bar.bottom,
    { rows },
  );

  await inputOf(placed[1].id).setInputFiles([
    { name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("hello") },
  ]);
  await pub.waitForTimeout(1500);
  const dry = await pub.evaluate((id) => {
    const root = document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
    return {
      rows: root.querySelectorAll(".react-aria-FileUpload-item").length,
      alerts: root.querySelectorAll(".react-aria-InlineAlert").length,
      status: root.querySelector(".react-aria-FileUpload-status")?.getAttribute("data-code") ?? null,
    };
  }, placed[1].id);
  await pub.screenshot({ path: `${OUT}/4-publish-dry-run.png`, fullPage: true });
  record(
    "4. endpoint 없는 FileUpload (Preview dry run) — 행 1 · 경고 0",
    dry.rows === 1 && dry.alerts === 0 && dry.status === null,
    { dry },
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
