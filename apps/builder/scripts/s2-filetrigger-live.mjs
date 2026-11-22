#!/usr/bin/env node
// S2 체크리스트 §4.1 FileTrigger live (2026-11-22) — S2 `<FileTrigger><Button>…</Button></FileTrigger>`:
// 원본 = FileTrigger (요소 없음 · display: contents) > Button. Canvas 와 Publish 가 같은가 (headed Chrome).
//   ① Canvas — FileTrigger > Button, FileTrigger 상자 = Button 상자, Button 은 내용 폭 (늘어나지 않음)
//   ② Publish — `.react-aria-FileTrigger` 요소 없음 · `button` 「Select files」 · 같은 상자 · file input
//   ③ Publish — 버튼을 누르면 파일 선택 창이 열린다 (RAC FileTrigger 의 press → input)
//   ④ FileUpload 안의 trigger 도 같은 구조 (Canvas · Publish)
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-filetrigger-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-filetrigger-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1200)}\n`,
  );
};

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1400, height: 800 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("S2 filetrigger live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  const canvas = await page.evaluate(() => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const ctx = () => ({
      graph: ws.runtime.graph,
      records: ws.root.domInputs,
      selection: () => ws.session.getSnapshot().selection,
      itemOfRecord: (i) => ws.itemOfRecord(i),
      pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
      newId: ws.newId,
    });
    const root = () => ws.root;
    const triggers = () =>
      [...root().canvasInputs.values()].filter(
        (r) => root().typeOf(r) === "FileTrigger",
      );
    const read = (trigger) => {
      const r = root();
      const kids = trigger.children.map((c) => r.canvasInputs.get(c));
      const g = (id) => r.getGeometry([id]).get(id);
      const button = kids[0];
      const text = button?.children
        .map((c) => r.canvasInputs.get(c))
        .find((p) => r.typeOf(p) === "Text" && !p.hidden);
      return {
        kids: kids.map((k) => r.typeOf(k)),
        label: text?.props.children,
        trigger: g(trigger.id),
        button: button && g(button.id),
      };
    };
    ws.selectRecords([]);
    ws.execute(h.palette.catalogPaletteInsertPlan(ctx(), "FileTrigger").command);
    const solo = read(triggers()[0]);
    ws.selectRecords([]);
    ws.execute(h.palette.catalogPaletteInsertPlan(ctx(), "FileUpload").command);
    const inUpload = read(
      triggers().find(
        (t) =>
          root().typeOf(root().canvasInputs.get(t.parentId)) !== "Body" &&
          t.id !== triggers()[0].id,
      ) ?? triggers()[1],
    );
    return { solo, inUpload };
  });
  const same = (a, b) =>
    a && b && ["width", "height"].every((k) => Math.abs(a[k] - b[k]) < 0.01);
  record(
    "① Canvas — FileTrigger > Button, the trigger's box is the Button's, the Button its content width",
    canvas.solo.kids.join() === "Button" &&
      canvas.solo.label === "Select files" &&
      same(canvas.solo.trigger, canvas.solo.button) &&
      canvas.solo.button.height === 32 &&
      canvas.solo.button.width < 200,
    canvas.solo,
  );
  record(
    "④ Canvas — a FileUpload's trigger is the same tree",
    canvas.inUpload.kids.join() === "Button" &&
      canvas.inUpload.label === "Select files",
    canvas.inUpload,
  );
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/1-canvas.png` });

  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) =>
        ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
      )
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.bringToFront();
  await pub.waitForURL((url) => String(url) !== "about:blank", {
    timeout: 30000,
  });
  await pub.waitForSelector("button:has-text('Select files')", {
    timeout: 60000,
  });
  await pub.waitForTimeout(800);
  const dom = await pub.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")].filter(
      (b) => b.textContent.trim() === "Select files",
    );
    const r = buttons[0].getBoundingClientRect();
    return {
      ownElements: document.querySelectorAll(".react-aria-FileTrigger").length,
      buttons: buttons.length,
      inUpload: buttons.some((b) => b.closest(".react-aria-FileUpload")),
      fileInputs: document.querySelectorAll('input[type="file"]').length,
      box: { width: Math.round(r.width * 100) / 100, height: r.height },
    };
  });
  record(
    "② Publish — no FileTrigger element of its own, the S2 Button with the Canvas box, a file input each",
    dom.ownElements === 0 &&
      dom.buttons === 2 &&
      dom.inUpload &&
      dom.fileInputs >= 2 &&
      Math.abs(dom.box.width - canvas.solo.button.width) < 1 &&
      Math.abs(dom.box.height - canvas.solo.button.height) < 0.5,
    { dom, canvas: canvas.solo.button },
  );
  await pub.screenshot({ path: `${OUT}/2-publish.png` });
  const chooser = pub.waitForEvent("filechooser", { timeout: 5000 });
  await pub.locator("button:has-text('Select files')").first().click();
  const opened = await chooser.then(
    (c) => ({ ok: true, multiple: c.isMultiple() }),
    (e) => ({ ok: false, error: String(e) }),
  );
  record("③ Publish — pressing the Button opens the file chooser", opened.ok, opened);
  record("no page errors", errors.length === 0, errors);
} finally {
  writeFileSync(
    `${OUT}/result.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
  process.stdout.write(
    `errors ${errors.length}: ${errors.slice(0, 5).join(" | ")}\n`,
  );
  await browser.close();
}
