#!/usr/bin/env node
// S2 대조 남은 차이 4 live (2026-11-25, 사용자 「알고 남겨 둔 차이 다시 체크해줘」 → 「모두 수정해」):
//   Builder 에 Disclosure (M · compact, 제목 줄 ActionButton) · SelectBoxGroup (가로) · ListBox (아이콘
//   항목) · frame (locale ja-JP, 안에 Text) 를 놓고 Preview 를 연다.
//   1. Disclosure compact: 제목 줄 ActionButton = XS (S2 두 단계) — Canvas · Preview
//   2. SelectBox 가로: S2 grid — 라벨 · 설명 · 그림 자리 Canvas = Preview, 설명 지우면 라벨만 grid
//   3. ListBox 아이콘: 1lh (M 18) · 라벨 줄 · text-to-visual — Canvas = Preview
//   4. ja frame 안 Text 서체 = S2 일본어 서체 — Canvas record · Preview computed
//   5. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-remaining-diffs-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-remaining-diffs-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1800)}\n`,
  );
};
const near = (a, b, tolerance = 0.6) => Math.abs(a - b) <= tolerance;

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
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("s2 remaining diffs live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    {
      timeout: 30000,
    },
  );
  await page.waitForTimeout(1500);

  const built = await page.evaluate(() => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const r = ws.root;
    const graph = ws.runtime.graph;
    const insert = (type, selectionId) => {
      ws.selectRecords(selectionId ? [selectionId] : []);
      const before = new Set(r.canvasInputs.keys());
      ws.execute(
        h.palette.catalogPaletteInsertPlan(
          {
            graph,
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
    const set = (ids, props) =>
      ws.execute(
        h.commands.setFields({
          targets: ids.map((id) => ({ kind: "node", id })),
          props: Object.fromEntries(
            Object.entries(props).map(([k, v]) => [
              k,
              { kind: "set", value: v },
            ]),
          ),
        }),
      );
    // 1. Disclosure compact + an ActionButton beside its title.
    const disclosure = insert("Disclosure");
    const header = [...r.canvasInputs.values()].find(
      (x) => r.typeOf(x) === "DisclosureHeader",
    );
    const action = insert("ActionButton", header.id);
    set([disclosure.sourceId], { density: "compact" });
    // 2. SelectBoxGroup horizontal.
    ws.selectRecords([]);
    const group = insert("SelectBoxGroup");
    set([group.sourceId], { orientation: "horizontal" });
    // 3. ListBox (its items hold icons).
    ws.selectRecords([]);
    const listBox = insert("ListBox");
    // 4. A ja-JP frame with a Text.
    const def = (type) =>
      h.palette.catalogPaletteDefinitionId(graph.library, type);
    const node = (id, type, props = {}, children = []) => ({
      kind: "node",
      id,
      definitionId: def(type),
      children,
      props: Object.fromEntries(
        Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
      ),
      visual: {},
      sizing: {},
      descendantOverrides: [],
    });
    const frame = "project:node:live-ja-frame";
    const text = "project:node:live-ja-text";
    ws.execute(
      h.commands.insertNodes({
        parent: { kind: "node", id: "project:node:home-body" },
        entries: [
          node(frame, "frame", { locale: "ja-JP" }, [text]),
          node(text, "Text", { children: "日本語のテキスト" }),
        ],
        rootIds: [frame],
        newId: ws.newId,
      }),
    );
    return {
      disclosure: disclosure.sourceId,
      action: action.sourceId,
      group: group.sourceId,
      listBox: listBox.sourceId,
      text,
    };
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/1-canvas.png` });

  /** Canvas: SelectBox parts · ListBox icon rows (relative to their box) · the Text's family. */
  const canvasRead = () =>
    page.evaluate(({ action, group, listBox, text }) => {
      const r = window.__COMPOSITION_CATALOG__.workspace.root;
      const recs = [...r.canvasInputs.values()];
      const rel = (id) => {
        const g = r.getGeometry([id]).get(id);
        return g && { x: g.x, y: g.y, w: g.width, h: g.height };
      };
      const groupRec = recs.find((x) => x.sourceId === group);
      const boxes = recs.filter(
        (x) => r.typeOf(x) === "SelectBox" && x.parentId === groupRec.id,
      );
      const parts = (box) =>
        Object.fromEntries(
          box.children
            .map((id) => r.canvasInputs.get(id))
            .filter((c) => c && !c.hidden && c.props.slot !== "selection")
            .map((c) => [c.props.slot, rel(c.id)]),
        );
      const listRec = recs.find((x) => x.sourceId === listBox);
      const items = recs.filter(
        (x) => r.typeOf(x) === "ListBoxItem" && x.parentId === listRec.id,
      );
      return {
        action: recs.find((x) => x.sourceId === action)?.props.size,
        boxes: boxes.map((b) => ({
          id: b.sourceId,
          box: rel(b.id),
          parts: parts(b),
        })),
        items: items.map((item) => {
          const icon = item.children
            .map((id) => r.canvasInputs.get(id))
            .find((c) => c?.props.slot === "icon");
          const label = item.children
            .map((id) => r.canvasInputs.get(id))
            .find((c) => c?.props.slot === "label");
          return { icon: icon && rel(icon.id), label: label && rel(label.id) };
        }),
        textFamily: String(
          recs.find((x) => x.sourceId === text)?.inheritedText?.fontFamily ??
            "",
        ),
      };
    }, built);
  const canvas = await canvasRead();

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
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector(".react-aria-SelectBox", { timeout: 60000 });
  await pub.waitForTimeout(1500);
  await pub.screenshot({ path: `${OUT}/2-preview.png`, fullPage: true });

  const domRead = () =>
    pub.evaluate(() => {
      const rel = (el, parent) => {
        const a = el.getBoundingClientRect();
        const b = parent.getBoundingClientRect();
        return { x: a.x - b.x, y: a.y - b.y, w: a.width, h: a.height };
      };
      const header = document.querySelector(".react-aria-DisclosureHeader");
      const action = header?.querySelector("button:not([slot='trigger'])");
      const boxes = [...document.querySelectorAll(".react-aria-SelectBox")].map(
        (box) => ({
          box: {
            w: box.getBoundingClientRect().width,
            h: box.getBoundingClientRect().height,
          },
          parts: Object.fromEntries(
            ["illustration", "label", "description"]
              .map((slot) => [
                slot,
                box.querySelector(`:scope > [slot="${slot}"]`),
              ])
              .filter(([, el]) => el)
              .map(([slot, el]) => [slot, rel(el, box)]),
          ),
        }),
      );
      const items = [
        ...document.querySelectorAll(
          ".react-aria-ListBox:not(.react-aria-SelectBoxGroup) > .react-aria-ListBoxItem",
        ),
      ].map((item) => {
        const icon = item.querySelector(':scope > [slot="icon"]');
        const label = item.querySelector(':scope > [slot="label"]');
        return {
          icon: icon && rel(icon, item),
          label: label && rel(label, item),
        };
      });
      const text = [...document.querySelectorAll("*")].find(
        (e) =>
          e.childElementCount === 0 && e.textContent === "日本語のテキスト",
      );
      return {
        action: action?.getAttribute("data-size"),
        boxes,
        items,
        textFamily: text ? getComputedStyle(text).fontFamily : "",
      };
    });
  const dom = await domRead();

  record(
    "1. Disclosure compact — 제목 줄 ActionButton XS (Canvas · Preview)",
    canvas.action === "XS" && dom.action === "XS",
    { canvas: canvas.action, dom: dom.action },
  );

  const sameParts = (a, b) =>
    Object.keys(a).length === Object.keys(b).length &&
    Object.entries(a).every(
      ([slot, r]) =>
        b[slot] &&
        near(r.x, b[slot].x) &&
        near(r.y, b[slot].y) &&
        near(r.w, b[slot].w, 1),
    );
  const firstCanvas = canvas.boxes[0];
  const firstDom = dom.boxes[0];
  record(
    "2a. SelectBox 가로 S2 grid — 라벨 y 32 · 설명 y 56 · 그림 y 18 · Canvas = Preview",
    !!firstDom &&
      near(firstDom.parts.illustration?.y, 18) &&
      near(firstDom.parts.label?.y + firstDom.parts.label?.h / 2, 18 + 23) &&
      near(
        firstDom.parts.description?.y + firstDom.parts.description?.h / 2,
        18 + 46 + 1,
      ) &&
      sameParts(firstCanvas.parts, firstDom.parts),
    { canvas: firstCanvas, dom: firstDom },
  );

  const itemsMatch =
    canvas.items.length > 0 &&
    canvas.items.length === dom.items.length &&
    canvas.items.every((c, i) => {
      const d = dom.items[i];
      return (
        c.icon &&
        d.icon &&
        near(c.icon.x, d.icon.x) &&
        near(c.icon.y, d.icon.y) &&
        near(c.icon.w, d.icon.w) &&
        near(c.label.x, d.label.x)
      );
    });
  const firstItem = dom.items[0];
  record(
    "3. ListBox 아이콘 — 1lh 18 · 라벨 줄 · 간격 6 · Canvas = Preview",
    itemsMatch &&
      near(firstItem.icon.w, 18) &&
      near(firstItem.label.x - (firstItem.icon.x + firstItem.icon.w), 6) &&
      near(
        firstItem.icon.y + firstItem.icon.h / 2,
        firstItem.label.y + firstItem.label.h / 2,
      ),
    { canvas: canvas.items, dom: dom.items },
  );

  record(
    "4. ja frame 안 Text = S2 일본어 서체 (Canvas record · Preview computed)",
    canvas.textFamily.startsWith("adobe-clean-han-japanese") &&
      /^"?adobe-clean-han-japanese/.test(dom.textFamily),
    {
      canvas: canvas.textFamily.slice(0, 60),
      dom: dom.textFamily.slice(0, 60),
    },
  );

  // 2b. label only: clear every box's description (Builder) — both consumers take S2's one-row grid.
  await pub.close();
  await page.evaluate(({ group }) => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const r = ws.root;
    const groupRec = [...r.canvasInputs.values()].find(
      (x) => x.sourceId === group,
    );
    const ids = [...r.canvasInputs.values()]
      .filter((x) => r.typeOf(x) === "SelectBox" && x.parentId === groupRec.id)
      .map((x) => x.sourceId);
    ws.execute(
      h.commands.setFields({
        targets: ids.map((id) => ({ kind: "node", id })),
        props: { description: { kind: "set", value: "" } },
      }),
    );
  }, built);
  await page.waitForTimeout(1000);
  const canvas2 = await canvasRead();
  const popup2 = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) =>
        ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
      )
      ?.click(),
  );
  const pub2 = await popup2;
  pub2.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub2.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub2.waitForSelector(".react-aria-SelectBox", { timeout: 60000 });
  await pub2.waitForTimeout(1500);
  const dom2 = await pub2.evaluate(() =>
    [...document.querySelectorAll(".react-aria-SelectBox")].map((box) => {
      const rel = (el) => {
        const a = el.getBoundingClientRect();
        const b = box.getBoundingClientRect();
        return { x: a.x - b.x, y: a.y - b.y, w: a.width, h: a.height };
      };
      return {
        h: box.getBoundingClientRect().height,
        parts: Object.fromEntries(
          ["illustration", "label", "description"]
            .map((slot) => [
              slot,
              box.querySelector(`:scope > [slot="${slot}"]`),
            ])
            .filter(([, el]) => el)
            .map(([slot, el]) => [slot, rel(el)]),
        ),
      };
    }),
  );
  await pub2.screenshot({
    path: `${OUT}/3-preview-label-only.png`,
    fullPage: true,
  });
  const lc = canvas2.boxes[0];
  const ld = dom2[0];
  record(
    "2b. SelectBox 라벨만 — 그림 48 행 · 라벨 가운데 (y 33) · 상자 86 · Canvas = Preview",
    !!ld &&
      !ld.parts.description &&
      near(ld.h, 86) &&
      near(ld.parts.label.y + ld.parts.label.h / 2, 18 + 24) &&
      near(lc.box.h, 86) &&
      sameParts(lc.parts, ld.parts),
    { canvas: lc, dom: ld },
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
