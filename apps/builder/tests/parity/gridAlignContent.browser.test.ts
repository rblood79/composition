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
 * ## 잔존 발산 — `align-content: normal` 의 auto 트랙 stretch (미구현)
 *
 * definite 높이 + auto 행에서 CSS 는 남는 공간을 **auto 트랙에 균등 분배**한다
 * (`normal` = grid 에서 `stretch`). 엔진은 트랙을 내용 크기로 두고 위에 쌓는다.
 * 아래 `STRETCH_GAP_SNAPSHOT` 이 그 차이를 **실측값으로 고정**한다 — 구현되면 이
 * 스냅샷이 먼저 red 가 되어 알려준다.
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
// height:definite — `normal`(=stretch) 만 미구현이라 제외하고 전부 정합.
const CASES: ParityCase[] = [
  ...ALIGN_CONTENT.map((ac) => gridCase(ac, "auto")),
  ...ALIGN_CONTENT.filter((ac) => ac !== "normal").map((ac) =>
    gridCase(ac, "definite"),
  ),
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

  it("잔존 — definite 높이의 auto 트랙 stretch 미구현 (실측 스냅샷)", () => {
    const c = gridCase("normal", "definite");
    const dom = domLeg(c.nodes, c.availW);
    const eng = engineLeg(c.nodes, c.availW, c.availH);

    // CSS: 행 합 70, 여유 130 을 auto 행 2개에 65 씩 → 1행 95, 2행 105.
    expect(dom[2].y).toBe(95);
    // 엔진: 내용 크기 그대로 쌓임 → 2행이 30 에서 시작.
    expect(eng[2].y).toBe(30);
    // 컨테이너 높이는 명시값이라 양쪽 동일 — 어긋나는 건 트랙 분배뿐이다.
    expect(dom[3].h).toBe(200);
    expect(eng[3].h).toBe(200);
  });
});
