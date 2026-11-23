#!/usr/bin/env node
// S2 체크리스트 §4.1 TokenField Phase 1 live (2026-11-22) — S2 TextArea 패턴 (headed Chrome).
//   TokenField 여섯 (S · M · L · XL · 두 줄 M · disabled M) 을 놓고:
//   ① Canvas — 상자 Group 과 TokenInput 의 자리 · 크기 (field 기준), size 가 TokenInput 에 닿음
//   ② Publish — Group · TokenInput 상자가 Canvas 와 0.5 안에서 같다 (두 줄 값의 높이 포함)
//   ③ Publish — Group 이 상자 (테두리 2 · 크기별 모서리 7 / 8 / 9 / 10), TokenInput 은 테두리 0 · 투명
//   ④ Publish — hover 하면 Group 테두리 색이 바뀌고, 상자 여백을 누르면 TokenInput 에 focus
//   ⑤ Publish — disabled field 의 Group 에 data-disabled
//   ⑥ page error 0
//   Phase 2 ⑦ side · ⑧ labelAlign end · Phase 3 ⑨ Token chip style (Publish) · ⑩ chips drawn (Canvas)
//   Phase 4 ⑪ D1 exception ARIA · invalid box · ⑫ necessity indicator
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-tokenfield-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-tokenfield-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const CASES = [
  // Phase 3 (first — the Canvas clip of ⑩ needs them on screen) — Token = S2 Tag paint in the line (a wrapping value: the chips' inline insets move the wrap)
  {
    key: "tokens",
    props: {
      size: "M",
      value:
        "Ask @alexandra about #design-system and @morgan with #frontend-tokens and #a11y today ",
    },
  },
  // (a narrow field: the value wraps — where depends on the chips' inline insets, ② compares the height)
  {
    key: "tokens-narrow",
    width: 300,
    props: {
      size: "M",
      value:
        "Ask @alexandra about #design-system and @morgan with #frontend-tokens and #a11y today ",
    },
  },
  {
    key: "tokens-L",
    props: {
      size: "L",
      value: "Ping @sam and @robin about #release-notes for #v2 now ",
    },
  },
  // Phase 4 — necessity · error (S2 TextArea's) + the D1 exception's ARIA on the textbox
  {
    key: "invalid",
    props: {
      size: "M",
      isRequired: true,
      isInvalid: true,
      description: "Mention a teammate",
      errorMessage: "Pick at least one person",
    },
  },
  {
    key: "required-label",
    props: { size: "M", isRequired: true, necessityIndicator: "label" },
  },
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
  // Phase 2 — S2 TextArea's label layout
  { key: "side", props: { size: "M", labelPosition: "side" } },
  { key: "side-end-L", props: { size: "L", labelPosition: "side", labelAlign: "end" } },
  // (in a side Form: its labelPosition · labelAlign · size reach the field — the field sets none)
  { key: "form-side", props: {}, form: { labelPosition: "side", size: "M" }, size: "M" },
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
    const ctx = (at = "project:node:home-body") => ({
      graph: ws.runtime.graph,
      records: ws.root.domInputs,
      selection: () => ws.session.getSnapshot().selection,
      itemOfRecord: (i) => ws.itemOfRecord(i),
      pageContent: () => ({ kind: "node", id: at }),
      newId: ws.newId,
    });
    const set = (value) => ({ kind: "set", value });
    const newOf = (type, before) =>
      [...r.canvasInputs.values()].find(
        (x) => r.typeOf(x) === type && !before.has(x.id),
      );
    const sources = [];
    for (const c of cases) {
      ws.selectRecords([]);
      let at;
      if (c.form) {
        const before = new Set(r.canvasInputs.keys());
        ws.execute(h.palette.catalogPaletteInsertPlan(ctx(), "Form").command);
        const form = newOf("Form", before);
        ws.execute(
          h.commands.setFields({
            targets: [{ kind: "node", id: form.sourceId }],
            props: Object.fromEntries(
              Object.entries(c.form).map(([k, v]) => [k, set(v)]),
            ),
          }),
        );
        at = form.sourceId;
        // (the Form's own sample fields stay — the TokenField goes after them)
      }
      ws.selectRecords([]);
      const before = new Set(r.canvasInputs.keys());
      ws.execute(
        h.palette.catalogPaletteInsertPlan(ctx(at), "TokenField").command,
      );
      const field = newOf("TokenField", before);
      sources.push(field.sourceId);
      if (Object.keys(c.props).length)
        ws.execute(
          h.commands.setFields({
            targets: [{ kind: "node", id: field.sourceId }],
            props: Object.fromEntries(
              Object.entries(c.props).map(([k, v]) => [k, set(v)]),
            ),
          }),
        );
      if (c.width)
        ws.execute(
          h.commands.setFields({
            targets: [{ kind: "node", id: field.sourceId }],
            sizing: { width: set(c.width) },
          }),
        );
    }
    ws.selectRecords([]);
    const g = (id) => r.getGeometry([id]).get(id);
    const fields = sources.map(
      (source) =>
        [...r.canvasInputs.values()].find(
          (x) => x.sourceId === source && r.typeOf(x) === "TokenField",
        ),
    );
    return fields.map((field, i) => {
      // geometry is parent-relative — walk down from the field
      let group = null;
      let input = null;
      let row = null;
      let error = null;
      const walk = (id, ox, oy) => {
        const node = r.canvasInputs.get(id);
        const rect = g(id);
        if (!node || !rect) return;
        const x = ox + rect.x;
        const y = oy + rect.y;
        const box = { id, x, y, w: rect.width, h: rect.height };
        if (r.typeOf(node) === "Group" && !group)
          group = { ...box, invalid: node.derivedProps?.isInvalid === true };
        if (
          r.typeOf(node) === "FieldError" &&
          r.layoutInputs.get(id)?.hidden !== true
        )
          error = box;
        if (r.typeOf(node) === "FieldLabel" && !row) row = box;
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
        row,
        error,
        labelPosition: field.props.labelPosition,
        labelColor: label?.derivedProps?.color,
        // (the Canvas aligns the label row — `justify-content`, as the sheet's on the row)
        labelTextAlign: [...r.canvasInputs.values()].find(
          (x) => r.typeOf(x) === "FieldLabel" && x.parentId === field.id,
        )?.layout?.justifyContent,
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
          c.input.size === (CASES[i].props.size ?? CASES[i].size) &&
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
          row: field.querySelector(".react-aria-FieldLabel")
            ? rel(field.querySelector(".react-aria-FieldLabel"))
            : null,
          error: field.querySelector(".react-aria-FieldError")
            ? rel(field.querySelector(".react-aria-FieldError"))
            : null,
          errorId: field.querySelector(".react-aria-FieldError")?.id ?? null,
          errorText:
            field.querySelector(".react-aria-FieldError")?.textContent ?? null,
          aria: ((t) =>
            t && {
              role: t.getAttribute("role"),
              required: t.getAttribute("aria-required"),
              invalid: t.getAttribute("aria-invalid"),
              describedby: t.getAttribute("aria-describedby"),
            })(input),
          labelText: field.querySelector(".react-aria-Label")?.textContent ?? null,
          labelHasSvg: !!field.querySelector(".react-aria-Label svg"),
          errorIcon: !!group.querySelector("[data-field-error-icon]"),
          dataLabelPosition: field.getAttribute("data-label-position"),
          labelTextAlign: getComputedStyle(
            field.querySelector(".react-aria-Label"),
          ).textAlign,
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
    .filter(
      ({ c, d }) =>
        !same(c.group, d.group) ||
        !same(c.input, d.input) ||
        !same(c.row, d.row) ||
        (c.error || d.error ? !same(c.error, d.error) : false),
    )
    .map(({ c, d }) => ({
      key: c.key,
      canvas: { group: c.group, input: c.input, row: c.row, error: c.error },
      dom: { group: d.group, input: d.input, row: d.row, error: d.error },
    }));
  record("② Publish — Group and TokenInput boxes = Canvas (±0.5)", diffs.length === 0, {
    diffs,
    narrow: {
      canvas: canvas.find((c) => c.key === "tokens-narrow")?.input?.h,
      dom: dom.find((d) => d.key === "tokens-narrow")?.input?.h,
    },
    twoLines: {
      canvas: canvas.find((c) => c.key === "two-lines")?.input?.h,
      dom: dom.find((d) => d.key === "two-lines")?.input?.h,
    },
  });
  const radius = { S: "7px", M: "8px", L: "9px", XL: "10px" };
  const shapeBad = dom.filter((d, i) => {
    const size = CASES[i].props.size ?? CASES[i].size;
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
  // ⑦ Phase 2 — side: label row in column 1 at the input's first line, the box in column 2 at the top;
  //   a side Form's layout reaches a field that set none; labelAlign end right-aligns the label
  const side = (key) => ({
    canvas: canvas.find((c) => c.key === key),
    dom: dom.find((d) => d.key === key),
  });
  const sideBad = ["side", "side-end-L", "form-side"].filter((key) => {
    const { canvas: c, dom: d } = side(key);
    return !(
      d?.dataLabelPosition === "side" &&
      c?.labelPosition === "side" &&
      c.row &&
      c.row.x === 0 &&
      c.group.x >= c.row.w &&
      c.group.y === 0 &&
      c.row.y > 0
    );
  });
  record(
    "⑦ side — label row in column 1 at the first line, box in column 2 (Canvas · Publish; a side Form's too)",
    sideBad.length === 0,
    {
      bad: sideBad,
      side: ["side", "side-end-L", "form-side"].map((key) => {
        const { canvas: c, dom: d } = side(key);
        return { key, canvas: { row: c?.row, group: c?.group, pos: c?.labelPosition }, dom: { row: d?.row, group: d?.group, pos: d?.dataLabelPosition } };
      }),
    },
  );
  record(
    "⑧ labelAlign end — the side label's text is end-aligned on both consumers (start elsewhere)",
    side("side-end-L").dom?.labelTextAlign === "end" &&
      side("side").dom?.labelTextAlign === "start" &&
      side("side-end-L").canvas?.labelTextAlign === "end" &&
      side("side").canvas?.labelTextAlign === "start",
    {
      dom: [side("side").dom?.labelTextAlign, side("side-end-L").dom?.labelTextAlign],
      canvas: [side("side").canvas?.labelTextAlign, side("side-end-L").canvas?.labelTextAlign],
    },
  );
  // ⑨ Phase 3 — the Token chip: the rule's inline box on the Publish (display inline · border 1 · radius sm ·
  //   padding text-to-visual · the Tag fill), drawn on the Canvas too (the chip border's pixels in the
  //   TokenInput, both consumers — a wrapping value's height is ② already)
  const chipStyle = await pub.evaluate((ids) =>
    ids.map(({ key, fieldId }) => {
      const token = document
        .querySelector(`[data-catalog-id="${CSS.escape(fieldId)}"]`)
        ?.querySelector(".react-aria-Token");
      if (!token) return { key, missing: true };
      const cs = getComputedStyle(token);
      return {
        key,
        count: token
          .closest(".react-aria-TokenInput")
          .querySelectorAll(".react-aria-Token").length,
        variant: token.getAttribute("data-variant"),
        display: cs.display,
        border: cs.borderTopWidth,
        borderColor: cs.borderTopColor,
        radius: cs.borderTopLeftRadius,
        padding: [cs.paddingLeft, cs.paddingTop],
        background: cs.backgroundColor,
        color: cs.color,
        weight: cs.fontWeight,
      };
    }),
  canvas.filter((c) => c.key.startsWith("tokens")).map((c) => ({ key: c.key, fieldId: c.fieldId })));
  const chipM = chipStyle.find((c) => c.key === "tokens");
  const chipL = chipStyle.find((c) => c.key === "tokens-L");
  record(
    "⑨ Publish — a Token is the rule's inline chip (inline · border 1 · radius 4 · padding 6 / 7 · Tag fill)",
    chipM?.count >= 4 &&
      chipM.variant === "default" &&
      chipM.display === "inline" &&
      chipM.border === "1px" &&
      chipM.radius === "4px" &&
      chipM.padding[0] === "6px" &&
      chipM.padding[1] === "0px" &&
      chipL?.padding[0] === "7px" &&
      chipM.background !== "rgba(0, 0, 0, 0)",
    chipStyle,
  );
  // pixels of the chip border color inside each consumer's TokenInput (a clip of the screenshot)
  const parseRgb = (css) => css.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
  const target = parseRgb(chipM.borderColor);
  const countIn = async (where, clip) => {
    const png = await where.screenshot({ clip });
    return where.evaluate(
      async ({ b64, rgb }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4)
          if (
            Math.abs(d[i] - rgb[0]) <= 6 &&
            Math.abs(d[i + 1] - rgb[1]) <= 6 &&
            Math.abs(d[i + 2] - rgb[2]) <= 6
          )
            n++;
        return n;
      },
      { b64: png.toString("base64"), rgb: target },
    );
  };
  const pixelsOf = async (key) => {
    const tokensCanvas = canvas.find((c) => c.key === key);
    // (zoom 1 · the field on screen: the chip border's 1px stays whole pixels on both)
    await page.bringToFront();
    await page.evaluate((id) => {
      const h = window.__COMPOSITION_CATALOG__;
      const b = h.canvas.boundsOf(id);
      h.canvas.setCamera({ scale: 1, x: 40 - b.x, y: 120 - b.y });
    }, tokensCanvas.input.id);
    await page.waitForTimeout(800);
    const canvasClip = await page.evaluate((id) => {
      const h = window.__COMPOSITION_CATALOG__;
      const b = h.canvas.boundsOf(id);
      const cam = h.canvas.camera();
      const el =
        document.querySelector('[data-canvas-container="true"]') ??
        document.querySelector('[data-catalog-canvas="true"]');
      const r = el.getBoundingClientRect();
      return {
        x: r.left + b.x * cam.zoom + cam.x,
        y: r.top + b.y * cam.zoom + cam.y - 3,
        width: b.width * cam.zoom,
        height: b.height * cam.zoom + 6,
        zoom: cam.zoom,
      };
    }, tokensCanvas.input.id);
    const pubClip = await pub.evaluate((fieldId) => {
      const b = document
        .querySelector(`[data-catalog-id="${CSS.escape(fieldId)}"]`)
        .querySelector(".react-aria-TokenInput")
        .getBoundingClientRect();
      return { x: b.x, y: b.y - 3, width: b.width, height: b.height + 6 };
    }, tokensCanvas.fieldId);
    await page.screenshot({ path: `${OUT}/4-canvas-${key}.png`, clip: canvasClip });
    const canvasPixels = await countIn(page, canvasClip);
    await pub.bringToFront();
    await pub.screenshot({ path: `${OUT}/4-publish-${key}.png`, clip: pubClip });
    const pubPixels = await countIn(pub, pubClip);
    return { key, canvasPixels, pubPixels, zoom: canvasClip.zoom };
  };
  // (the narrow case: a chip's edge left at the end of the previous line adds border pixels — 11-23)
  const pixels = [await pixelsOf("tokens"), await pixelsOf("tokens-narrow")];
  record(
    "⑩ Canvas — the chips are drawn: their border color in the TokenInput, as many as the Publish's (±10%, one line · wrapped)",
    pixels.every(
      (p) =>
        p.zoom === 1 &&
        p.pubPixels > 50 &&
        Math.abs(p.canvasPixels - p.pubPixels) <= p.pubPixels * 0.1,
    ),
    { target, pixels },
  );
  // ⑪ Phase 4 — the D1 exception: the textbox carries the field's necessity · error, its
  //   aria-describedby names the error text; the box is invalid (and shows the S2 error icon) on both
  //   consumers; a valid · optional field carries none
  const inv = side("invalid");
  const req = side("required-label");
  const plainAria = dom.find((d) => d.key === "M")?.aria;
  const described = (inv.dom?.aria?.describedby ?? "").split(" ");
  record(
    "⑪ D1 exception — textbox aria-required · aria-invalid · aria-describedby → the error text (Publish); invalid box on both",
    inv.dom?.aria?.role === "textbox" &&
      inv.dom.aria.required === "true" &&
      inv.dom.aria.invalid === "true" &&
      !!inv.dom.errorId &&
      described.includes(inv.dom.errorId) &&
      inv.dom.errorText === "Pick at least one person" &&
      inv.dom.groupAttrs.includes("data-invalid") &&
      inv.dom.errorIcon &&
      inv.canvas?.group?.invalid === true &&
      !!inv.canvas?.error &&
      req.dom?.aria?.required === "true" &&
      req.dom.aria.invalid === null &&
      plainAria?.required === null &&
      plainAria?.invalid === null,
    {
      invalid: { aria: inv.dom?.aria, errorId: inv.dom?.errorId, errorText: inv.dom?.errorText, groupAttrs: inv.dom?.groupAttrs, errorIcon: inv.dom?.errorIcon, canvasInvalid: inv.canvas?.group?.invalid, canvasError: inv.canvas?.error, domError: inv.dom?.error },
      requiredLabel: req.dom?.aria,
      plain: plainAria,
    },
  );
  record(
    "⑫ necessity — the icon (*) and the (required) label on the Publish; the label rows = Canvas (②)",
    inv.dom?.labelHasSvg === true &&
      // (the page locale's necessity text — "(required)" · "(필수 사항)")
      /\(.+\)/.test(req.dom?.labelText ?? "") &&
      !req.dom?.labelHasSvg &&
      dom.find((d) => d.key === "M")?.labelHasSvg === false,
    { invalid: [inv.dom?.labelText, inv.dom?.labelHasSvg], requiredLabel: req.dom?.labelText },
  );
  record("⑥ no page errors", errors.length === 0, errors);
} finally {
  writeFileSync(
    `${OUT}/result.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
  await browser.close();
}
