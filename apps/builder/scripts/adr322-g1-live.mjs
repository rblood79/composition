#!/usr/bin/env node
// ADR-322 G1 live — Cascader 의 닫힌 필드 (Phase 1): 실제 Builder 에서 팔레트로 Cascader 를 놓고, 작성 값을
// 바꿀 때마다 Canvas (record 상자 = 엔진 · 값 글자 = record 의 파생 글자 · 화면 픽셀 = Skia) 와 Publish DOM
// (Chrome 의 `getBoundingClientRect` · computed style · 접근성 이름 — 기준값, Q5) 을 대조한다.
//   1. 팔레트 「cascader」 → Cascader > 라벨 행 · 여는 Button (SelectValue + Icon) · 항목 11 (Canvas 에 그리지 않음)
//   2. 상태마다 (기본 · 시작 값 · L + 끝 항목만 · Side 라벨 · 비활성 + 오류 · 설명):
//      a. 필드 · 라벨 행 · Label · Button · 값 · glyph 의 상자 = Publish 상자 (±1 px)
//      b. 값 글자 = Publish 의 값 글자, placeholder 표시 일치
//      c. Button 바탕 픽셀 (Canvas 화면) = Publish 의 computed 바탕
//   3. HC2 — Publish 필드 `div` 에 role · aria 0, Button 의 이름 = 값 + 라벨 (RAC prop), 항목 요소 0
//   4. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr322-g1-live.mjs <out-dir> [--headless]
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr322-g1-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const HEADLESS = process.argv.includes("--headless");

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1400)}\n`,
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

const VISIBLE = [
  "Cascader",
  "FieldLabel",
  "Label",
  "Button",
  "SelectValue",
  "Icon",
  "Description",
  "FieldError",
];

/** The field's records (Canvas): drawn parts' boxes relative to the field, the value text, items. */
const canvasRecords = () =>
  page.evaluate((visible) => {
    const { workspace: ws, canvas } = window.__COMPOSITION_CATALOG__;
    const r = ws.root;
    const field = [...r.canvasInputs.values()].find(
      (x) => r.typeOf(x) === "Cascader",
    );
    if (!field) return null;
    const rows = [];
    const items = [];
    const visit = (id) => {
      const rec = r.canvasInputs.get(id);
      if (!rec) return;
      const type = r.typeOf(rec);
      if (type === "CascaderItem") {
        items.push({ id, hidden: rec.hidden === true });
        for (const child of rec.children) visit(child);
        return;
      }
      if (rec.hidden) return;
      if (visible.includes(type)) rows.push({ id, type });
      for (const child of rec.children) visit(child);
    };
    visit(field.id);
    const g = canvas.boundsOf(field.id);
    return {
      items,
      rows: rows.map(({ id, type }) => {
        const rec = r.canvasInputs.get(id);
        const b = canvas.boundsOf(id);
        const derived = rec.derivedProps?.children;
        return {
          id,
          type,
          text:
            type === "SelectValue"
              ? typeof derived === "string"
                ? derived
                : String(rec.props.children ?? "")
              : undefined,
          placeholder:
            type === "SelectValue" ? typeof derived !== "string" : undefined,
          x: b.x - g.x,
          y: b.y - g.y,
          w: b.width,
          h: b.height,
        };
      }),
    };
  }, VISIBLE);

const setProps = (recordId, props) =>
  page.evaluate(
    ({ recordId, props }) => {
      const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
      ws.execute(
        c.setFields({
          targets: [ws.itemOfRecord(recordId).target],
          props: Object.fromEntries(
            Object.entries(props).map(([k, v]) => [
              k,
              v === null ? { kind: "remove" } : { kind: "set", value: v },
            ]),
          ),
        }),
      );
    },
    { recordId, props },
  );

/** A Canvas screen pixel at a point of a record's box (scene px from its corner). */
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

const publish = async (ids, fieldId) => {
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
  await pub.waitForSelector(".react-aria-Cascader", { timeout: 60000 });
  await pub.waitForTimeout(800);
  const out = await pub.evaluate(
    ({ ids, fieldId }) => {
      const of = (id) =>
        document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
      const field = of(fieldId);
      const g = field.getBoundingClientRect();
      const rgb = (v) =>
        (String(v).match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
      const button = field.querySelector("button");
      const value = field.querySelector(".react-aria-SelectValue");
      const nameOf = (el) =>
        (el.getAttribute("aria-labelledby") ?? "")
          .split(/\s+/)
          .filter(Boolean)
          .map((id) => document.getElementById(id)?.textContent?.trim() ?? "?")
          .join(" | ") || el.getAttribute("aria-label");
      return {
        boxes: ids.map((id) => {
          const el = of(id);
          if (!el) return { id, missing: true };
          const b = el.getBoundingClientRect();
          return { id, x: b.x - g.x, y: b.y - g.y, w: b.width, h: b.height };
        }),
        value: value?.textContent ?? null,
        placeholder: value?.hasAttribute("data-placeholder") ?? null,
        buttonBg: button ? rgb(getComputedStyle(button).backgroundColor) : null,
        buttonName: button ? nameOf(button) : null,
        buttonDescribed: button?.getAttribute("aria-describedby") ?? null,
        fieldAria: field
          .getAttributeNames()
          .filter((n) => n === "role" || n.startsWith("aria-")),
        itemElements: field.querySelectorAll(".react-aria-CascaderItem").length,
        hints: {
          Description: !!field.querySelector('[slot="description"]'),
          FieldError: !!field.querySelector(".react-aria-FieldError"),
        },
        fieldText: field.textContent,
      };
    },
    { ids, fieldId },
  );
  await pub.screenshot({ path: `${OUT}/publish-${Date.now()}.png` });
  await pub.close();
  return out;
};

const hexRgb = (value) => {
  const hex = /^#([0-9a-f]{6})/i.exec(String(value ?? ""));
  if (!hex) return [];
  const n = Number.parseInt(hex[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
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
  await page.keyboard.type("adr322 g1 live");
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

  const rail = railButton(page, "components");
  if ((await rail.getAttribute("aria-pressed")) !== "true") {
    await rail.click();
    await page.waitForTimeout(900);
  }
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
  );
  const item = page
    .locator("button, [role='button'], [role='option'], [role='gridcell']")
    .filter({ hasText: /^cascader$/i })
    .first();
  await item.waitFor({ state: "visible", timeout: 15000 });
  await item.click();
  await page.waitForTimeout(1500);
  let placed = await canvasRecords();
  record(
    "1 팔레트 → Cascader > 라벨 행 · Button (값 + glyph) · 항목 11 (Canvas 에 그리지 않음)",
    !!placed &&
      placed.rows.map((row) => row.type).join(",") ===
        "Cascader,FieldLabel,Label,Button,SelectValue,Icon" &&
      placed.items.length === 11 &&
      placed.items.every((i) => i.hidden),
    placed && {
      rows: placed.rows.map((row) => row.type),
      items: placed.items.length,
      hidden: placed.items.filter((i) => i.hidden).length,
    },
  );
  if (!placed) throw new Error("no field");
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
  );
  if ((await rail.getAttribute("aria-pressed")) === "true") await rail.click();
  await page.mouse.move(960, 900);
  await page.waitForTimeout(600);

  const fieldId = placed.rows[0].id;
  const STATES = [
    {
      id: "2 기본 (M · placeholder)",
      props: {},
      expect: "Choose an option...",
    },
    {
      id: "3 시작 값 (경로 전체)",
      props: { defaultValue: "laptops" },
      expect: "Electronics / Computers / Laptops",
    },
    {
      id: "4 L · 끝 항목만",
      props: { size: "L", displayMode: "leaf" },
      expect: "Laptops",
    },
    {
      id: "5 Side 라벨 · S · 경로",
      props: { size: "S", displayMode: "path", labelPosition: "side" },
      expect: "Electronics / Computers / Laptops",
    },
    {
      id: "6 비활성 · 오류 · 설명 (M · top)",
      props: {
        size: "M",
        labelPosition: "top",
        isDisabled: true,
        isInvalid: true,
        errorMessage: "Pick a category",
        description: "Where it is listed",
      },
      expect: "Electronics / Computers / Laptops",
    },
  ];
  for (const s of STATES) {
    if (Object.keys(s.props).length) await setProps(fieldId, s.props);
    await page.waitForTimeout(900);
    placed = await canvasRecords();
    const rows = placed.rows;
    const pub = await publish(
      rows.map((row) => row.id),
      fieldId,
    );
    const worst = rows.map((row, i) => {
      const p = pub.boxes[i];
      if (!p || p.missing) return { type: row.type, missing: true };
      const d = Math.max(
        Math.abs(row.x - p.x),
        Math.abs(row.y - p.y),
        Math.abs(row.w - p.w),
        Math.abs(row.h - p.h),
      );
      return { type: row.type, d: Math.round(d * 100) / 100 };
    });
    record(
      `${s.id} — a. 상자 ±1 px (필드 · 라벨 행 · Label · Button · 값 · glyph)`,
      worst.every((w) => !w.missing && w.d <= 1),
      worst,
    );
    const value = rows.find((row) => row.type === "SelectValue");
    record(
      `${s.id} — b. 값 글자 Canvas = Publish = 「${s.expect}」 · placeholder 표시 일치`,
      value?.text === s.expect &&
        pub.value === s.expect &&
        value?.placeholder === pub.placeholder,
      {
        canvas: value?.text,
        publish: pub.value,
        placeholder: [value?.placeholder, pub.placeholder],
      },
    );
    const button = rows.find((row) => row.type === "Button");
    const px = await canvasPixel(button.id, 3, button.h / 2);
    record(
      `${s.id} — c. Button 바탕 픽셀 Canvas = Publish computed`,
      near(px, pub.buttonBg ?? [], 6),
      { canvas: px, publish: pub.buttonBg },
    );
    if (s.id.startsWith("6"))
      record(
        "6 — d. 설명 · 오류 문구의 있음 Canvas = Publish (오류 상태 — S2 HelpText 는 오류 문구가 설명 자리)",
        ["Description", "FieldError"].every(
          (type) => rows.some((row) => row.type === type) === pub.hints[type],
        ) && pub.hints.FieldError,
        {
          canvas: rows.map((row) => row.type).filter((t) => t in pub.hints),
          publish: pub.hints,
        },
      );
    if (s.id.startsWith("6"))
      record(
        "7 HC2 — 필드 div role · aria 0 · Button 이름 = 값 + 라벨 (RAC prop) · 설명 연결 · 항목 요소 0",
        pub.fieldAria.length === 0 &&
          pub.buttonName === "Electronics / Computers / Laptops | Category" &&
          !!pub.buttonDescribed &&
          pub.itemElements === 0 &&
          !pub.fieldText.includes("Desktops"),
        {
          fieldAria: pub.fieldAria,
          name: pub.buttonName,
          describedBy: pub.buttonDescribed,
          items: pub.itemElements,
        },
      );
  }
  await page.screenshot({ path: `${OUT}/builder.png` });
} catch (error) {
  record("실행 오류", false, String(error).split("\n").slice(0, 3).join(" | "));
}
record("8 page error 0", errors.length === 0, errors.slice(0, 4));
await browser.close();
const failed = results.filter((r) => !r.pass).length;
process.stdout.write(
  `\n${failed ? `FAIL ${failed}` : `ALL PASS ${results.length}`}\n`,
);
process.exit(failed ? 1 : 0);
