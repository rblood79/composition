#!/usr/bin/env node
// S2 체크리스트 §4.1 ListBox 세부 live (2026-11-22) — description 색 (S2 `neutral-subdued` · 선택 항목은 on-accent
// 그대로) · label ↔ description 간격 1 · section 뒤 S2 Divider (Separator) · section Header 의 선 없음, Canvas 와
// Publish 가 같은가 (headed Chrome, 실제 Builder + Publish).
//
// 새 프로젝트에 팔레트 ListBox (single · 첫 항목 선택) 를 두고 Builder 의 「+ Section」 · 「+ Item」
// (`catalogItemInsertChoices` — Layers · Design 의 항목 넣기) 으로 section (+ Divider) 과 항목 하나를 넣는다.
//   ① Canvas — description 색 · 간격 · Divider 자리 (section 기준 x 12 · 아래 5 · 높이 2) · Header 선 0
//   ② Publish DOM — 같은 값 (computed color · rect)
//   ④ Select L 팝오버 선택 항목의 check 19.2 (S2 Checkmark L 12 × 16/10) — Canvas 상자 · 글리프 = Publish 상자 · svg
//   ③ 끝 section 의 Divider 숨김 — 마지막 항목을 지우면 Divider 가 숨고 Undo 로 돌아온다 (Canvas)
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-listbox-details-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-listbox-details-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1400)}\n`,
  );
};
const hex = (rgb) => {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb ?? "");
  return m
    ? `#${[m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, "0")).join("")}`
    : rgb;
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
  await page.keyboard.type("S2 listbox details live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  const setup = await page.evaluate(async () => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const set = (value) => ({ kind: "set", value });
    const graph = ws.runtime.graph;
    const ctx = () => ({
      graph,
      records: ws.root.domInputs,
      selection: () => ws.session.getSnapshot().selection,
      itemOfRecord: (i) => ws.itemOfRecord(i),
      pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
      newId: ws.newId,
    });
    ws.selectRecords([]);
    ws.execute(h.palette.catalogPaletteInsertPlan(ctx(), "ListBox").command);
    const list = [...ws.root.domInputs.values()].find(
      (r) => ws.root.typeOf(r) === "ListBox",
    );
    const items = list.children
      .map((c) => ws.root.domInputs.get(c))
      .filter((r) => ws.root.typeOf(r) === "ListBoxItem");
    ws.execute(
      h.commands.setFields({
        targets: [{ kind: "node", id: list.sourceId }],
        props: {
          selectionMode: set("single"),
          defaultSelectedKeys: set([items[0].props.id]),
        },
      }),
    );
    // The Builder's own 「+ Section」 · 「+ Item」 (the Layers · Design add-item choices).
    const { catalogItemInsertChoices } =
      await import("/src/builder/catalogRuntime/itemInsert.ts");
    const choose = (type) =>
      ws.execute(
        catalogItemInsertChoices(
          { graph, readModel: ws.readModel, newId: ws.newId },
          ws.positionOfRecord(list.id),
        )
          .find((choice) => choice.type === type)
          .build(),
      );
    choose("ListBoxSection");
    choose("ListBoxItem");
    const after = ws.root.domInputs.get(list.id);
    return {
      listSource: list.sourceId,
      order: after.children.map((c) =>
        ws.root.typeOf(ws.root.domInputs.get(c)),
      ),
    };
  });
  record(
    "setup — ListBox items, a section, its Divider, an item after",
    setup.order.join() ===
      "ListBoxItem,ListBoxItem,ListBoxItem,ListBoxSection,Separator,ListBoxItem,IllustratedMessage",
    setup,
  );
  await page.waitForTimeout(800);

  const canvas = await page.evaluate(({ listSource }) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const list = [...root.canvasInputs.values()].find(
      (r) => r.sourceId === listSource,
    );
    const kids = (id) =>
      root.canvasInputs.get(id).children.map((c) => root.canvasInputs.get(c));
    const geo = (id) => root.getGeometry([id]).get(id);
    const items = kids(list.id)
      .filter((r) => root.typeOf(r) === "ListBoxItem")
      .map((item) => {
        const part = (slot) =>
          kids(item.id).find((p) => p.props.slot === slot && !p.hidden);
        const label = part("label");
        const description = part("description");
        if (!label || !description)
          return {
            key: item.props.id,
            parts: kids(item.id).map((p) => [
              root.typeOf(p),
              p.props.slot,
              !!p.hidden,
            ]),
          };
        const lg = geo(label.id);
        return {
          key: item.props.id,
          selected: item.derivedProps?._isSelected === true,
          descriptionColor:
            description.derivedProps?.color ?? description.visual.color,
          gap: geo(description.id).y - (lg.y + lg.height),
        };
      });
    const section = kids(list.id).find(
      (r) => root.typeOf(r) === "ListBoxSection",
    );
    const separator = kids(list.id).find((r) => root.typeOf(r) === "Separator");
    const header = kids(section.id).find((r) => root.typeOf(r) === "Header");
    if (!header)
      return {
        items,
        sectionParts: kids(section.id).map((p) => root.typeOf(p)),
      };
    const sg = geo(section.id);
    const dg = geo(separator.id);
    return {
      items,
      divider: {
        hidden: !!separator.hidden,
        x: dg.x - sg.x,
        below: dg.y - (sg.y + sg.height),
        height: dg.height,
        inset: sg.width - dg.width,
      },
      header: {
        top: header.visual.borderTopWidth ?? 0,
        bottom: header.visual.borderBottomWidth ?? 0,
        height: geo(header.id).height,
      },
    };
  }, setup);
  // (The new item from 「+ Item」 has no description — the three palette items do.)
  canvas.items = canvas.items.filter((item) => item.descriptionColor);
  if (!canvas.divider) {
    record("① Canvas structure", false, canvas);
    throw new Error("no section header");
  }
  record(
    "① Canvas — description subdued (selected keeps on-accent) · gap 1 · Divider 12 / 5 / 2 · no header lines",
    canvas.items[0].selected &&
      canvas.items[0].descriptionColor.toLowerCase() === "#ffffff" &&
      canvas.items
        .slice(1)
        .every(
          (i) => !i.selected && i.descriptionColor.toLowerCase() === "#505050",
        ) &&
      canvas.items.every((i) => i.gap === 1) &&
      !canvas.divider.hidden &&
      canvas.divider.x === 12 &&
      canvas.divider.below === 5 &&
      canvas.divider.height === 2 &&
      canvas.header.top === 0 &&
      canvas.header.bottom === 0,
    canvas,
  );
  await page.screenshot({ path: `${OUT}/1-canvas.png` });

  // ④ a Select L — its option's selection check at the S2 step (사용자 결정 「크기별로 키움」 — L 19.2).
  const select = await page.evaluate(() => {
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
    const before = new Set(
      [...ws.root.domInputs.values()]
        .filter((r) => ws.root.typeOf(r) === "Select")
        .map((r) => r.id),
    );
    ws.execute(h.palette.catalogPaletteInsertPlan(ctx(), "Select").command);
    const sel = [...ws.root.domInputs.values()].find(
      (r) => ws.root.typeOf(r) === "Select" && !before.has(r.id),
    );
    const options = () =>
      [...ws.root.canvasInputs.values()].filter(
        (r) => ws.root.typeOf(r) === "ListBoxItem" && r.props.size === "L",
      );
    ws.execute(
      h.commands.setFields({
        targets: [{ kind: "node", id: sel.sourceId }],
        props: { size: set("L"), isOpen: set(true) },
      }),
    );
    const key = options()[0]?.props.id;
    ws.execute(
      h.commands.setFields({
        targets: [{ kind: "node", id: sel.sourceId }],
        props: { value: set(key) },
      }),
    );
    const option = options().find((r) => r.props.id === key);
    const check = option.children
      .map((c) => ws.root.canvasInputs.get(c))
      .find(
        (r) => ws.root.typeOf(r) === "Icon" && r.props.iconName === "check",
      );
    const g = ws.root.getGeometry([check.id]).get(check.id);
    const out = {
      key,
      hidden: !!check.hidden,
      glyph: check.visual.fontSize,
      width: g.width,
      height: g.height,
    };
    // (Closed again — the Publish opens it by its trigger.)
    ws.execute(
      h.commands.setFields({
        targets: [{ kind: "node", id: sel.sourceId }],
        props: { isOpen: set(false) },
      }),
    );
    return out;
  });
  record(
    "④ Canvas — Select L option check 19.2 (box · glyph)",
    !select.hidden &&
      select.glyph === 19.2 &&
      Math.abs(select.width - 19.2) < 0.01 &&
      Math.abs(select.height - 19.2) < 0.01,
    select,
  );

  // ③ the Divider hides when its section ends the list (the item after it removed) — Undo brings it back.
  const hiding = await page.evaluate(({ listSource }) => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const root = ws.root;
    const list = () =>
      [...root.canvasInputs.values()].find((r) => r.sourceId === listSource);
    const kids = () => list().children.map((c) => root.canvasInputs.get(c));
    const divider = () => kids().find((r) => root.typeOf(r) === "Separator");
    const last = kids()
      .filter((r) => root.typeOf(r) === "ListBoxItem")
      .at(-1);
    ws.execute(
      h.commands.removeTargets({
        targets: [ws.positionOfRecord(last.id).target],
      }),
    );
    const removed = divider().hidden === true;
    ws.undo();
    return { removed, back: divider().hidden !== true };
  }, setup);
  record(
    "③ section ending the list hides its Divider · Undo shows it",
    hiding.removed && hiding.back,
    hiding,
  );
  await page.waitForTimeout(800);

  // ② Publish.
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
  await pub.waitForSelector(".react-aria-ListBox .react-aria-Separator", {
    timeout: 60000,
  });
  await pub.waitForTimeout(800);
  const dom = await pub.evaluate(() => {
    const list = document.querySelector(".react-aria-ListBox");
    const items = [...list.querySelectorAll(":scope > .react-aria-ListBoxItem")]
      .filter((item) => item.querySelector('[slot="description"]'))
      .map((item) => {
        const label = item
          .querySelector('[slot="label"]')
          .getBoundingClientRect();
        const description = item.querySelector('[slot="description"]');
        return {
          selected: item.hasAttribute("data-selected"),
          descriptionColor: getComputedStyle(description).color,
          gap:
            Math.round(
              (description.getBoundingClientRect().top - label.bottom) * 100,
            ) / 100,
        };
      });
    const section = list
      .querySelector(".react-aria-ListBoxSection")
      .getBoundingClientRect();
    const sep = list.querySelector(".react-aria-Separator");
    const sr = sep.getBoundingClientRect();
    const header = list.querySelector(
      ".react-aria-ListBoxSection .react-aria-Header",
    );
    const hs = getComputedStyle(header);
    return {
      items,
      divider: {
        x: Math.round((sr.left - section.left) * 100) / 100,
        below: Math.round((sr.top - section.bottom) * 100) / 100,
        height: sr.height,
        inset: Math.round((section.width - sr.width) * 100) / 100,
        role: sep.getAttribute("role"),
      },
      header: {
        top: hs.borderTopWidth,
        bottom: hs.borderBottomWidth,
        height: header.getBoundingClientRect().height,
      },
    };
  });
  dom.items = dom.items.map((i) => ({
    ...i,
    descriptionColor: hex(i.descriptionColor),
  }));
  record(
    "② Publish DOM = Canvas (description color · gap · Divider place · header)",
    dom.items.every(
      (d, i) =>
        d.selected === canvas.items[i].selected &&
        d.descriptionColor === canvas.items[i].descriptionColor.toLowerCase() &&
        Math.abs(d.gap - canvas.items[i].gap) < 0.5,
    ) &&
      Math.abs(dom.divider.x - canvas.divider.x) < 0.5 &&
      Math.abs(dom.divider.below - canvas.divider.below) < 0.5 &&
      Math.abs(dom.divider.height - canvas.divider.height) < 0.5 &&
      Math.abs(dom.divider.inset - canvas.divider.inset) < 0.5 &&
      dom.header.top === "0px" &&
      dom.header.bottom === "0px" &&
      Math.abs(dom.header.height - canvas.header.height) < 0.5,
    { dom, canvas },
  );
  await pub.screenshot({ path: `${OUT}/2-publish.png` });
  await pub.locator(".react-aria-Select button").first().click();
  await pub.waitForSelector(
    ".react-aria-Popover .react-aria-ListBoxItem[data-selected]",
    { timeout: 10000 },
  );
  await pub.waitForTimeout(400);
  const domCheck = await pub.evaluate(() => {
    const item = document.querySelector(
      ".react-aria-Popover .react-aria-ListBoxItem[data-selected]",
    );
    const icon = item.querySelector('.react-aria-Icon[slot="selection"]');
    const svg = icon.querySelector("svg").getBoundingClientRect();
    const box = icon.getBoundingClientRect();
    return {
      size: item.getAttribute("data-size"),
      box: [box.width, box.height],
      svg: [svg.width, svg.height],
    };
  });
  record(
    "④ Publish — the same option check 19.2 (box · svg)",
    domCheck.size === "L" &&
      domCheck.box.every((v) => Math.abs(v - 19.2) < 0.05) &&
      domCheck.svg.every((v) => Math.abs(v - 19.2) < 0.05),
    { domCheck, canvas: select },
  );
  await pub.screenshot({ path: `${OUT}/3-select-check.png` });
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
