import { beforeAll, describe, expect, it } from "vitest";

import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";

import {
  diffCase,
  domLeg,
  engineLeg,
  pipelineLeg,
  type CaseNode,
  type ParityCase,
  type StyleRecord,
} from "./harness";

/**
 * **Container Align — 비-stretch 교차축에서 자식이 접히던 문제** (2026-07-28)
 *
 * 스타일 패널의 Container Align 9칸은 전부 non-stretch `align-items` 를 쓴다. 그러면
 * auto-cross 자식은 **shrink-to-fit** 이라 `INDEFINITE_AVAIL(-1)` 을 받는데, 그 상태에서
 * 두 경로가 크기를 잃었다.
 *
 * | 경로                                   | 증상                                       |
 * | -------------------------------------- | ------------------------------------------ |
 * | 엔진 `solve_block`                     | auto 폭 자식을 센티넬로 stretch → 폭 **-1** |
 * | TS `enrichWithIntrinsicSize`           | `width:%` 텍스트 leaf 에 스칼라 미공급 → **0** |
 *
 * 라이브 실측(components 페이지, `align-items:flex-start`): GridList **12px** /
 * MenuItem **24px** / ListBoxItem **48px** — 폭을 가진 아이콘만 남고 텍스트가 0 이었다.
 *
 * 두 경로 다 **같은 CSS 규칙**이 근거다: 늘어날 available 이 없으면 기여는 stretch 가
 * 아니라 content 이고(CSS-SIZING-3 §5), containing block 이 미결정이면 `%` 는 `auto` 처럼
 * 동작한다(§5.1 순환 백분율).
 *
 * ## leg 구성
 * - `engineLeg` — 엔진 직접. 측정 스칼라를 fixture 가 직접 주므로 TS 층과 격리된다.
 * - `pipelineLeg` — `calculateFullTreeLayout` 전체. 스칼라 공급 게이트까지 포함.
 *
 * DOM leg 은 실제 Preview 와 같게 텍스트에 `width:100%` 를 준다 — catalog `Text`
 * containerStyles 가 그 값이고(ADR-151 B22) generated CSS 도 동일하다. 빼면 오라클이
 * 실물과 달라져 가짜 발산이 나온다.
 */

const AVAIL_W = 390;
const SCALARS: StyleRecord = { contentMinWidth: 120, contentMaxWidth: 120 };

function wrap(
  name: string,
  align: string,
  boxStyle: StyleRecord,
  inner: CaseNode[],
): ParityCase {
  const n = inner.length;
  return {
    name,
    availW: AVAIL_W,
    availH: -1,
    nodes: [
      ...inner,
      { label: "box", style: boxStyle, children: inner.map((_, i) => i) },
      {
        label: "root",
        style: {
          display: "flex",
          flexDirection: "column",
          width: `${AVAIL_W}px`,
          alignItems: align,
        },
        children: [n],
      },
    ],
  };
}

const ROW: StyleRecord = { display: "flex", flexDirection: "row" };
const BLOCK: StyleRecord = { display: "block" };

/** 측정 스칼라를 직접 받는 leaf — DOM leg 은 같은 폭의 inline-block 원자로 맞춘다. */
const atom = (style: StyleRecord = {}): CaseNode => ({
  label: "leaf",
  style: { height: "20px", ...SCALARS, ...style },
  domAtoms: [120],
});

describe("Container Align — 교차축 shrink-to-fit", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  describe("엔진 — block 컨테이너의 auto 폭 자식", () => {
    // `solve_block` 은 auto 폭 자식을 `available - margin` 으로 stretch 하는데, available 이
    // 음수 센티넬이면 폭이 음수가 된다. ADR-169 Phase 1 이 측정 패스(-2/-3)에만 걸어 둔
    // fit-content 대체를 `INDEFINITE_AVAIL`(-1) 로 넓힌 것이 수정이다.
    const CASES: ParityCase[] = [
      wrap("block box + auto 폭 leaf + center", "center", BLOCK, [atom()]),
      wrap("block box + width:100% leaf + center", "center", BLOCK, [
        atom({ width: "100%" }),
      ]),
      wrap("block box + auto 폭 leaf + flex-start", "flex-start", BLOCK, [
        atom(),
      ]),
      // 대조군 — stretch 에서는 종전대로 컨테이너 폭을 채운다.
      wrap("block box + width:100% leaf + stretch", "stretch", BLOCK, [
        atom({ width: "100%" }),
      ]),
    ];
    for (const c of CASES) {
      it(c.name, () => {
        expect(
          diffCase(
            c.nodes,
            domLeg(c.nodes, c.availW),
            engineLeg(c.nodes, c.availW, c.availH),
          ),
        ).toEqual([]);
      });
    }
  });

  describe("엔진 — flex 컨테이너 (회귀 가드)", () => {
    const CASES: ParityCase[] = [
      wrap("row box + auto 폭 leaf + center", "center", ROW, [atom()]),
      wrap("row box + width:100% leaf + center", "center", ROW, [
        atom({ width: "100%" }),
      ]),
      wrap("row box + 명시 폭 leaf + center", "center", ROW, [
        atom({ width: "200px" }),
      ]),
    ];
    for (const c of CASES) {
      it(c.name, () => {
        expect(
          diffCase(
            c.nodes,
            domLeg(c.nodes, c.availW),
            engineLeg(c.nodes, c.availW, c.availH),
          ),
        ).toEqual([]);
      });
    }
  });

  describe("파이프라인 — 텍스트 leaf 스칼라 공급", () => {
    // B22 가 텍스트 leaf 에 `width:100%` 를 선주입한다. 그 값은 키워드도 `auto` 도 아니라
    // 스칼라 공급 게이트에서 탈락했는데, 순환 백분율이라 해소되지 않는 상황에서는 엔진이
    // fallback 할 content 크기를 잃는다 → 폭 0.
    const TXT: CaseNode = {
      label: "t",
      style: { fontSize: "16px", lineHeight: "20px", width: "100%" },
      text: "Inbox unread messages",
      elementType: "Text",
    };
    const ICON: CaseNode = {
      label: "icon",
      style: { width: "24px", height: "24px" },
    };

    it("텍스트 leaf + center: 접히지 않는다", () => {
      const c = wrap("t", "center", ROW, [TXT]);
      expect(
        diffCase(
          c.nodes,
          domLeg(c.nodes, c.availW),
          pipelineLeg(c.nodes, c.availW, c.availH),
        ),
      ).toEqual([]);
    });

    it("아이콘+텍스트 + center: 행 폭이 아이콘 폭으로 접히지 않는다", () => {
      const c = wrap("t", "center", ROW, [ICON, TXT]);
      const dom = domLeg(c.nodes, c.availW);
      const pipe = pipelineLeg(c.nodes, c.availW, c.availH);
      const boxIdx = c.nodes.findIndex((n) => n.label === "box");
      // 라이브 증상: 행이 아이콘 폭(24)만 남았다. 지금은 아이콘+텍스트 합.
      expect(pipe[boxIdx].w).toBeGreaterThan(150);
      expect(Math.abs(pipe[boxIdx].w - dom[boxIdx].w)).toBeLessThanOrEqual(2);
    });

    it("텍스트 leaf + stretch: 종전대로 컨테이너 폭 (대조군)", () => {
      const c = wrap("t", "stretch", ROW, [TXT]);
      expect(
        diffCase(
          c.nodes,
          domLeg(c.nodes, c.availW),
          pipelineLeg(c.nodes, c.availW, c.availH),
        ),
      ).toEqual([]);
    });
  });

  describe("`%` 는 확정된 컨테이너 크기로 재해소된다 (2026-07-28 해소)", () => {
    // 구 잔존: 엔진이 `%` 를 `auto` 로 본 자리에서 멈춰 자식이 120 이었다. shrink-to-fit
    // 확정 뒤 재-solve 로 해소 — 전수 격자는 `shrinkToFitPercent.browser.test.ts`.
    it("width:50% leaf — 컨테이너와 자식 둘 다 일치", () => {
      const c = wrap("t", "center", ROW, [atom({ width: "50%" })]);
      const dom = domLeg(c.nodes, c.availW);
      const eng = engineLeg(c.nodes, c.availW, c.availH);
      const boxIdx = c.nodes.findIndex((n) => n.label === "box");
      expect(Math.round(eng[boxIdx].w)).toBe(Math.round(dom[boxIdx].w)); // 120
      expect(Math.round(dom[0].w)).toBe(60); // 120 의 50%
      expect(Math.round(eng[0].w)).toBe(60);
    });
  });
});
