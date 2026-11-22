#!/usr/bin/env node
// S2 체크리스트 §4.1 TokenField Phase 1 live (2026-11-22) — S2 TextArea 패턴 (headed Chrome).
//   TokenField 여섯 (S · M · L · XL · 두 줄 M · disabled M) 을 놓고:
//   ① Canvas — 상자 Group 과 TokenInput 의 자리 · 크기 (field 기준), size 가 TokenInput 에 닿음
//   ② Publish — Group · TokenInput 상자가 Canvas 와 0.5 안에서 같다 (두 줄 값의 높이 포함)
//   ③ Publish — Group 이 상자 (테두리 2 · 크기별 모서리 7 / 8 / 9 / 10), TokenInput 은 테두리 0 · 투명
//   ④ Publish — hover 하면 Group 테두리 색이 바뀌고, 상자 여백을 누르면 TokenInput 에 focus
//   ⑤ Publish — disabled field 의 Group 에 data-disabled
//   ⑥ page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-tokenfield-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-tokenfield-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const CASES = [
  { key: "S", props: { size: "S" } },
  { key: "M", props: { size: "M" } },
  { key: "L", props: { size: "L" } },
  { key: "XL", props: { size: "XL" } },
  {
    key: "two-lines",
    props: {
      size: "M",
      allowsNewlines: true,
      value: "Line one @person\nLine two #tag ",
    },
  },
  { key: "disabled", props: { size: "M", isDisabled: true } },
];

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
  viewport: { width: 1920, height: 1000 },
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
  await page.keyboard.type("S2 tokenfield live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  const canvas = await page.evaluate((cases) => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const r = ws.root;
    const ctx = () => ({
      graph: ws.runtime.graph,
      records: ws.root.domInputs,
      selection: () => ws.session.getSnapshot().selection,
      itemOfRecord: (i) => ws.itemOfRecord(i),
      pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
      newId: ws.newId,
    });
    const set = (value) => ({ kind: "set", value });
    for (const c of cases) {
      ws.selectRecords([]);
      ws.execute(h.palette.catalogPaletteInsertPlan(ctx(), "TokenField").command);
      const fields = [...r.canvasInputs.values()].filter(
        (x) => r.typeOf(x) === "TokenField",
      );
      const field = fields[fields.length - 1];
      ws.execute(
        h.commands.setFields({
          targets: [{ kind: "node", id: field.sourceId }],
          props: Object.fromEntries(
            Object.entries(c.props).map(([k, v]) => [k, set(v)]),
          ),
        }),
      );
    }
    ws.selectRecords([]);
    const g = (id) => r.getGeometry([id]).get(id);
    const fields = [...r.canvasInputs.values()].filter(
      (x) => r.typeOf(x) === "TokenField",
    );
    return fields.map((field, i) => {
      // geometry is parent-relative — walk down from the field
      let group = null;
      let input = null;
      const walk = (id, ox, oy) => {
        const node = r.canvasInputs.get(id);
        const rect = g(id);
        if (!node || !rect) return;
        const x = ox + rect.x;
        const y = oy + rect.y;
        const box = { id, x, y, w: rect.width, h: rect.height };
        if (r.typeOf(node) === "Group" && !group) group = box;
        if (r.typeOf(node) === "TokenInput") {
          input = { ...box, size: node.props.size };
          return;
        }
        for (const c of node.children ?? []) walk(c, x, y);
      };
      for (const c of field.children ?? []) walk(c, 0, 0);
      const label = [...r.canvasInputs.values()].find(
        (x) =>
          r.typeOf(x) === "Label" &&
          (r.canvasInputs.get(x.parentId)?.parentId === field.id ||
            x.parentId === field.id),
      );
      return {
        key: cases[i].key,
        fieldId: field.id,
        group,
        input,
        labelColor: label?.derivedProps?.color,
      };
    });
  }, CASES);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/1-canvas.png` });
  // (a scene the Canvas refused to draw shows only as an error toast — no page error)
  const canvasRefused = await page.evaluate(() =>
    document.body.innerText.includes("could not draw"),
  );
  record(
    "① Canvas — each TokenField has a box Group around its TokenInput, sized by the field",
    !canvasRefused &&
      canvas.length === CASES.length &&
      canvas.every(
        (c, i) =>
          c.group &&
          c.input &&
          c.input.size === CASES[i].props.size &&
          c.input.x > c.group.x &&
          c.input.y > c.group.y,
      ),
    { canvasRefused, canvas },
  );

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
  await pub.waitForSelector(".react-aria-TokenInput", { timeout: 60000 });
  await pub.waitForTimeout(1200);
  const measure = () =>
    pub.evaluate((canvas) =>
      canvas.map((c) => {
        const field = document.querySelector(
          `[data-catalog-id="${CSS.escape(c.fieldId)}"]`,
        );
        const group = field?.querySelector(".react-aria-FieldBox");
        const input = field?.querySelector(".react-aria-TokenInput");
        if (!field || !group || !input) return { key: c.key, missing: true };
        const f = field.getBoundingClientRect();
        const rel = (el) => {
          const b = el.getBoundingClientRect();
          return { x: b.x - f.x, y: b.y - f.y, w: b.width, h: b.height };
        };
        const gs = getComputedStyle(group);
        const is = getComputedStyle(input);
        return {
          key: c.key,
          group: rel(group),
          input: rel(input),
          groupBorder: gs.borderTopWidth,
          groupBorderColor: gs.borderTopColor,
          groupRadius: gs.borderTopLeftRadius,
          groupDisabled: group.hasAttribute("data-disabled"),
          groupAttrs: [...group.attributes]
            .map((a) => a.name)
            .filter((n) => n.startsWith("data-")),
          groupTransition: gs.transition,
          inputBorder: is.borderTopWidth,
          inputBg: is.backgroundColor,
          inputSize: input.getAttribute("data-size"),
          labelColor: getComputedStyle(field.querySelector(".react-aria-Label"))
            .color,
        };
      }),
    canvas);
  const dom = await measure();
  await pub.screenshot({ path: `${OUT}/2-publish.png` });
  const near = (a, b) => Math.abs(a - b) < 0.5;
  const same = (a, b) =>
    a && b && near(a.x, b.x) && near(a.y, b.y) && near(a.w, b.w) && near(a.h, b.h);
  const diffs = canvas
    .map((c, i) => ({ c, d: dom[i] }))
    .filter(({ c, d }) => !same(c.group, d.group) || !same(c.input, d.input))
    .map(({ c, d }) => ({
      key: c.key,
      canvas: { group: c.group, input: c.input },
      dom: { group: d.group, input: d.input },
    }));
  record("② Publish — Group and TokenInput boxes = Canvas (±0.5)", diffs.length === 0, {
    diffs,
    twoLines: {
      canvas: canvas.find((c) => c.key === "two-lines")?.input?.h,
      dom: dom.find((d) => d.key === "two-lines")?.input?.h,
    },
  });
  const radius = { S: "7px", M: "8px", L: "9px", XL: "10px" };
  const shapeBad = dom.filter((d, i) => {
    const size = CASES[i].props.size;
    return !(
      d.groupBorder === "2px" &&
      d.groupRadius === radius[size] &&
      d.inputBorder === "0px" &&
      (d.inputBg === "rgba(0, 0, 0, 0)" || d.inputBg === "transparent") &&
      d.inputSize === size
    );
  });
  record(
    "③ Publish — the Group draws the box (border 2 · radius 7/8/9/10), the TokenInput none",
    shapeBad.length === 0,
    { bad: shapeBad, all: dom.map((d) => [d.key, d.groupBorder, d.groupRadius, d.inputBorder, d.inputBg, d.inputSize]) },
  );

  // ④ hover · press the box padding
  const m = canvas.find((c) => c.key === "M");
  const mDom = dom.find((d) => d.key === "M");
  const fieldBox = await pub.evaluate((id) => {
    const b = document
      .querySelector(`[data-catalog-id="${CSS.escape(id)}"]`)
      .getBoundingClientRect();
    return { x: b.x, y: b.y };
  }, m.fieldId);
  const before = mDom.groupBorderColor;
  const at = {
    x: fieldBox.x + mDom.group.x + mDom.group.w - 4,
    y: fieldBox.y + mDom.group.y + mDom.group.h / 2,
  };
  await pub.mouse.move(at.x, at.y, { steps: 5 });
  // (the box's border-color transition is 0.2s)
  await pub.waitForTimeout(400);
  const hoveredDom = (await measure()).find((d) => d.key === "M");
  const hovered = hoveredDom.groupBorderColor;
  await pub.mouse.click(at.x, at.y);
  await pub.waitForTimeout(300);
  const focused = await pub.evaluate((id) => {
    const a = document.activeElement;
    return {
      isTokenInput: a?.classList.contains("react-aria-TokenInput") ?? false,
      inField: !!a?.closest(`[data-catalog-id="${CSS.escape(id)}"]`),
    };
  }, m.fieldId);
  await pub.screenshot({ path: `${OUT}/3-focus.png` });
  record(
    "④ Publish — hover changes the box border; a press on the box padding focuses the TokenInput",
    hovered !== before && focused.isTokenInput && focused.inField,
    { before, hovered, focused, attrs: hoveredDom.groupAttrs, transition: hoveredDom.groupTransition },
  );
  record(
    "⑤ Publish — a disabled TokenField's box Group carries data-disabled",
    dom.find((d) => d.key === "disabled")?.groupDisabled === true &&
      dom.find((d) => d.key === "M")?.groupDisabled === false,
    dom.map((d) => [d.key, d.groupDisabled]),
  );
  const labels = {
    canvas: [canvas.find((c) => c.key === "M")?.labelColor, canvas.find((c) => c.key === "disabled")?.labelColor],
    dom: [dom.find((d) => d.key === "M")?.labelColor, dom.find((d) => d.key === "disabled")?.labelColor],
  };
  // S2 `disabled` content gray-400 #c6c6c6 = rgb(198, 198, 198)
  record(
    "⑤b disabled label = S2 disabled content on both consumers",
    labels.canvas[1] === "#c6c6c6" &&
      labels.dom[1] === "rgb(198, 198, 198)" &&
      labels.canvas[0] !== labels.canvas[1] &&
      labels.dom[0] !== labels.dom[1],
    labels,
  );
  record("⑥ no page errors", errors.length === 0, errors);
} finally {
  writeFileSync(
    `${OUT}/result.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
  await browser.close();
}
