#!/usr/bin/env node
/**
 * ADR-205 Phase 4 착수 판정 — 인라인 fontSize 의 표기별 도달 (live).
 *
 * 단위 probe 는 `buildSpecNodeData` 에서 px 문자열이 16 으로 떨어지는 것을 보였다.
 * 그것이 production 에서도 그런지, 아니면 레이아웃 pass 가 중간에 정규화하는지는
 * live 만 가른다 (memory: infra-exists-vs-wired-consumption-path).
 */
import { chromium } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";
const TEXT = "ab cd ef gh ij kl mn op";
const BASE = {
  position: "absolute",
  left: "40px",
  width: "150px",
  fontFamily: "Arial",
  lineHeight: "40px",
};
const CASES = [
  ["px문자열 23px", "fs-str", { fontSize: "23px" }],
  ["숫자 23", "fs-num", { fontSize: 23 }],
  ["대조군 16px(=fallback)", "fs-ctl", { fontSize: "16px" }],
];

const READY = () =>
  Boolean(
    window.__composition_STORE__ &&
    window.__composition_STORE__.getState().currentPageId &&
    document.querySelector(".app:not(.builder-booting)") &&
    document.querySelector('[data-testid="skia-canvas-unified"]'),
  );

const browser = await chromium.launch({ headless: true });
const page = await (
  await browser.newContext({ viewport: { width: 1440, height: 900 } })
).newPage();
page.on("pageerror", (e) => console.error("[page error]", e.message));

await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
const btn = page.locator("button.dashboard-create-button").first();
await btn.waitFor({ state: "visible", timeout: 15_000 });
await btn.click();
const input = page.locator("#new-project-name");
await input.waitFor({ state: "visible", timeout: 10_000 });
await input.fill(`adr205-fs-${Date.now()}`);
await input.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60_000 });
await page.waitForFunction(READY, undefined, { timeout: 90_000 });
await page.waitForTimeout(1_500);
console.log(`[boot] ${page.url()}`);

await page.evaluate(
  async ({ TEXT, BASE, CASES }) => {
    const st = window.__composition_STORE__.getState();
    const pageId = st.currentPageId;
    const body = st.elements.find(
      (e) => e.page_id === pageId && e.type === "body",
    );
    const now = new Date().toISOString();
    let i = 0;
    for (const [, id, extra] of CASES) {
      await st.addElement(
        {
          id,
          type: "Text",
          parent_id: body.id,
          page_id: pageId,
          order_num: i,
          created_at: now,
          updated_at: now,
          props: {
            children: TEXT,
            style: { ...BASE, top: `${40 + i * 140}px`, ...extra },
          },
        },
        { skipHistory: true },
      );
      i++;
    }
  },
  { TEXT, BASE, CASES },
);
await page.waitForTimeout(2_500);

const out = await page.evaluate(
  async ({ CASES }) => {
    const dbg = window.__composition_SKIA_DEBUG__;
    const res = {};
    for (const [label, id] of CASES.map(([l, id]) => [l, id])) {
      const node = dbg.getSkiaNode(id);
      const el = window.__composition_STORE__
        .getState()
        .elements.find((e) => e.id === id);
      const t =
        node?.text ??
        (node?.children ?? []).map((c) => c.text).find(Boolean) ??
        null;
      // DOM 오라클 — 같은 인라인 style 을 실제 DOM 에 그대로 실어 브라우저가 해석한 폰트 크기
      const host = document.createElement("div");
      Object.assign(host.style, {
        position: "absolute",
        left: "-10000px",
        visibility: "hidden",
      });
      // Preview 는 React `style={element.props.style}` 로 그린다 — React 는 px-like 속성의
      // **숫자**에 "px" 를 붙인다. 오라클도 같은 변환을 해야 production DOM 과 같은 조건이다
      // (안 하면 숫자 케이스가 오라클 쪽 무효 CSS 로 12px 이 되어 가짜 불일치가 난다).
      const asCss = Object.fromEntries(
        Object.entries(el.props.style).map(([k, v]) =>
          typeof v === "number" ? [k, `${v}px`] : [k, v],
        ),
      );
      Object.assign(host.style, asCss);
      host.textContent = "Hello";
      document.body.appendChild(host);
      const domFs = getComputedStyle(host).fontSize;
      host.remove();
      res[label] = {
        storedStyleFontSize: el.props.style.fontSize,
        storedType: typeof el.props.style.fontSize,
        skiaFontSize: t?.fontSize ?? null,
        domFontSize: domFs,
      };
    }
    return res;
  },
  { CASES },
);

console.log("\n### ADR-205 Phase 4 — 인라인 fontSize 표기별 live 도달\n");
for (const [label, r] of Object.entries(out)) {
  const domNum = parseFloat(r.domFontSize);
  const ok = r.skiaFontSize === domNum;
  console.log(
    `[${label}] 저장=${JSON.stringify(r.storedStyleFontSize)}(${r.storedType}) ` +
      `Skia=${r.skiaFontSize} DOM=${r.domFontSize} → ${ok ? "✅ 일치" : "❌ 불일치"}`,
  );
}
await browser.close();
