#!/usr/bin/env node
// S2 체크리스트 §4.1 Sheet live (2026-11-22, 사용자 결정 「S2 값 그대로」) — S2 Modal + Dialog 값:
// 폭 480 · 안쪽 여백 32 · 닫기 버튼 = 끝 정렬 ButtonGroup (본문과 32) · backdrop fade 250 / 130.
//   ① Canvas (Open) — Sheet 480 · 제목 (32, 32) · Close 가 ButtonGroup 안 · 오른쪽 · 아래 32 · 본문과 32
//   ② Publish — 트리거로 열고 같은 값 (rect), backdrop 이 투명에서 시작해 1 로 (fade in)
//   ③ Publish — Close 가 닫는다 (RAC close slot — ButtonGroup 너머), 닫히는 동안 overlay (backdrop + 본체)
//      가 130ms 동안 투명해진다 — RAC 는 overlay 자신의 애니메이션만 기다린다
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-sheet-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-sheet-live";
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
  await page.keyboard.type("S2 sheet live");
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
    const set = (value) => ({ kind: "set", value });
    const ctx = () => ({
      graph: ws.runtime.graph,
      records: ws.root.domInputs,
      selection: () => ws.session.getSnapshot().selection,
      itemOfRecord: (i) => ws.itemOfRecord(i),
      pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
      newId: ws.newId,
    });
    ws.selectRecords([]);
    ws.execute(h.palette.catalogPaletteInsertPlan(ctx(), "Sheet").command);
    const trigger = [...ws.root.domInputs.values()].find(
      (r) => ws.root.typeOf(r) === "SheetTrigger",
    );
    const open = (value) =>
      ws.execute(
        h.commands.setFields({
          targets: [{ kind: "node", id: trigger.sourceId }],
          props: { isOpen: set(value) },
        }),
      );
    open(true);
    const root = ws.root;
    const all = () => [...root.canvasInputs.values()];
    const of = (type) => all().find((r) => root.typeOf(r) === type);
    const box = (id) => {
      const own = root.getGeometry([id]).get(id);
      let { x, y } = own;
      for (
        let p = root.canvasInputs.get(root.canvasInputs.get(id).parentId);
        p && root.typeOf(p) !== "Sheet";
        p = root.canvasInputs.get(p.parentId)
      ) {
        const at = root.getGeometry([p.id]).get(p.id);
        x += at.x;
        y += at.y;
      }
      return { ...own, x, y };
    };
    const sheet = box(of("Sheet").id);
    const title = box(of("Heading").id);
    const close = all().find(
      (r) => root.typeOf(r) === "Button" && r.props.slot === "close",
    );
    const button = box(close.id);
    const groupRecord = root.canvasInputs.get(close.parentId);
    const group = box(groupRecord.id);
    const content = of("SheetContent");
    const bodyRecord = all().find(
      (r) => root.typeOf(r) === "frame" && r.parentId === content.id,
    );
    const body = box(bodyRecord.id);
    const out = {
      width: sheet.width,
      title: [title.x, title.y],
      parent: root.typeOf(groupRecord),
      closeEnd: sheet.width - (button.x + button.width),
      closeBottom: sheet.height - (button.y + button.height),
      bodyToGroup: group.y - (body.y + body.height),
    };
    open(false);
    return out;
  });
  record(
    "① Canvas — 480 · title (32, 32) · Close in ButtonGroup at the end corner 32 · 32 below the body",
    canvas.width === 480 &&
      canvas.title.join() === "32,32" &&
      canvas.parent === "ButtonGroup" &&
      Math.abs(canvas.closeEnd - 32) < 0.01 &&
      Math.abs(canvas.closeBottom - 32) < 0.01 &&
      Math.abs(canvas.bodyToGroup - 32) < 0.01,
    canvas,
  );
  await page.waitForTimeout(600);

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
  await pub.waitForSelector("button:has-text('Open Sheet')", {
    timeout: 60000,
  });
  await pub.waitForTimeout(600);
  // Sample the backdrop's opacity every animation frame from the press on.
  const opening = await pub.evaluate(async () => {
    const samples = [];
    const start = performance.now();
    [...document.querySelectorAll("button")]
      .find((b) => b.textContent.trim() === "Open Sheet")
      .click();
    await new Promise((done) => {
      const tick = () => {
        const backdrop = document.querySelector(".react-aria-SheetBackdrop");
        if (backdrop)
          samples.push([
            Math.round(performance.now() - start),
            Number(getComputedStyle(backdrop).opacity),
          ]);
        if (performance.now() - start < 500) requestAnimationFrame(tick);
        else done();
      };
      requestAnimationFrame(tick);
    });
    return samples;
  });
  const fadedIn =
    opening.length > 3 &&
    opening[0][1] < 0.6 &&
    opening.at(-1)[1] === 1 &&
    opening.some(([, o]) => o > 0 && o < 1);
  const dom = await pub.evaluate(() => {
    const sheet = document
      .querySelector(".react-aria-Sheet")
      .getBoundingClientRect();
    const title = document
      .querySelector(".react-aria-SheetContent .react-aria-Heading")
      .getBoundingClientRect();
    const close = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "Close",
    );
    const button = close.getBoundingClientRect();
    const group = close.parentElement;
    const body = group.previousElementSibling.getBoundingClientRect();
    const r = (v) => Math.round(v * 100) / 100;
    return {
      width: r(sheet.width),
      title: [r(title.left - sheet.left), r(title.top - sheet.top)],
      parentRole: group.getAttribute("role"),
      closeEnd: r(sheet.right - button.right),
      closeBottom: r(sheet.bottom - button.bottom),
      bodyToGroup: r(group.getBoundingClientRect().top - body.bottom),
    };
  });
  record(
    "② Publish — same box values as the Canvas",
    dom.width === canvas.width &&
      dom.title.join() === canvas.title.join() &&
      dom.parentRole === "group" &&
      Math.abs(dom.closeEnd - canvas.closeEnd) < 0.5 &&
      Math.abs(dom.closeBottom - canvas.closeBottom) < 0.5 &&
      Math.abs(dom.bodyToGroup - canvas.bodyToGroup) < 0.5,
    { dom, canvas },
  );
  record("② Publish — the backdrop fades in (S2 250ms)", fadedIn, {
    first: opening.slice(0, 4),
    last: opening.at(-1),
    frames: opening.length,
  });
  await pub.screenshot({ path: `${OUT}/2-publish-open.png` });
  const closing = await pub.evaluate(async () => {
    const samples = [];
    const start = performance.now();
    [...document.querySelectorAll("button")]
      .find((b) => b.textContent.trim() === "Close")
      .click();
    await new Promise((done) => {
      const tick = () => {
        const backdrop = document.querySelector(".react-aria-SheetBackdrop");
        const overlay = backdrop?.parentElement;
        samples.push([
          Math.round(performance.now() - start),
          overlay ? Number(getComputedStyle(overlay).opacity) : null,
          overlay?.className ?? null,
        ]);
        if (performance.now() - start < 400) requestAnimationFrame(tick);
        else done();
      };
      requestAnimationFrame(tick);
    });
    return samples;
  });
  const gone = closing.at(-1)[1] === null;
  const fadedOut = closing.some(([, o]) => o !== null && o > 0 && o < 1);
  record("③ Publish — Close closes the Sheet (RAC close slot through the ButtonGroup)", gone, {
    last: closing.at(-1),
  });
  record(
    "③ Publish — the overlay (backdrop + sheet) fades out before it goes (S2 130ms)",
    fadedOut,
    { samples: closing.slice(0, 12) },
  );
  await pub.screenshot({ path: `${OUT}/3-publish-closed.png` });
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
