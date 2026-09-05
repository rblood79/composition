#!/usr/bin/env node
/**
 * ADR-205 G1 — 인라인 letter-spacing 의 live exercise (실제 빌더).
 *
 * Chrome MCP 경로가 막혔을 때(창이 hidden → rAF 정지 → readiness 계약이 오버레이를
 * 풀지 않는다) 같은 판정을 **같은 빌더 앱**에서 하기 위한 하니스다. `perf-baseline.mjs`
 * 와 동일한 부팅 절차(대시보드에서 격리 프로젝트 생성 → `waitReady`)를 쓴다 — 즉
 * production 번들·production store·production StoreRenderBridge 다.
 *
 * 판정 3축 (evidence `205-text-axis-gap-matrix.md` §8):
 *   ① Skia scene node 의 `text.letterSpacing` — 결선 전에는 키 자체가 없었다
 *   ② 캔버스 줄바꿈 — 렌더러가 break hint 로 쓰는 것과 **같은 함수**에 live scene node
 *      값을 넣어 얻는다 (`nodeRendererText.ts:526-545` 의 c2dStyle 조립을 그대로 재현)
 *   ③ 같은 문자열·스타일의 Chrome DOM 오라클 (`Range.getClientRects` 로 줄 경계 추출)
 *
 * 대조군(자간 미설정 Text)을 같은 실행에서 같이 잰다 — "케이스 전체가 깨졌다" 와
 * "자간 축만 다르다" 를 구별한다.
 *
 * 사용: node apps/builder/scripts/adr205-live-letterspacing.mjs [--headed]
 */

import { chromium } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";
const HEADED = process.argv.includes("--headed");

const TEXT = "ab cd ef gh ij kl mn op";
const STYLE = {
  position: "absolute",
  left: "40px",
  width: "150px",
  fontFamily: "Arial",
  fontSize: "16px",
  lineHeight: "24px",
};

const READY_PREDICATE = () =>
  Boolean(
    window.__composition_STORE__ &&
    window.__composition_STORE__.getState().currentPageId &&
    document.querySelector(".app:not(.builder-booting)") &&
    document.querySelector('[data-testid="skia-canvas-unified"]'),
  );

async function main() {
  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.error("[page error]", e.message));

  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const createButton = page.locator("button.dashboard-create-button").first();
  await createButton.waitFor({ state: "visible", timeout: 15_000 });
  await createButton.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr205-live-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60_000 });
  await page.waitForFunction(READY_PREDICATE, undefined, { timeout: 90_000 });
  await page.waitForTimeout(1_500);
  console.log(`[boot] ${page.url()}`);

  // 두 Text 를 같은 페이지에 넣는다 — 자간만 다르다.
  await page.evaluate(
    async ({ TEXT, STYLE }) => {
      const state = window.__composition_STORE__.getState();
      const pageId = state.currentPageId;
      const body = state.elements.find(
        (e) => e.page_id === pageId && e.type === "body",
      );
      if (!body) throw new Error("body 없음");
      const now = new Date().toISOString();
      const mk = (id, top, extra) => ({
        id,
        type: "Text",
        parent_id: body.id,
        page_id: pageId,
        order_num: id === "adr205-ls2" ? 0 : 1,
        created_at: now,
        updated_at: now,
        props: {
          children: TEXT,
          style: { ...STYLE, top: `${top}px`, ...extra },
        },
      });
      await state.addElement(mk("adr205-ls2", 40, { letterSpacing: "2px" }), {
        skipHistory: true,
      });
      await state.addElement(mk("adr205-ls0", 200, {}), { skipHistory: true });

      // R7 — 부모에 자간, 자식 Text 는 미지정. Phase 1 은 인라인만 닫으므로
      // **불일치가 예상 결과**다 (Skia scene build 에 ComputedStyle 이 없다 — F20).
      // 실측값을 Phase 5 착수 판정의 입력으로 남긴다.
      await state.addElement(
        {
          id: "adr205-parent",
          type: "frame",
          parent_id: body.id,
          page_id: pageId,
          order_num: 2,
          created_at: now,
          updated_at: now,
          props: {
            style: {
              position: "absolute",
              left: "40px",
              top: "360px",
              width: "150px",
              letterSpacing: "2px",
            },
          },
        },
        { skipHistory: true },
      );
      await state.addElement(
        {
          id: "adr205-inherit",
          type: "Text",
          parent_id: "adr205-parent",
          page_id: pageId,
          order_num: 0,
          created_at: now,
          updated_at: now,
          props: {
            children: TEXT,
            style: {
              width: "150px",
              fontFamily: "Arial",
              fontSize: "16px",
              lineHeight: "24px",
            },
          },
        },
        { skipHistory: true },
      );
    },
    { TEXT, STYLE },
  );
  await page.waitForTimeout(2_500);

  const result = await page.evaluate(async () => {
    const dbg = window.__composition_SKIA_DEBUG__;
    const seg =
      await import("/src/builder/workspace/canvas/utils/canvas2dSegmentCache.ts");

    /** 렌더러(`nodeRendererText.ts`)가 break hint 를 만들 때 쓰는 조립을 그대로. */
    function skiaLines(t) {
      const whiteSpace = t.whiteSpace ?? "normal";
      let processed = t.content;
      if (whiteSpace === "normal" || whiteSpace === "pre-line")
        processed = processed.replace(/[ \t]+/g, " ");
      const maxWidth =
        whiteSpace === "nowrap" || whiteSpace === "pre" ? 100000 : t.maxWidth;
      const style = {
        fontSize: t.fontSize,
        fontFamily: t.fontFamilies.join(", "),
        fontWeight: t.fontWeight,
        fontStyle: t.fontStyle,
        fontVariant: t.fontVariant,
        fontStretch: t.fontStretch,
        letterSpacing: t.letterSpacing,
        wordSpacing: t.wordSpacing,
        lineHeight: t.lineHeight,
        wordBreak: t.wordBreak ?? "normal",
        overflowWrap: t.overflowWrap ?? "normal",
        whiteSpace,
      };
      const fallback = seg.needsFallback(style);
      const r = seg.measureWithCanvas2D(processed, style, maxWidth);
      // 줄 끝 공백은 CSS 상 hang 이므로 비교에서 제외한다 (DOM 오라클도 trim 한다).
      return {
        fallback,
        lines: r.hintedText.split("\n").map((l) => l.trim()),
        width: r.width,
      };
    }

    /** ③ Chrome DOM 오라클 — 같은 문자열·스타일을 실제 DOM 에 조판해 줄 경계 추출. */
    function domLines(text, css) {
      const host = document.createElement("div");
      Object.assign(host.style, {
        position: "absolute",
        left: "-10000px",
        top: "0",
        visibility: "hidden",
        ...css,
      });
      host.textContent = text;
      document.body.appendChild(host);
      const node = host.firstChild;
      const range = document.createRange();
      const lines = [];
      let current = "";
      let lastTop = null;
      for (let i = 0; i < text.length; i++) {
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const rect = range.getClientRects()[0];
        const top = rect ? Math.round(rect.top) : lastTop;
        if (lastTop !== null && top !== lastTop) {
          lines.push(current);
          current = "";
        }
        current += text[i];
        lastTop = top;
      }
      if (current) lines.push(current);
      host.remove();
      return lines.map((l) => l.trim()).filter(Boolean);
    }

    const out = {};
    for (const [name, id] of [
      ["ls2", "adr205-ls2"],
      ["ls0", "adr205-ls0"],
      ["inherit(R7)", "adr205-inherit"],
    ]) {
      const node = dbg.getSkiaNode(id);
      const el = window.__composition_STORE__
        .getState()
        .elements.find((e) => e.id === id);
      const t =
        node?.text ??
        (node?.children ?? []).map((c) => c.text).find(Boolean) ??
        null;
      out[name] = {
        hasSkiaNode: !!node,
        hasTextKey: t ? "letterSpacing" in t : null,
        letterSpacing: t?.letterSpacing ?? null,
        fontSize: t?.fontSize ?? null,
        lineHeight: t?.lineHeight ?? null,
        maxWidth: t?.maxWidth ?? null,
        skia: t ? skiaLines(t) : null,
        dom: domLines(el.props.children, {
          // 상속 케이스는 부모가 준 자간을 오라클에 실어야 CSS 와 같은 조건이다.
          ...(id === "adr205-inherit" ? { letterSpacing: "2px" } : {}),
          width: el.props.style.width,
          fontFamily: el.props.style.fontFamily,
          fontSize: el.props.style.fontSize,
          lineHeight: el.props.style.lineHeight,
          ...(el.props.style.letterSpacing
            ? { letterSpacing: el.props.style.letterSpacing }
            : {}),
        }),
      };
    }
    return out;
  });

  console.log("\n### ADR-205 G1 live");
  for (const [name, r] of Object.entries(result)) {
    const same =
      r.skia && JSON.stringify(r.skia.lines) === JSON.stringify(r.dom);
    console.log(
      `\n[${name}] skia node=${r.hasSkiaNode} letterSpacing key=${r.hasTextKey} value=${r.letterSpacing}` +
        ` fontSize=${r.fontSize} lineHeight=${r.lineHeight} maxWidth=${r.maxWidth}` +
        ` fallback=${r.skia?.fallback}`,
    );
    console.log(`  skia lines: ${JSON.stringify(r.skia?.lines)}`);
    console.log(`  dom  lines: ${JSON.stringify(r.dom)}`);
    console.log(`  match: ${same ? "✅ 일치" : "❌ 불일치"}`);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
