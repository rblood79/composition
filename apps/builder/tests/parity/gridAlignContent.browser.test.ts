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
 * grid `align-content` — **여유 공간은 definite block size 에서만 생긴다**
 * (CSS-ALIGN-3 §4.4 / CSS-GRID-1 §10.5)
 *
 * `height:auto` 그리드는 트랙 sizing 을 위해 부모의 available 을 물려받아 쓰는데, 그
 * 값을 그대로 "여유" 로 보면 **없는 공간**을 트랙 사이에 나눠 넣는다. flex 의 미결정
 * main 센티넬(`place_line_main_axis`)과 같은 병인이고, 증상도 같다 — 내용이 밀려나고
 * 컨테이너가 부풀어 오른다.
 *
 * 실측(2026-07-27): `height:auto` + `align-content:center` → 트랙이 `(600−70)/2 = 265`
 * 아래로 밀리고 컨테이너 높이 `70 → 335`. `space-between` 은 `560 / 600`.
 *
 * ## `normal` 은 no-op 이 아니다 — auto 트랙 stretch (CSS-GRID-1 §12.8, 2026-07-28)
 *
 * 여유가 **있을 때**(definite 높이) `normal`(= grid 에선 `stretch`)은 남는 공간을 auto
 * 트랙에 균등 분배한다. 그래서 이 파일의 `normal` 케이스는 두 축을 동시에 잠근다 —
 * `height:auto` 면 아무것도 하지 않고, definite 면 트랙을 늘린다. 트랙 stretch 규칙
 * 자체의 전수 대조는 `gridAutoTrackStretch.browser.test.ts` 가 맡는다.
 */

const rows = (): CaseNode[] =>
  [0, 1, 2].map((i) => ({
    label: `c${i}`,
    style: { height: `${20 + i * 10}px` } as StyleRecord,
  }));

function gridCase(
  alignContent: string,
  height: "auto" | "definite",
): ParityCase {
  return {
    name: `align-content=${alignContent} / height=${height}`,
    availW: 400,
    availH: 600,
    nodes: [
      ...rows(),
      {
        label: "grid",
        style: {
          display: "grid",
          gridTemplateColumns: ["1fr", "1fr"],
          alignContent,
          width: "300px",
          ...(height === "definite" ? { height: "200px" } : {}),
        },
        children: [0, 1, 2],
      },
      {
        label: "root",
        style: { display: "block", width: "400px", height: "600px" },
        children: [3],
      },
    ],
  };
}

const ALIGN_CONTENT = [
  "normal",
  "start",
  "center",
  "end",
  "space-between",
  "space-around",
] as const;

// height:auto — 전부 no-op 이어야 한다 (여유 자체가 없음).
// height:definite — `normal` 은 auto 트랙 stretch, 나머지는 트랙셋 정렬.
const CASES: ParityCase[] = [
  ...ALIGN_CONTENT.map((ac) => gridCase(ac, "auto")),
  ...ALIGN_CONTENT.map((ac) => gridCase(ac, "definite")),
];

describe("grid align-content — CSS 대조", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(CASES.map((c) => [c.name, c] as const))(
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

  it.each(CASES.map((c) => [c.name, c] as const))(
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

  it("normal + definite 높이 — 여유가 auto 행에 균등 분배된다", () => {
    const c = gridCase("normal", "definite");
    const dom = domLeg(c.nodes, c.availW);
    const eng = engineLeg(c.nodes, c.availW, c.availH);

    // 행 합 70(=max(20,30) + 40), 여유 130 을 auto 행 2개에 65 씩 → 1행 95, 2행 105.
    // 이 구조는 `gridTemplateRows` 미명시라 **암묵 트랙** 경로다 (명시 auto 행은
    // `gridAutoTrackStretch.browser.test.ts` 가 별도로 잠근다).
    expect(dom[2].y).toBe(95);
    expect(eng[2].y).toBe(95);
    expect(dom[3].h).toBe(200);
    expect(eng[3].h).toBe(200);
  });
});
