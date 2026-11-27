#!/usr/bin/env node
// ADR-321 G1 live — StepList 의 정적 모양 (Phase 1): 실제 Builder 에서 팔레트로 StepList 를 놓고, 작성 값을
// 바꿀 때마다 Canvas (record 상자 = 엔진 · 화면 픽셀 = Skia 가 그린 것) 와 Publish DOM (Chrome 의
// `getBoundingClientRect` · computed style — 기준값, Q5) 을 대조한다.
//   1. 팔레트 「step list」 → StepList > Step × 3 (record · Layers), 시작 상태 완료 · 현재 · 남음
//   2. 상태마다 (기본 · XL 강조 · 세로 L · 설명과 긴 라벨 · 비활성 단계):
//      a. 목록 · 단계 · 글자의 record 상자 = Publish 상자 (±1 px)
//      b. Publish 의 표식 · 선 자리에서 Canvas 화면 픽셀의 색 = Publish 의 그 요소 색
//      c. 글자 색 (record 의 파생 색 = Publish computed color)
//   3. HC2 — Publish 의 목록 = RAC Group (`role="group"` · 이름) > `ol` > `li`, `ol` · `li` 에 role · aria 속성 0
//   4. Design 「+」 로 단계 추가 → 4 단계 · undo → 3 단계
//   5. page error 0
//
//   BUILDER_URL=http://localhost:5174 AUTH_STATE=<.auth-session.json> node apps/builder/scripts/adr321-g1-live.mjs <out-dir>
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr321-g1-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const HEADLESS = process.argv.includes("--headless");

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1500)}\n`,
  );
};

const state = JSON.parse(
  readFileSync(
    process.env.AUTH_STATE ?? `${REPO}/apps/builder/scripts/.auth-session.json`,
    "utf8",
  ),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({
  headless: HEADLESS,
  channel: "chrome",
});
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1920, height: 1100 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

const openRail = async (id) => {
  const button = railButton(page, id);
  if ((await button.getAttribute("aria-pressed")) !== "true") {
    await button.click();
    await page.waitForTimeout(900);
  }
};

/** The list's records (Canvas): the list, its steps and their shown texts — boxes relative to the list. */
const canvasRecords = () =>
  page.evaluate(() => {
    const { workspace: ws, canvas } = window.__COMPOSITION_CATALOG__;
    const r = ws.root;
    const list = [...r.canvasInputs.values()].find(
      (x) => r.typeOf(x) === "StepList",
    );
    if (!list) return null;
    const rows = [];
    const visit = (id, depth) => {
      const rec = r.canvasInputs.get(id);
      if (!rec || rec.hidden) return;
      rows.push({ id, depth });
      for (const child of rec.children) visit(child, depth + 1);
    };
    visit(list.id, 0);
    const geo = r.getGeometry(rows.map((row) => row.id));
    const g = canvas.boundsOf(list.id);
    return rows.map(({ id }) => {
      const rec = r.canvasInputs.get(id);
      const b = canvas.boundsOf(id);
      return {
        id,
        node: rec.sourceId,
        type: r.typeOf(rec),
        state: rec.derivedProps?._stepState,
        number: rec.derivedProps?._stepNumber,
        color: rec.derivedProps?.color,
        text: rec.props?.children,
        x: b && b.x - g.x,
        y: b && b.y - g.y,
        w: b?.width ?? geo.get(id)?.width,
        h: b?.height ?? geo.get(id)?.height,
      };
    });
  });

const setProps = (recordId, props) =>
  page.evaluate(
    ({ recordId, props }) => {
      const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
      ws.execute(
        c.setFields({
          targets: [ws.itemOfRecord(recordId).target],
          ...props,
        }),
      );
    },
    {
      recordId,
      props: Object.fromEntries(
        Object.entries(props).map(([field, values]) => [
          field,
          Object.fromEntries(
            Object.entries(values).map(([k, v]) => [
              k,
              v === null ? { kind: "remove" } : { kind: "set", value: v },
            ]),
          ),
        ]),
      ),
    },
  );

/** A Canvas screen pixel (what Skia drew) at a point of a record's box, in scene px from its corner. */
const canvasPixel = async (recordId, dx, dy) => {
  const point = await page.evaluate(
    ({ recordId, dx, dy }) => {
      const { canvas } = window.__COMPOSITION_CATALOG__;
      const box = canvas.boundsOf(recordId);
      const camera = canvas.camera();
      const rect = document
        .querySelector('[data-catalog-canvas="true"]')
        .getBoundingClientRect();
      return {
        x: rect.left + camera.x + (box.x + dx) * camera.zoom,
        y: rect.top + camera.y + (box.y + dy) * camera.zoom,
        zoom: camera.zoom,
      };
    },
    { recordId, dx, dy },
  );
  const shot = await page.screenshot({
    clip: {
      x: Math.floor(point.x),
      y: Math.floor(point.y),
      width: 1,
      height: 1,
    },
  });
  const png = PNG.sync.read(shot);
  return [png.data[0], png.data[1], png.data[2]];
};

/** Publish: the same records' boxes (relative to the list), the steps' visual · track and paints. */
const publish = async (ids) => {
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
  await pub.waitForSelector(".react-aria-StepList", { timeout: 60000 });
  await pub
    .waitForFunction(
      (ids) =>
        ids.every((id) =>
          document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`),
        ),
      ids,
      { timeout: 30000 },
    )
    .catch(() => {});
  await pub.waitForTimeout(600);
  const out = await pub.evaluate((ids) => {
    const of = (id) =>
      document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
    const g = of(ids[0])?.getBoundingClientRect();
    const rgb = (value) =>
      (String(value).match(/\d+(\.\d+)?/g) ?? []).slice(0, 4).map(Number);
    return ids.map((id) => {
      const el = of(id);
      const b = el?.getBoundingClientRect();
      if (!el || !b || !g) return { id, missing: true };
      const part = (selector) => {
        const child = el.querySelector(selector);
        if (!child) return null;
        const box = child.getBoundingClientRect();
        const style = getComputedStyle(child);
        return {
          x: box.x - b.x,
          y: box.y - b.y,
          w: box.width,
          h: box.height,
          bg: rgb(style.backgroundColor),
          border:
            Number.parseFloat(style.borderTopWidth) > 0
              ? rgb(style.borderTopColor)
              : null,
          text: child.textContent,
          check: !!child.querySelector("svg"),
        };
      };
      return {
        id,
        tag: el.tagName.toLowerCase(),
        cls: String(el.className),
        attrs: el
          .getAttributeNames()
          .filter((name) => name === "role" || name.startsWith("aria-")),
        role: el.getAttribute("role"),
        name: el.getAttribute("aria-label"),
        inner: [...el.children].map((child) => ({
          tag: child.tagName.toLowerCase(),
          cls: String(child.className),
          attrs: child
            .getAttributeNames()
            .filter((name) => name === "role" || name.startsWith("aria-")),
        })),
        color: rgb(getComputedStyle(el).color),
        fontSize: Number.parseFloat(getComputedStyle(el).fontSize),
        x: b.x - g.x,
        y: b.y - g.y,
        w: b.width,
        h: b.height,
        visual: part(":scope > .step-link > .step-visual"),
        track: part(":scope > .step-track"),
      };
    });
  }, ids);
  await pub.screenshot({ path: `${OUT}/publish-${Date.now()}.png` });
  await pub.close();
  return out;
};

const hexRgb = (value) => {
  const text = String(value ?? "");
  const hex = /^#([0-9a-f]{6})/i.exec(text);
  if (hex) {
    const n = Number.parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return (text.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
};
const near = (a, b, tolerance) =>
  a.length >= 3 &&
  b.length >= 3 &&
  [0, 1, 2].every((i) => Math.abs(a[i] - b[i]) <= tolerance);

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("adr321 g1 live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  // 1. Palette → the StepList.
  await openRail("components");
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
  );
  const item = page
    .locator("button, [role='button'], [role='option'], [role='gridcell']")
    .filter({ hasText: /^step list$/i })
    .first();
  await item.waitFor({ state: "visible", timeout: 15000 });
  await item.click();
  await page.waitForTimeout(1500);
  let placed = await canvasRecords();
  const steps = () => placed.filter((row) => row.type === "Step");
  record(
    "1 팔레트 → StepList > Step × 3 (완료 · 현재 · 남음)",
    !!placed &&
      placed[0].type === "StepList" &&
      steps()
        .map((row) => `${row.state}:${row.number}`)
        .join(",") === "completed:1,current:2,incomplete:3",
    placed?.map((row) => `${row.type}${row.state ? `:${row.state}` : ""}`),
  );
  if (!placed) throw new Error("no list");
  // (Deselect and close the floating panel — the selection overlay and the panel are drawn over the
  //  Canvas pixels read below.)
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
  );
  const rail = railButton(page, "components");
  if ((await rail.getAttribute("aria-pressed")) === "true") await rail.click();
  await page.mouse.move(960, 900);
  await page.waitForTimeout(600);

  const listId = placed[0].id;
  const stepIds = steps().map((row) => row.id);
  const STATES = [
    { id: "2 기본 (가로 M)" },
    { id: "3 XL · 강조", list: { props: { size: "XL", isEmphasized: true } } },
    {
      id: "4 세로 L",
      list: {
        props: { size: "L", isEmphasized: false, orientation: "vertical" },
      },
    },
    {
      id: "5 설명 · 긴 라벨 (가로 M · 폭 420)",
      list: {
        props: { size: "M", orientation: "horizontal" },
        visual: { width: 420 },
      },
      step: [
        0,
        {
          props: {
            label: "A much longer label that wraps onto more lines",
            description: "Before you start",
          },
        },
      ],
    },
    {
      id: "6 현재 3 번째 · 첫 단계 비활성",
      list: {
        props: { defaultSelectedKey: "step-3", disabledKeys: ["step-1"] },
      },
    },
  ];
  for (const stateSpec of STATES) {
    if (stateSpec.list) await setProps(listId, stateSpec.list);
    if (stateSpec.step)
      await setProps(stepIds[stateSpec.step[0]], stateSpec.step[1]);
    await page.waitForTimeout(800);
    placed = await canvasRecords();
    const dom = await publish(placed.map((row) => row.id));
    await page.bringToFront();
    await page.waitForTimeout(300);
    // a. boxes
    const bad = [];
    placed.forEach((c, i) => {
      const d = dom[i];
      if (!d || d.missing) return bad.push(`${c.type}: DOM 없음`);
      for (const [f, g] of [
        ["x", "x"],
        ["y", "y"],
        ["w", "w"],
        ["h", "h"],
      ])
        if (Math.abs(c[f] - d[g]) > 1)
          bad.push(
            `${c.type}#${i}.${f}: canvas=${c[f]?.toFixed(1)} dom=${d[g].toFixed(1)}`,
          );
    });
    record(
      `${stateSpec.id} — record 상자 = Publish 상자 (±1 px)`,
      bad.length === 0,
      {
        bad,
        canvas: placed.map((b) =>
          [b.type, b.x, b.y, b.w, b.h].map((v) =>
            typeof v === "number" ? Math.round(v * 10) / 10 : v,
          ),
        ),
      },
    );
    // b. the Canvas pixels at the Publish visual · track places
    const paint = [];
    const paintBad = [];
    for (let i = 0; i < placed.length; i++) {
      if (placed[i].type !== "Step") continue;
      const d = dom[i];
      const v = d.visual;
      if (!v) {
        paintBad.push(`${placed[i].number}: Publish 표식 없음`);
        continue;
      }
      // (Inside the circle near its top — clear of the number · check in its middle; a remaining
      //  step's circle is a border: read on its left edge's middle.)
      const fillAt = v.border
        ? await canvasPixel(placed[i].id, v.x + 1, v.y + v.h / 2)
        : await canvasPixel(
            placed[i].id,
            v.x + v.w / 2,
            v.y + Math.max(1.5, v.h * 0.12),
          );
      const want = v.border ?? v.bg;
      const row = {
        step: placed[i].number,
        state: placed[i].state,
        glyph: v.check ? "check" : v.text,
        visual: { canvas: fillAt, publish: want.slice(0, 3) },
      };
      if (!near(fillAt, want, 48))
        paintBad.push(
          `${placed[i].number} 표식: canvas=${fillAt} publish=${want}`,
        );
      if (d.track) {
        const t = d.track;
        const at = await canvasPixel(
          placed[i].id,
          t.x + t.w / 2,
          t.y + t.h / 2,
        );
        row.track = { canvas: at, publish: t.bg.slice(0, 3) };
        if (!near(at, t.bg, 48))
          paintBad.push(`${placed[i].number} 선: canvas=${at} publish=${t.bg}`);
      } else row.track = null;
      paint.push(row);
    }
    record(
      `${stateSpec.id} — Canvas 화면 픽셀 = Publish 표식 · 선 색 (그 자리)`,
      paintBad.length === 0 && paint.length === steps().length,
      { paintBad, paint },
    );
    // c. text colors
    const textBad = [];
    placed.forEach((c, i) => {
      if (c.type !== "Text") return;
      if (!near(hexRgb(c.color), dom[i].color, 1))
        textBad.push(`${c.text}: record=${c.color} publish=${dom[i].color}`);
    });
    record(
      `${stateSpec.id} — 글자 색 (record 파생 색 = Publish)`,
      textBad.length === 0,
      {
        textBad,
        colors: placed
          .filter((c) => c.type === "Text")
          .map((c) => [c.text, c.color]),
      },
    );
    if (stateSpec.id.startsWith("2"))
      record(
        "HC2 — Publish 의 목록 = RAC Group (role group · 이름) > ol > li, ol · li 에 role · aria 속성 0",
        dom[0].tag === "div" &&
          dom[0].role === "group" &&
          typeof dom[0].name === "string" &&
          dom[0].name.length > 0 &&
          dom[0].attrs.slice().sort().join() === "aria-label,role" &&
          dom[0].inner.length === 1 &&
          dom[0].inner[0].tag === "ol" &&
          dom[0].inner[0].attrs.length === 0 &&
          dom
            .filter((_, i) => placed[i].type === "Step")
            .every((d) => d.tag === "li" && d.attrs.length === 0),
        dom
          .filter((_, i) => placed[i].type !== "Text")
          .map((d) => [d.tag, d.cls.split(" ")[0], d.attrs, d.name ?? null])
          .concat([dom[0].inner.map((c) => [c.tag, c.cls, c.attrs])]),
      );
    await page.screenshot({
      path: `${OUT}/${stateSpec.id.split(" ")[0]}-canvas.png`,
    });
  }

  // 4. Design 「+」 adds a step (one history step), undo takes it back.
  const added = await page.evaluate(async (listId) => {
    const { workspace: ws } = window.__COMPOSITION_CATALOG__;
    const { catalogItemInsertChoices } =
      await import("/src/builder/catalogRuntime/itemInsert.ts");
    const choices = catalogItemInsertChoices(
      { graph: ws.runtime.graph, readModel: ws.readModel, newId: ws.newId },
      ws.positionOfRecord(listId),
    );
    ws.execute(choices[0].build());
    return choices.map((choice) => choice.type);
  }, listId);
  await page.waitForTimeout(700);
  const four = (await canvasRecords()).filter((row) => row.type === "Step");
  await page.screenshot({ path: `${OUT}/7-added.png` });
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.undo());
  await page.waitForTimeout(700);
  const three = (await canvasRecords()).filter((row) => row.type === "Step");
  record(
    "7 Design 「+」 → 4 단계 (새 단계가 마지막 · 번호 4) · undo → 3 단계",
    added.join() === "Step" &&
      four.map((row) => row.number).join() === "1,2,3,4" &&
      three.map((row) => row.number).join() === "1,2,3",
    {
      added,
      four: four.map((r) => `${r.number}:${r.state}`),
      three: three.length,
    },
  );
  record("8 page error 0", errors.length === 0, errors.slice(0, 5));
} catch (error) {
  record("실행 오류", false, String(error).split("\n").slice(0, 3));
} finally {
  await browser.close();
  const failed = results.filter((r) => !r.pass);
  process.stdout.write(
    `\n${failed.length ? `FAIL ${failed.length}` : "ALL PASS"} (${results.length})\n`,
  );
}
