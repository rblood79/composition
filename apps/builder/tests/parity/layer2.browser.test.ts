import { beforeAll, describe, expect, it } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import {
  type CaseNode,
  type ParityCase,
  type StyleRecord,
  runPipelineParityCase,
} from "./harness";

/**
 * ADR-156 §Residual R5 — Layer 2 (빌더 파이프라인 ↔ CSS) 차등 하니스
 *
 * phase4/phase5 하니스는 엔진을 **직접** 호출(engineLeg)하므로, 빌더의 JS 선계산
 * (`enrichWithIntrinsicSize`/`calculateContentHeight`)이 auto-height 컨테이너 높이를
 * 오염시켜도 검출하지 못한다. 본 하니스는 `calculateFullTreeLayout`(빌더 canvas 실
 * 진입점)을 그대로 돌려 **엔진 결과가 Skia 좌표까지 온전히 도달하는지**를 실 Chrome
 * ground truth 와 대조한다 (pipelineLeg).
 *
 * ## E3/E17 확증 (§Residual 정정)
 * §Residual 은 "JS 선계산이 마진 상쇄를 안 해 live Skia 가 상쇄 전 높이(mid.h=50)를
 * 그린다"고 서술했으나, 실측은 정반대다:
 *   1. `calculateContentHeight` 는 자식 margin 을 **아예 무시** → 상쇄 활성 케이스는
 *      우연히 일치(둘 다 margin 0 취급), 상쇄 **차단** 케이스(padding-top/overflow BFC)
 *      에서만 CSS 보다 작게 나온다 (반전).
 *   2. 그러나 `calculateFullTreeLayout`(fullTreeLayout.ts:1895-1915)은 auto-height 컨테이너
 *      에서 JS 주입 height 를 **제거하고 엔진이 자식 기반으로 높이를 계산**하게 둔다 →
 *      엔진의 Phase 4 상쇄 결과가 Skia 에 도달. 즉 **live 마스킹 없음**.
 * 본 3 판별 케이스가 GREEN 이면 위 2 를 실 파이프라인으로 확증 = E3/E17 fix 불요.
 * 미래 회귀(누군가 height 제거 로직을 없애 JS 주입이 살아남는 경우)는 여기서 RED.
 */

function wrap(
  nodes: CaseNode[],
  rootChildren: number[],
  name: string,
  availW = 300,
  rootStyle: StyleRecord = {},
): ParityCase {
  return {
    name,
    availW,
    availH: -1,
    nodes: [
      ...nodes,
      {
        label: "root",
        style: {
          display: "block",
          width: `${availW}px`,
          height: "600px",
          ...rootStyle,
        },
        children: rootChildren,
      },
    ],
  };
}

// sanity: pipelineLeg 자체 검증 — margin 없는 중첩 block (엔진=CSS 자명).
const SANITY: ParityCase = wrap(
  [
    { label: "k", style: { display: "block", height: "20px" } }, // [0]
    { label: "mid", style: { display: "block" }, children: [0] }, // [1]
  ],
  [1],
  "sanity: nested block no margin (mid.h=20)",
);

// E3 collapse-active: k.mt=30 이 mid(padding 무) 밖으로 탈출 → mid.h=20.
const E3_ACTIVE: ParityCase = wrap(
  [
    {
      label: "k",
      style: { display: "block", height: "20px", marginTop: "30px" },
    }, // [0]
    { label: "mid", style: { display: "block" }, children: [0] }, // [1]
  ],
  [1],
  "E3 collapse-active: first-child mt escapes (mid.h=20)",
);

// E3-2 paddingTop blocks: mid.paddingTop=10 이 상쇄 차단 → k.mt 가 mid 안에 유지.
//   CSS mid.h = 10(pad) + 30(mt) + 20(k) = 60. 파이프라인이 엔진 위임이면 60(GREEN),
//   JS 주입(margin 무시)이 살아남으면 30(RED).
const E3_2_BLOCKED: ParityCase = wrap(
  [
    {
      label: "k",
      style: { display: "block", height: "20px", marginTop: "30px" },
    }, // [0]
    {
      label: "mid",
      style: { display: "block", paddingTop: "10px" },
      children: [0],
    }, // [1]
  ],
  [1],
  "E3-2 paddingTop blocks collapse (mid.h=60)",
);

// E17 overflow BFC: mid.overflowY=hidden → BFC 생성, 상쇄 차단 → k.mt 가 mid 안에 유지.
//   CSS mid.h = 30(mt) + 20(k) = 50. 엔진 위임이면 50(GREEN), JS 주입이면 20(RED).
const E17_BFC: ParityCase = wrap(
  [
    {
      label: "k",
      style: { display: "block", height: "20px", marginTop: "30px" },
    }, // [0]
    {
      label: "mid",
      style: { display: "block", overflowY: "hidden" },
      children: [0],
    }, // [1]
  ],
  [1],
  "E17 overflowY:hidden BFC blocks collapse (mid.h=50)",
);

const CASES: ParityCase[] = [SANITY, E3_ACTIVE, E3_2_BLOCKED, E17_BFC];

describe("ADR-156 §Residual R5 — Layer 2 파이프라인↔CSS 정합 (block-height 위임 확증)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(CASES)("$name", (c) => {
    const bad = runPipelineParityCase(c);
    expect(bad, bad.join("; ")).toEqual([]);
  });
});
