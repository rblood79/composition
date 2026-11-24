#!/usr/bin/env node
// S2 `Text` · `Heading` 글자 상속 sweep (2026-11-24, 사용자 「빌더에 text 는 정의한대로 상속개념이 모두
// 적용되었는지 다시 체크해」).
//
// 새 프로젝트에 팔레트 항목 전부를 놓고, 모든 Text · Heading 마다
//   ① Canvas record 의 글자 (크기 · 굵기 · 행간) 와 상자 높이
//   ② Publish DOM 의 같은 요소 (`data-catalog-id`) 의 computed 글자 · 상자 높이
// 를 대조한다. 크기 단계 (props.size) 가 있는 Text 는 그 출처 (owner 단계 · template 작성값) 를 함께 적는다.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-text-inherit-sweep-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-text-inherit-sweep";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";

const paletteSource = readFileSync(
  `${REPO}/apps/builder/src/builder/panels/components/paletteItems.ts`,
  "utf8",
);
const orderBlock = paletteSource.slice(
  paletteSource.indexOf("const PALETTE_ORDER"),
);
const TYPES = [
  ...new Set(
    [
      ...orderBlock
        .slice(0, orderBlock.indexOf("];"))
        .matchAll(/type: "(\w+)"/g),
    ].map((m) => m[1]),
  ),
];

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1400, height: 900 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));
page.on(
  "console",
  (m) => m.type() === "error" && errors.push(`builder console: ${m.text()}`),
);

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("S2 text inherit sweep");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  const inserted = await page.evaluate(
    async ({ TYPES }) => {
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
      const out = [];
      for (const type of TYPES) {
        try {
          ws.selectRecords([]);
          ws.execute(h.palette.catalogPaletteInsertPlan(ctx(), type).command);
          out.push({ type, ok: true });
        } catch (e) {
          out.push({ type, ok: false, error: String(e).slice(0, 200) });
        }
      }
      // Standalone Headings (not in the palette): h1 and h3 on the page, and an h3 in a 20/700 frame.
      const set = (value) => ({ kind: "set", value });
      const node = (id, def, children, props = {}, visual = {}) => ({
        kind: "node", id, definitionId: def, children, props, visual, sizing: {}, descendantOverrides: [],
      });
      ws.execute(
        h.commands.insertNodes({
          parent: { kind: "node", id: "project:node:home-body" },
          entries: [
            node("project:node:sweep-h1", "lib:definition:heading", ["project:node:sweep-h1-t"], { level: set(1) }),
            node("project:node:sweep-h1-t", "lib:definition:text", [], { children: set("Sweep h1") }),
            node("project:node:sweep-h3", "lib:definition:heading", ["project:node:sweep-h3-t"]),
            node("project:node:sweep-h3-t", "lib:definition:text", [], { children: set("Sweep h3") }),
            node("project:node:sweep-frame", "lib:definition:type-frame", ["project:node:sweep-fh", "project:node:sweep-ft"], {}, { fontSize: set(20), fontWeight: set(700) }),
            node("project:node:sweep-fh", "lib:definition:heading", ["project:node:sweep-fh-t"]),
            node("project:node:sweep-fh-t", "lib:definition:text", [], { children: set("Framed h3") }),
            node("project:node:sweep-ft", "lib:definition:text", [], { children: set("Framed text") }),
          ],
          rootIds: ["project:node:sweep-h1", "project:node:sweep-h3", "project:node:sweep-frame"],
          newId: ws.newId,
        }),
      );
      return out;
    },
    { TYPES },
  );
  await page.waitForTimeout(2500);

  const canvas = await page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const all = [...root.canvasInputs.values()];
    const byId = new Map(all.map((r) => [r.id, r]));
    const parentOf = (r) => byId.get(r.parentId);
    const texts = all.filter((r) =>
      ["Text", "Heading"].includes(root.typeOf(r)),
    );
    const geo = root.getGeometry(texts.map((t) => t.id));
    return texts.map((t) => {
      const chain = [];
      for (let p = parentOf(t); p && chain.length < 8; p = parentOf(p))
        chain.push(root.typeOf(p));
      const pick = (key) => t.derivedProps?.[key] ?? t.visual[key];
      // The placed component this Text is in (the top of the chain under the page body).
      return {
        id: t.id,
        type: root.typeOf(t),
        text: String(t.props.children ?? "").slice(0, 24),
        rawText: JSON.stringify(t.props.children)?.slice(0, 80),
        size: t.props.size,
        authoredFontSize: t.visual.fontSize,
        fontSize: Number(pick("fontSize")),
        fontWeight: Number(pick("fontWeight")),
        lineHeight: pick("lineHeight"),
        derivedFont: t.derivedProps?.fontSize !== undefined,
        ancestors: (() => {
          const ids = [];
          for (let p = parentOf(t); p && ids.length < 10; p = parentOf(p))
            ids.push(p.id);
          return ids;
        })(),
        height: geo.get(t.id)?.height,
        chain,
      };
    });
  });

  // Publish.
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
  await pub.waitForSelector("[data-catalog-id]", { timeout: 60000 });
  await pub.waitForTimeout(2500);
  const dom = await pub.evaluate((items) => {
    const out = {};
    const rules = [];
    const walk = (list) => {
      for (const rule of list) {
        if (rule.cssRules) walk(rule.cssRules);
        if (rule.selectorText && /font-(size|weight)/.test(rule.style?.cssText ?? ""))
          rules.push(rule);
        rule.__layer = undefined;
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        walk(sheet.cssRules);
      } catch {}
    }
    const fontRules = (el) =>
      rules
        .filter((r) => {
          try {
            return el.matches(r.selectorText);
          } catch {
            return false;
          }
        })
        .map(
          (r) =>
            `[${(() => {
              const names = [];
              for (let p = r.parentRule; p; p = p.parentRule) if (p.name) names.unshift(p.name);
              return names.join(".") || "unlayered";
            })()} ${r.parentStyleSheet?.href?.split("/").pop() ?? "inline"}] ${r.selectorText} { ${["font-size", "font-weight"].map((k) => r.style.getPropertyValue(k) && `${k}: ${r.style.getPropertyValue(k)}`).filter(Boolean).join("; ")} }`,
        );
    for (const { id, text, ancestors, type } of items) {
      let el = document.querySelector(`[data-catalog-id="${id}"]`);
      let via = "id";
      // (A Text RAC renders without the marker — the deepest element under its nearest marked
      //  ancestor whose words are the record's.)
      if (!el && text.trim())
        for (const a of ancestors) {
          const host = document.querySelector(`[data-catalog-id="${a}"]`);
          if (!host) continue;
          const hits = [...host.querySelectorAll("*")].filter(
            (e) =>
              e.textContent.trim() === text.trim() &&
              ![...e.children].some((c) => c.textContent.trim() === text.trim()),
          );
          el = hits[0];
          via = "ancestor";
          break;
        }
      if (!el) {
        for (const a of ancestors) {
          const host = document.querySelector(`[data-catalog-id="${a}"]`);
          if (host) {
            out[id] = { missing: true, host: host.outerHTML.slice(0, 600) };
            break;
          }
        }
        continue;
      }
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      out[id] = {
        fontSize: parseFloat(cs.fontSize),
        fontWeight: Number(cs.fontWeight),
        lineHeight: cs.lineHeight,
        height: rect.height,
        visible: rect.width > 0 && rect.height > 0,
        dataSize: el.getAttribute("data-size"),
        inlineFont: el.style.fontSize,
        tag: el.tagName.toLowerCase(),
        via,
        inlineStyle: el.getAttribute("style"),
        fontRules: fontRules(el),
      };
    }
    return out;
  }, canvas.map(({ id, text, ancestors, type }) => ({ id, text, ancestors, type })));
  await pub.screenshot({ path: `${OUT}/publish.png`, fullPage: true });

  // Every visible h1 ~ h6 of the page (CalendarHeading · Dialog titles · any RAC heading) against the
  // Canvas record of its node (`text-font.md` — the browser's h rule is the floor in both).
  const headings = await pub.evaluate(() =>
    [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        // (RAC's VisuallyHidden screen-reader headings — the Calendar's `h2` — are not drawn.)
        for (let a = el; a; a = a.parentElement)
          if (getComputedStyle(a).clipPath === "inset(50%)") return false;
        return r.width > 0 && r.height > 0 && el.closest("[data-catalog-id]");
      })
      .map((el) => {
        const cs = getComputedStyle(el);
        return {
          id: el.closest("[data-catalog-id]").getAttribute("data-catalog-id"),
          own: el.hasAttribute("data-catalog-id"),
          tag: el.tagName.toLowerCase(),
          cls: el.className,
          fontSize: parseFloat(cs.fontSize),
          fontWeight: Number(cs.fontWeight),
          height: el.getBoundingClientRect().height,
        };
      }),
  );
  const headingCanvas = await page.evaluate((ids) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const geo = root.getGeometry(ids);
    return Object.fromEntries(
      ids.map((id) => {
        const r = root.canvasInputs.get(id);
        return [
          id,
          r && {
            type: root.typeOf(r),
            fontSize: Number(r.derivedProps?.fontSize ?? r.visual.fontSize),
            fontWeight: Number(r.derivedProps?.fontWeight ?? r.visual.fontWeight),
            height: geo.get(id)?.height,
          },
        ];
      }),
    );
  }, headings.map((h) => h.id));
  const headingRows = headings.map((h) => {
    const c = headingCanvas[h.id];
    const status = !c
      ? "no-canvas"
      : !h.own
        ? "not-own"
        : Math.abs(c.fontSize - h.fontSize) > 0.05 || c.fontWeight !== h.fontWeight
          ? "FONT-MISMATCH"
          : Math.abs((c.height ?? 0) - h.height) > 1
            ? "HEIGHT-MISMATCH"
            : "ok";
    return { ...h, canvas: c, status };
  });
  writeFileSync(`${OUT}/headings.json`, JSON.stringify(headingRows, null, 2));
  const hCount = {};
  for (const r of headingRows) hCount[r.status] = (hCount[r.status] ?? 0) + 1;
  process.stdout.write(`h elements ${headingRows.length} · ${JSON.stringify(hCount)}\n`);
  for (const r of headingRows.filter((r) => r.status !== "ok"))
    process.stdout.write(
      `${r.status} ${r.tag}.${r.cls} canvas ${r.canvas?.type} ${r.canvas?.fontSize}/${r.canvas?.fontWeight}/h${r.canvas?.height} dom ${r.fontSize}/${r.fontWeight}/h${r.height}\n`,
    );

  const rows = canvas.map((c) => {
    const d = dom[c.id];
    const lh = d && parseFloat(d.lineHeight);
    const canvasLinePx =
      typeof c.lineHeight === "number"
        ? c.lineHeight < 4
          ? c.lineHeight * c.fontSize
          : c.lineHeight
        : undefined;
    const status = !d || d.missing
      ? "no-dom"
      : !d.visible
        ? "hidden"
        : Math.abs(d.fontSize - c.fontSize) > 0.05 ||
            d.fontWeight !== c.fontWeight
          ? "FONT-MISMATCH"
          : canvasLinePx !== undefined &&
              Number.isFinite(lh) &&
              Math.abs(lh - canvasLinePx) > 0.5
            ? "LINE-MISMATCH"
            : "ok";
    return { ...c, dom: d, canvasLinePx, status };
  });
  writeFileSync(
    `${OUT}/result.json`,
    JSON.stringify({ inserted, rows, errors }, null, 2),
  );
  const count = {};
  for (const r of rows.filter((r) => (r.height ?? 0) > 0))
    count[r.status] = (count[r.status] ?? 0) + 1;
  process.stdout.write(
    `inserted ${inserted.filter((i) => i.ok).length}/${inserted.length} · failed: ${inserted
      .filter((i) => !i.ok)
      .map((i) => i.type)
      .join(",")}\n`,
  );
  process.stdout.write(
    `drawn texts ${rows.filter((r) => (r.height ?? 0) > 0).length} · ${JSON.stringify(count)}\n`,
  );
  for (const r of rows.filter(
    (r) => /MISMATCH/.test(r.status) && (r.height ?? 0) > 0,
  ))
    process.stdout.write(
      `${r.status} ${r.type} "${r.text}" [${r.chain.slice(0, 4).join("<")}] size=${r.size} canvas ${r.fontSize}/${r.fontWeight}/${r.canvasLinePx} dom ${r.dom.fontSize}/${r.dom.fontWeight}/${r.dom.lineHeight}\n`,
    );
  process.stdout.write(
    `errors ${errors.length}: ${errors.slice(0, 5).join(" | ")}\n`,
  );
} finally {
  await browser.close();
}
