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
 * 백분율 크기의 **containing block 확정성** (CSS §10.2 인라인 축 / §10.5 블록 축)
 *
 * `%` 는 containing block 의 해당 축이 definite 일 때만 해소되고, 아니면 `auto` 다.
 * 그런데 **두 축의 "definite" 성립 조건이 다르다**:
 *
 * | 축                | 부모가 available 을 내려주면?                        |
 * | ----------------- | ---------------------------------------------------- |
 * | 인라인(width)     | **확정** — block 레벨 자식은 부모 폭으로 stretch      |
 * | 블록(height)      | **미확정** — `height:auto` 는 내용 크기, stretch 없음 |
 *
 * 엔진은 flex cross 축 판정에서 두 축을 한 규칙(`explicit || avail >= 0`)으로 묶고
 * 있었다. 폭 쪽 근거(DatePicker `width:100%` 가 stretch 부모에서 390 이어야 함)를
 * 높이에 그대로 적용한 것이라, `height:auto` flex 부모의 `height:%` 자식이 **상속
 * available** 로 해소됐다.
 *
 * 실측(2026-07-27): `flex(row, width:300, height 미지정)` 안의 `height:50%` 자식이
 * 300 (=상속 600 의 절반). DOM 은 0 — `%` → auto → 내용 없음 → 컨테이너도 0.
 *
 * 아래 `SHRINK_WRAP_CASES` 는 반대편 회귀 가드다 — 폭 축의 `avail >= 0` 조항을 같이
 * 지우면 stretch 부모 안의 `width:100%` 가 다시 수축한다.
 */

const child = (style: StyleRecord): CaseNode => ({ label: "c0", style });

function pctCase(
  parent: "block" | "flex-row" | "flex-column",
  parentHeight: "definite" | "auto",
  size: string,
  axis: "width" | "height" | "both",
): ParityCase {
  const style: StyleRecord = {};
  style.width = axis === "height" ? "40px" : size;
  style.height = axis === "width" ? "40px" : size;

  const isFlex = parent !== "block";
  return {
    name: `${parent} / 부모높이=${parentHeight} / ${size} / ${axis}`,
    availW: 400,
    availH: 600,
    nodes: [
      child(style),
      {
        label: "box",
        style: {
          display: isFlex ? "flex" : "block",
          ...(isFlex
            ? {
                flexDirection: parent === "flex-row" ? "row" : "column",
                flexWrap: "nowrap",
                alignItems: "flex-start",
              }
            : {}),
          width: "300px",
          ...(parentHeight === "definite" ? { height: "200px" } : {}),
        },
        children: [0],
      },
      {
        label: "root",
        style: { display: "block", width: "400px", height: "600px" },
        children: [1],
      },
    ],
  };
}

const CASES: ParityCase[] = (
  ["block", "flex-row", "flex-column"] as const
).flatMap((parent) =>
  (["definite", "auto"] as const).flatMap((h) =>
    (["50%", "100%"] as const).flatMap((size) =>
      (["width", "height", "both"] as const).map((axis) =>
        pctCase(parent, h, size, axis),
      ),
    ),
  ),
);

/**
 * 폭 축 `avail >= 0` 조항의 회귀 가드 (DatePicker, 2026-07-14).
 *
 * - stretch 부모(block): 폭 미지정 중간 컨테이너가 부모 폭으로 늘어나므로 손자의
 *   `width:100%` 는 그 폭이 정답이다.
 * - shrink-wrap 부모(flex column + align-items:flex-start): 중간 컨테이너가
 *   내용 크기라 손자의 `width:100%` 는 해소되지 않아야 한다(팽창 방지).
 */
function shrinkWrapCase(outer: "block" | "flex-column"): ParityCase {
  return {
    name: `width:100% 손자 / 중간 컨테이너 폭 미지정 / 바깥=${outer}`,
    availW: 350,
    availH: 500,
    nodes: [
      { label: "leaf", style: { width: "100%", height: "30px" } },
      { label: "mid", style: { display: "block" }, children: [0] },
      {
        label: "outer",
        style:
          outer === "block"
            ? { display: "block", width: "350px" }
            : {
                display: "flex",
                flexDirection: "column",
                flexWrap: "nowrap",
                alignItems: "flex-start",
                width: "350px",
              },
        children: [1],
      },
      {
        label: "root",
        style: { display: "block", width: "350px", height: "500px" },
        children: [2],
      },
    ],
  };
}

const SHRINK_WRAP_CASES: ParityCase[] = [
  shrinkWrapCase("block"),
  shrinkWrapCase("flex-column"),
];

const ALL = [...CASES, ...SHRINK_WRAP_CASES];

describe("백분율 크기 containing block — CSS 대조", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(ALL.map((c) => [c.name, c] as const))(
    "engine leg — %s",
    (_name, c) => {
      const bad = diffCase(
        c.nodes,
        domLeg(c.nodes, c.availW),
        engineLeg(c.nodes, c.availW, c.availH),
      );
      expect(bad, bad.join("\n")).toEqual([]);
    },
  );

  it.each(ALL.map((c) => [c.name, c] as const))(
    "pipeline leg — %s",
    (_name, c) => {
      const bad = diffCase(
        c.nodes,
        domLeg(c.nodes, c.availW),
        pipelineLeg(c.nodes, c.availW, c.availH),
      );
      expect(bad, bad.join("\n")).toEqual([]);
    },
  );
});
