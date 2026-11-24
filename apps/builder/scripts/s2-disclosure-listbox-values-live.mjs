#!/usr/bin/env node
// S2 대조 값 차이 live (2026-11-24, S2 체크리스트 부록 D.1 — 사용자 「권장대로 세가지 진행해」):
//   Builder 에 Disclosure (M) 를 놓고 제목 줄에 ActionButton, ListBox 를 놓고 첫 항목을 비활성으로.
//   1. Preview: 제목 16px · 700 · trigger 좌우 여백 · 간격 11 · 높이 32
//   2. Preview: 패널 글자 16 · 여백 위 8 · 좌우 9 · 아래 16 · 높이 전환 150ms
//   3. Preview · Canvas: 제목 줄 ActionButton = S (한 단계 아래)
//   4. Canvas: chevron x = 11 · 제목 글자 16 · 700 (Preview 와 같은 값)
//   5. Preview: 비활성 항목은 opacity 1 · 글자 = 비활성 색 (S2 — 행을 흐리게 하지 않음)
//   6. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-disclosure-listbox-values-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-disclosure-listbox-live";
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
  await page.keyboard.type("disclosure listbox values live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
    timeout: 30000,
  });
  await page.waitForTimeout(1500);

  const built = await page.evaluate(() => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const r = ws.root;
    const insert = (type, selectionId) => {
      ws.selectRecords(selectionId ? [selectionId] : []);
      const before = new Set(r.canvasInputs.keys());
      ws.execute(
        h.palette.catalogPaletteInsertPlan(
          {
            graph: ws.runtime.graph,
            records: r.domInputs,
            selection: () => ws.session.getSnapshot().selection,
            itemOfRecord: (i) => ws.itemOfRecord(i),
            pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
            newId: ws.newId,
          },
          type,
        ).command,
      );
      return [...r.canvasInputs.values()].find(
        (x) => r.typeOf(x) === type && !before.has(x.id),
      );
    };
    const disclosure = insert("Disclosure");
    const header = [...r.canvasInputs.values()].find(
      (x) => r.typeOf(x) === "DisclosureHeader",
    );
    const action = insert("ActionButton", header.id);
    const listBox = insert("ListBox");
    ws.selectRecords([]);
    const items = [...r.canvasInputs.values()].filter(
      (x) => r.typeOf(x) === "ListBoxItem",
    );
    const key = items[0].props.id;
    ws.execute(
      h.commands.setFields({
        targets: [{ kind: "node", id: listBox.sourceId }],
        props: { disabledKeys: { kind: "set", value: [key] } },
      }),
    );
    return {
      disclosure: disclosure.sourceId,
      action: action.sourceId,
      listBox: listBox.sourceId,
      key,
    };
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/1-canvas.png` });

  const canvas = await page.evaluate(({ disclosure, action }) => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    const recs = [...r.canvasInputs.values()];
    const icon = recs.find(
      (x) =>
        r.typeOf(x) === "Icon" &&
        r.typeOf(r.canvasInputs.get(x.parentId)) === "Button" &&
        r.canvasInputs.get(x.parentId).props.slot === "trigger",
    );
    const trigger = r.canvasInputs.get(icon.parentId);
    const title = r.canvasInputs.get(trigger.children[1]);
    const g = r.getGeometry([icon.id, trigger.id, title.id]);
    const actionRec = recs.find((x) => x.sourceId === action);
    return {
      chevronX: g.get(icon.id).x,
      triggerH: g.get(trigger.id).height,
      titleFont: title.visual.fontSize,
      titleWeight: title.visual.fontWeight,
      actionSize: actionRec.props.size,
      disclosureSize: recs.find((x) => x.sourceId === disclosure).props.size,
    };
  }, built);
  record(
    "4. Canvas — chevron x 11 · 제목 16 · 700 · 높이 32",
    canvas.chevronX === 11 &&
      canvas.titleWeight === 700 &&
      Math.abs(canvas.triggerH - 32) < 0.5 &&
      (canvas.titleFont === 16 || String(canvas.titleFont).includes("text-base")),
    canvas,
  );

  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => ["Preview", "미리보기"].includes(b.getAttribute("aria-label")))
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector(".react-aria-Disclosure", { timeout: 60000 });
  await pub.waitForTimeout(1000);
  await pub.screenshot({ path: `${OUT}/2-preview.png` });
  const dom = await pub.evaluate(() => {
    const trigger = document.querySelector(
      ".react-aria-Disclosure .react-aria-Button[slot='trigger']",
    );
    const t = getComputedStyle(trigger);
    const panel = document.querySelector(".react-aria-DisclosurePanel > div");
    const p = getComputedStyle(panel);
    const panelBox = getComputedStyle(document.querySelector(".react-aria-DisclosurePanel"));
    const header = document.querySelector(".react-aria-DisclosureHeader");
    const action = header?.querySelector(".react-aria-ActionButton, button:not([slot='trigger'])");
    const disabled = document.querySelector(".react-aria-ListBoxItem[data-disabled]");
    const enabled = document.querySelector(".react-aria-ListBoxItem:not([data-disabled])");
    return {
      trigger: {
        fontSize: t.fontSize,
        fontWeight: t.fontWeight,
        paddingLeft: t.paddingLeft,
        gap: t.columnGap,
        height: trigger.getBoundingClientRect().height,
      },
      panel: {
        fontSize: p.fontSize,
        padding: [p.paddingTop, p.paddingRight, p.paddingBottom, p.paddingLeft],
        transition: panelBox.transition,
      },
      action: action && {
        size: action.getAttribute("data-size"),
        quiet: action.getAttribute("data-quiet"),
      },
      disabled: disabled && {
        opacity: getComputedStyle(disabled).opacity,
        color: getComputedStyle(disabled).color,
        enabledColor: getComputedStyle(enabled).color,
      },
    };
  });
  record(
    "1. Preview 제목 — 16px · 700 · 여백 · 간격 11 · 높이 32",
    dom.trigger.fontSize === "16px" &&
      dom.trigger.fontWeight === "700" &&
      dom.trigger.paddingLeft === "11px" &&
      dom.trigger.gap === "11px" &&
      Math.abs(dom.trigger.height - 32) < 0.5,
    dom.trigger,
  );
  record(
    "2. Preview 패널 — 글자 16 · 여백 8 9 16 9 · 높이 전환 150ms",
    dom.panel.fontSize === "16px" &&
      dom.panel.padding.join(" ") === "8px 9px 16px 9px" &&
      /height 0\.15s/.test(dom.panel.transition),
    dom.panel,
  );
  record(
    "3. 제목 줄 ActionButton = S (Canvas · Preview)",
    canvas.actionSize === "S" && dom.action?.size === "S",
    { canvas: canvas.actionSize, dom: dom.action },
  );
  record(
    "5. 비활성 항목 — opacity 1 · 글자 = 비활성 색",
    dom.disabled?.opacity === "1" &&
      dom.disabled.color !== dom.disabled.enabledColor,
    dom.disabled,
  );
} catch (e) {
  record("run", false, { error: String(e?.stack ?? e) });
} finally {
  record("6. page error 0", errors.length === 0, { errors });
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(`\n${results.length - failed}/${results.length} PASS\n`);
  process.exit(failed ? 1 : 0);
}
