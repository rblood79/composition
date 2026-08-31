/**
 * ADR-198 — catalog 배치 발산의 축을 가르는 대조군 (test-only)
 *
 * Phase 4b 실측에서 `catalog-state-paint` 만 L1 geometry 가 갈렸다. 나머지 두
 * 파일럿은 모든 노드의 x/y/w/h 가 두 leg 에서 정확히 일치했다. 파일럿끼리 다른
 * 점이 여럿이라(컴포넌트 종류, 텍스트, 이미지) 그 관측만으로는 원인을 지목할 수
 * 없어서, 축을 하나씩만 움직이는 문서 4개로 좁혔다.
 *
 * ## 실측 (2026-08-31) — 축을 하나씩 움직인 결과
 *
 * body(display:block, padding 16) 아래 자식 2개. 첫 자식은 block 프레임 120x40.
 *
 * | 두 번째 자식 | 첫 자식 폭 | Skia | Preview | |
 * | --- | --- | --- | --- | --- |
 * | block 프레임 | 120px | (16,56) | (16,56) | 일치 |
 * | inline-flex 프레임 | 120px | (16,56) | (16,56) | 일치 |
 * | **catalog Button** | **120px** | **(136,21)** | **(16,56)** | **갈림** |
 * | catalog Button | 없음(auto) | (16,56) | (16,56) | 일치 |
 *
 * 처음 세운 가설("엔진이 block/inline 형제 혼합을 CSS 와 다르게 흘린다")은
 * 두 번째 줄이 **반증**했다 — inline-flex 형제는 두 leg 이 같다. 네 번째 줄이
 * 남은 변수를 하나로 줄인다: 갈리는 조건은 컴포넌트 종류가 아니라
 * **"명시 폭을 가진 block 형제 + inline-level 형제"** 다.
 *
 * ## 확정된 기전
 *
 * 1. `Button` 은 style.display 가 없으면 `INLINE_BLOCK_TAGS` 규칙으로
 *    `inline-block` 이 된다 (`taffyDisplayAdapter.ts:395-408`).
 * 2. block 부모가 inline-level 자식을 하나라도 가지면 부모 전체가
 *    **flex row wrap 으로 전환**된다 — Taffy 에 IFC 가 없어서 그걸 흉내 내는
 *    경로다 (`taffyDisplayAdapter.ts:526-536`).
 * 3. 그 시뮬레이션 안에서 block 형제가 자기 줄을 차지하려면 `width:100%` 를
 *    받아야 하는데, `needsBlockChildFullWidth` 는 **자식에 명시 폭이 있으면
 *    false** 를 돌려준다 (`taffyDisplayAdapter.ts:436-440`).
 * 4. 그래서 폭이 명시된 block 형제는 flex item 으로 같은 줄에 남고, inline-level
 *    형제가 그 오른쪽에 붙는다. CSS 는 폭과 무관하게 block box 에 줄을 준다.
 *
 * `catalog-state-paint` 의 `state-clip` 이 정확히 이 조건이다 (`width: 140px`).
 * 폭을 빼면(네 번째 줄) 100% 를 받아 줄을 차지하고 갈림이 사라진다 — 양방향
 * 대조가 성립하므로 기전은 추정이 아니라 확정이다.
 *
 * 수리는 레이아웃 의미를 바꾸는 변경이라(기존 문서의 배치가 달라진다) 별도
 * 결정 대상이다. 여기서는 현재 상태를 못박아 둔다.
 *
 * 이 파일은 catalog 컴포넌트를 배치 축에만 쓴다 — 폭 델타(Phase 4b 에서 관측된
 * 2.7px)는 텍스트 측정 축이라 여기서 섞지 않는다.
 */

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { CanvasKit } from "canvaskit-wasm";

import { initCanvasKit } from "@/builder/workspace/canvas/skia/initCanvasKit";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";

import { CASE_PROJECT_ID, caseIds, scaffoldDocument } from "../cases/scaffold";
import { runSkiaLegResult } from "../harness/skiaRunner";
import { PreviewDriver } from "../harness/previewDriver";
import { captureEnvironment } from "../harness/identity";
import type { Rect } from "../harness/types";

const VIEWPORT = { width: 320, height: 220, dpr: 1 } as const;

function boxStyle(display: string) {
  return {
    display,
    width: "120px",
    height: "40px",
    backgroundColor: "#2F6FED",
    boxSizing: "border-box",
  };
}

/** 두 번째 자식만 바꾼 문서. 그 외는 완전히 같다. */
function probeDocument(
  prefix: string,
  second: "block" | "inline-flex" | "Button",
  autoWidth = false,
) {
  const ids = caseIds(prefix);
  return {
    ids: { ...ids, first: `${prefix}-first`, second: `${prefix}-second` },
    document: scaffoldDocument({
      prefix,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      background: "#FFFFFF",
      padding: 16,
      children: [
        {
          id: `${prefix}-first`,
          type: "frame",
          props: {
            style: autoWidth
              ? // 폭 미지정 — IFC 시뮬레이션이 block 자식에 100% 를 넣어 주는 조건
                (() => {
                  const st = { ...boxStyle("block") } as Record<string, unknown>;
                  delete st.width;
                  return st;
                })()
              : boxStyle("block"),
          },
        },
        second === "Button"
          ? {
              // catalog 컴포넌트. 크기는 내용이 정하므로 style 을 주지 않는다 —
              // 여기서 폭을 고정하면 배치 축과 크기 축이 섞인다.
              id: `${prefix}-second`,
              type: "Button",
              props: {
                children: "Probe",
                variant: "accent",
                fillStyle: "fill",
                size: "md",
              },
            }
          : {
              id: `${prefix}-second`,
              type: "frame",
              props: { style: boxStyle(second) },
            },
      ],
    }),
  };
}

const VARIANTS = [
  { key: "blockblock", prefix: "probe-bb", second: "block" },
  { key: "blockinline", prefix: "probe-bi", second: "inline-flex" },
  // 컴포넌트 축 — 위 둘이 일치하므로 남는 변수는 catalog 컴포넌트뿐이다.
  { key: "blockbutton", prefix: "probe-bt", second: "Button" },
  // 같은 구조에서 **첫 자식의 명시 폭만** 뺀다. 이게 갈림을 없애면 원인이
  // "명시 폭을 가진 block 형제가 줄을 차지하지 못한다" 로 확정된다.
  { key: "autobutton", prefix: "probe-ab", second: "Button", autoWidth: true },
] as const;

let ck: CanvasKit;

function envFor(backend: "sw" | "gl") {
  return captureEnvironment({
    canvasKitVersion: "0.42.0",
    surfaceBackend: backend,
    viewport: { width: VIEWPORT.width, height: VIEWPORT.height },
    theme: "light",
  });
}

function fmt(b: Rect | undefined): string {
  return b
    ? `(${b.x.toFixed(1)},${b.y.toFixed(1)},${b.width.toFixed(1)},${b.height.toFixed(1)})`
    : "—";
}

describe("ADR-198 — block/inline 형제 혼합에서 두 leg 이 갈리는가", () => {
  const measured: Record<
    string,
    { skia: Record<string, Rect>; preview: Record<string, Rect> }
  > = {};
  beforeAll(async () => {
    ck = await initCanvasKit();
    await initCompositionEngineWasm();

    for (const v of VARIANTS) {
      const { ids, document } = probeDocument(
        v.prefix,
        v.second,
        "autoWidth" in v && v.autoWidth === true,
      );
      const skia = runSkiaLegResult(
        ck,
        document,
        {
          pageId: ids.page,
          width: VIEWPORT.width,
          height: VIEWPORT.height,
          projectId: CASE_PROJECT_ID,
        },
        envFor("sw"),
      );

      // 드라이버는 **한 번에 하나만** 살려 둔다. 둘을 동시에 띄우면 두 번째
      // 렌더의 좌표가 어긋난다 (실측: y 가 -210 으로 나왔다) — 첫 iframe 이
      // 남아 있는 채로 기준점을 잡기 때문이다.
      const driver = new PreviewDriver();
      await driver.start(VIEWPORT);
      let preview;
      try {
        preview = await driver.render(document, CASE_PROJECT_ID, envFor("gl"));
      } finally {
        driver.stop();
      }

      measured[v.key] = { skia: skia.geometry, preview: preview.geometry };
    }
    // 통과한 테스트의 콘솔은 browser mode 가 숨긴다 — 측정값은 파일로 남긴다.
    const { server } = await import("vitest/browser");
    await server.commands.writeFile(
      "tests/visual-parity/.artifacts/block-inline-probe.json",
      JSON.stringify(measured, null, 2),
    );
  }, 240_000);

  it("block 형제끼리는 두 leg 이 같은 자리에 놓는다 (대조군)", () => {
    const m = measured.blockblock;
    console.log(
      `[ADR-198 probe] block+block skia first=${fmt(m.skia["probe-bb-first"])} ` +
        `second=${fmt(m.skia["probe-bb-second"])} | preview first=${fmt(m.preview["probe-bb-first"])} ` +
        `second=${fmt(m.preview["probe-bb-second"])}`,
    );

    // 대조군이 갈리면 이 probe 의 축이 display 가 아니라는 뜻이므로 먼저 본다.
    for (const id of ["probe-bb-first", "probe-bb-second"]) {
      expect(m.skia[id], id).toBeDefined();
      expect(m.preview[id], id).toBeDefined();
      expect(m.skia[id].x, `${id}.x`).toBeCloseTo(m.preview[id].x, 1);
      expect(m.skia[id].y, `${id}.y`).toBeCloseTo(m.preview[id].y, 1);
    }

    // block 자식은 세로로 쌓인다 — 두 번째가 첫 번째 아래.
    expect(m.preview["probe-bb-second"].y).toBeGreaterThan(
      m.preview["probe-bb-first"].y,
    );
  });

  it("block 뒤에 inline 형제가 와도 두 leg 이 일치한다 (display 축 배제)", () => {
    const m = measured.blockinline;
    const skiaFirst = m.skia["probe-bi-first"];
    const skiaSecond = m.skia["probe-bi-second"];
    const prevFirst = m.preview["probe-bi-first"];
    const prevSecond = m.preview["probe-bi-second"];

    console.log(
      `[ADR-198 probe] block+inline skia first=${fmt(skiaFirst)} second=${fmt(skiaSecond)} | ` +
        `preview first=${fmt(prevFirst)} second=${fmt(prevSecond)}`,
    );

    // 첫 자식(block)은 두 leg 이 같아야 한다 — 여기까지 갈리면 축이 다른 것이다.
    expect(skiaFirst.x).toBeCloseTo(prevFirst.x, 1);
    expect(skiaFirst.y).toBeCloseTo(prevFirst.y, 1);

    // CSS: block 자식이 줄을 차지하므로 inline 형제는 **다음 줄**로 간다.
    expect(
      prevSecond.y,
      "Preview(CSS)에서 inline 형제가 block 아래로 가지 않았다 — probe 전제가 깨졌다",
    ).toBeGreaterThan(prevFirst.y);

    // **가설 반증 기록**: 처음에는 "엔진이 block/inline 형제를 한 줄에 흘린다" 를
    // 의심했다. 실측은 두 leg 이 같은 자리를 낸다 — display 축이 아니다.
    // 남는 변수는 catalog 컴포넌트이며, 그건 아래 probe 가 잡는다.
    expect(skiaSecond.x).toBeCloseTo(prevSecond.x, 1);
    expect(skiaSecond.y).toBeCloseTo(prevSecond.y, 1);
  });

  it("[대조군] 첫 자식의 명시 폭을 빼면 갈림이 사라진다", () => {
    const m = measured.autobutton;
    const s2 = m.skia["probe-ab-second"];
    const p2 = m.preview["probe-ab-second"];
    console.log(
      `[ADR-198 probe] auto+Button skia second=${fmt(s2)} preview second=${fmt(p2)}`,
    );
    // 이 단언이 통과하면 원인은 display 종류가 아니라 **명시 폭을 가진 block
    // 형제가 IFC 시뮬레이션(flex row wrap)에서 줄을 차지하지 못하는 것** 이다.
    expect(s2.x).toBeCloseTo(p2.x, 1);
    expect(s2.y).toBeCloseTo(p2.y, 1);
  });

  it("[미해결 기록] 같은 자리에 catalog Button 을 두면 두 leg 이 갈린다", () => {
    const m = measured.blockbutton;
    const skiaFirst = m.skia["probe-bt-first"];
    const skiaSecond = m.skia["probe-bt-second"];
    const prevFirst = m.preview["probe-bt-first"];
    const prevSecond = m.preview["probe-bt-second"];

    console.log(
      `[ADR-198 probe] block+Button skia first=${fmt(skiaFirst)} second=${fmt(skiaSecond)} | ` +
        `preview first=${fmt(prevFirst)} second=${fmt(prevSecond)}`,
    );

    // 첫 자식(block frame)은 여전히 일치해야 한다 — 갈림이 Button 에 귀속되는지
    // 문서 전체가 흔들리는지를 가른다.
    expect(skiaFirst.x, "첫 자식 x").toBeCloseTo(prevFirst.x, 1);
    expect(skiaFirst.y, "첫 자식 y").toBeCloseTo(prevFirst.y, 1);

    const dx = Math.abs(skiaSecond.x - prevSecond.x);
    const dy = Math.abs(skiaSecond.y - prevSecond.y);
    console.log(
      `[ADR-198 probe] block+Button 판정: Δx=${dx.toFixed(1)} Δy=${dy.toFixed(1)}`,
    );

    // 현재 값을 못박는다. 수리되면 이 단언이 깨지고 기록을 갱신하게 된다.
    expect(dx > 1 || dy > 1, "Button 배치가 두 leg 에서 일치한다 — 기록 갱신 필요").toBe(
      true,
    );
  });
});
