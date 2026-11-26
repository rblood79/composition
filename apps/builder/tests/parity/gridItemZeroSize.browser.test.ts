import { beforeAll, describe, expect, it } from "vitest";

import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";

import {
  runParityCase,
  type CaseNode,
  type ParityCase,
  type StyleRecord,
} from "./harness";

/**
 * grid item 의 명시 크기 0 (`0` · `0px` · `0%`) 은 auto 가 아니다 — CSS-ALIGN-3 §4.1 의 stretch 는
 * 「그 축의 크기가 auto」 일 때만이라, 0 으로 쓴 item 은 셀을 채우지 않고 0 (+ padding · border) 이다.
 *
 * Why (2026-11-27): 엔진 grid 배치가 「명시 크기 있음」 을 풀린 값 `> 0` 으로 판정해, 0 을 미지정으로
 * 보고 셀 폭까지 늘였다. 기본 value 가 0 (S2) 인 ProgressBar · Meter 의 Fill (`width: {percentage}%`,
 * 트랙은 `display: grid`) 이 Canvas 에서만 꽉 찬 막대로 그려졌다 (G3 palette · propAxis 12 건).
 */

const box = (
  label: string,
  style: StyleRecord,
  children?: number[],
): CaseNode => ({ label, style, children }) as CaseNode;

function gridCase(name: string, item: StyleRecord): ParityCase {
  return {
    name,
    availW: 400,
    availH: 600,
    nodes: [
      box("item", item),
      box(
        "grid",
        {
          display: "grid",
          gridTemplateColumns: ["200px"],
          gridTemplateRows: ["50px"],
          width: "200px",
          height: "50px",
        },
        [0],
      ),
    ],
  };
}

const CASES: ParityCase[] = [
  gridCase("width 0%", { width: "0%", height: "10px" }),
  gridCase("width 0px", { width: "0px", height: "10px" }),
  gridCase("width 0", { width: "0", height: "10px" }),
  gridCase("height 0px", { width: "40px", height: "0px" }),
  gridCase("height 0%", { width: "40px", height: "0%" }),
  gridCase("width 0 + padding (border-box)", {
    width: "0px",
    height: "10px",
    paddingLeft: "4px",
    paddingRight: "6px",
  }),
  gridCase("height 0 + border (border-box)", {
    width: "40px",
    height: "0px",
    // 엔진은 `borderTop` (폭), DOM 은 `borderTopStyle` 로 테두리를 그린다 (두 leg 가 나눠 읽는다).
    borderTop: "2px",
    borderTopStyle: "solid",
  }),
  // 대조군 — 1 % 는 이미 정합 (2 px), auto 는 셀을 채운다.
  gridCase("width 1%", { width: "1%", height: "10px" }),
  gridCase("width auto", { height: "10px" }),
];

describe("grid item 명시 크기 0 — Chrome 과 같은 상자", () => {
  beforeAll(async () => {
    await initEngineWasm();
  });

  for (const c of CASES) {
    it(c.name, () => {
      expect(runParityCase(c)).toEqual([]);
    });
  }
});
