import { beforeAll, describe, expect, it } from "vitest";

import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";

import {
  type CaseNode,
  type ParityCase,
  runParityCase,
  type StyleRecord,
} from "./harness";

/**
 * Taffy 0.10→0.14 대조 (2026-09-07) A 묶음 — Chrome 차등 게이트
 * (`docs/explanation/research/TAFFY_UPSTREAM_DELTA_2026-09.md` §2 B4·B4c·B6, §4 ③⑤).
 *
 * - ③ absolute 자식의 used size 는 min/max **clamp 뒤** 값이다 (CSS §10.4/§10.7). 명시 크기든
 *   양측 inset stretch 든 같다. 종전 엔진은 `resolve_dimension(width)` raw 값이 solve 의 clamp 를
 *   덮어썼고 (B4: 300 vs Chrome 100), stretch 분기엔 clamp 자체가 없었다 (B4c: 400 vs 100).
 *   clamp 로 over-constrained 가 되면 margin auto 흡수 · start 우선 규칙을 다시 탄다.
 * - ⑤ 자식 없는 block 상자도 stretch 폭에서 `aspect-ratio` 로 높이를 파생한다
 *   (CSS-SIZING-4 §6.1). 종전엔 군집 F 분기가 leaf 를 배제해 높이 0 (B6: 0 vs Chrome 150).
 *
 * abs 케이스는 DOM 이 `left`/`right`, 엔진이 `insetLeft`/`insetRight` 를 읽으므로 둘 다 싣는다.
 */

const box = (
  label: string,
  style: StyleRecord,
  children?: number[],
): CaseNode => ({ label, style, children }) as CaseNode;

const abs = (label: string, style: StyleRecord): CaseNode =>
  box(label, {
    position: "absolute",
    left: "0px",
    right: "0px",
    insetLeft: "0px",
    insetRight: "0px",
    ...style,
  });

const relRoot = (children: number[]): CaseNode =>
  box(
    "root",
    { position: "relative", width: "400px", height: "100px" },
    children,
  );

const ABS_CLAMP: ParityCase[] = [
  {
    name: "B4 명시 width 300 + max-width 100 + margin auto → w100 x150",
    availW: 400,
    availH: -1,
    nodes: [
      abs("abs", {
        width: "300px",
        maxWidth: "100px",
        height: "20px",
        marginLeft: "auto",
        marginRight: "auto",
      }),
      relRoot([0]),
    ],
  },
  {
    name: "B4c stretch(left0 right0, width auto) + max-width 100 → w100 x0",
    availW: 400,
    availH: -1,
    nodes: [abs("abs", { maxWidth: "100px", height: "20px" }), relRoot([0])],
  },
  {
    name: "stretch + max-width + margin auto → clamp 뒤 중앙",
    availW: 400,
    availH: -1,
    nodes: [
      abs("abs", {
        maxWidth: "100px",
        height: "20px",
        marginLeft: "auto",
        marginRight: "auto",
      }),
      relRoot([0]),
    ],
  },
  {
    name: "stretch + min-width (inset 150/150 → 100 < min 160)",
    availW: 400,
    availH: -1,
    nodes: [
      abs("abs", {
        left: "150px",
        right: "150px",
        insetLeft: "150px",
        insetRight: "150px",
        minWidth: "160px",
        height: "20px",
      }),
      relRoot([0]),
    ],
  },
  {
    name: "세로축 — top0 bottom0 + max-height 30 → h30 y0",
    availW: 400,
    availH: -1,
    nodes: [
      box("abs", {
        position: "absolute",
        top: "0px",
        bottom: "0px",
        insetTop: "0px",
        insetBottom: "0px",
        left: "0px",
        insetLeft: "0px",
        width: "50px",
        maxHeight: "30px",
      }),
      relRoot([0]),
    ],
  },
  {
    name: "한쪽 inset + 명시 width 300 + max-width 100 → w100 (left 기준)",
    availW: 400,
    availH: -1,
    nodes: [
      box("abs", {
        position: "absolute",
        left: "10px",
        insetLeft: "10px",
        width: "300px",
        maxWidth: "100px",
        height: "20px",
      }),
      relRoot([0]),
    ],
  },
  {
    name: "% max-width 는 containing block 기준 (max 25% of 400 = 100)",
    availW: 400,
    availH: -1,
    nodes: [abs("abs", { maxWidth: "25%", height: "20px" }), relRoot([0])],
  },
];

const ASPECT_LEAF: ParityCase[] = [
  {
    name: "B6 block leaf aspect-ratio 2, width auto in w300 → 300×150",
    availW: 300,
    availH: -1,
    nodes: [
      box("leaf", { aspectRatio: 2 }),
      box("root", { width: "300px" }, [0]),
    ],
  },
  {
    name: "leaf aspect-ratio 2 + max-width 100 → 100×50",
    availW: 300,
    availH: -1,
    nodes: [
      box("leaf", { aspectRatio: 2, maxWidth: "100px" }),
      box("root", { width: "300px" }, [0]),
    ],
  },
  {
    name: "leaf aspect-ratio 0.5 + margin 20/20 → (300-40)=260 × 520",
    availW: 300,
    availH: -1,
    nodes: [
      box("leaf", {
        aspectRatio: 0.5,
        marginLeft: "20px",
        marginRight: "20px",
      }),
      box("root", { width: "300px" }, [0]),
    ],
  },
  {
    name: "leaf 형제 뒤 흐름 — aspect 높이가 다음 형제를 민다",
    availW: 300,
    availH: -1,
    nodes: [
      box("leaf", { aspectRatio: 3 }),
      box("sib", { height: "10px" }),
      box("root", { width: "300px" }, [0, 1]),
    ],
  },
  {
    name: "명시 height 가 있으면 h→w 전송 (회귀 — 기존 E15)",
    availW: 300,
    availH: -1,
    nodes: [
      box("leaf", { aspectRatio: 3, height: "60px" }),
      box("root", { width: "300px" }, [0]),
    ],
  },
];

describe("Taffy 대조 A — ③ absolute used size clamp", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(ABS_CLAMP)("$name", (c) => {
    expect(runParityCase(c)).toEqual([]);
  });
});

describe("Taffy 대조 A — ⑤ block leaf aspect-ratio 높이 파생", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(ASPECT_LEAF)("$name", (c) => {
    expect(runParityCase(c)).toEqual([]);
  });
});
