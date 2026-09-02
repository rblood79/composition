import { beforeAll, describe, expect, it } from "vitest";

import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";

import {
  diffCase,
  domLeg,
  engineLeg,
  pipelineLeg,
  type CaseNode,
  type ParityCase,
} from "./harness";

/**
 * flex item 속성 주입 뒤의 **dimension 정규화 계약**
 *
 * 엔진 `NodeStyle` 의 길이 필드는 전부 `Option<String>` 이라 숫자가 들어오면
 * `build_tree_batch` 가 **배치 전체**를 거부한다 (`invalid type: integer, expected a
 * string`) → `calculateFullTreeLayout` 이 `null` → **그 페이지 레이아웃이 통째로
 * 사라진다**. 한 요소의 값 하나가 페이지 전체를 끄는 구조라 파싱 계약을 fixture 로
 * 잠근다.
 *
 * 위험 지점은 `engineStyleToRecord`(=`dim()` 정규화) **뒤에** 값을 덧쓰는 경로다.
 * `applyFlexItemProperties` 가 그렇고, 그 안의 `parseCSSPropWithContext` 는
 * **절대 길이를 숫자로** 돌려준다 (`"0px"` → `0`). 백분율·`auto` 는 문자열로 남아
 * 무증상이라, 절대 길이 `flex-basis` 를 싣는 import/preset 에서만 드러났다.
 *
 * 실측(2026-07-27 CSS 정합 sweep): `flexBasis:"0px"` block 자식 → pipeline leg 가
 * `calculateFullTreeLayout null` 로 throw. grid branch 는 같은 이유로 이미
 * `normalizeDimFields` 를 호출하고 있었고 **block branch 만 비대칭**이었다.
 *
 * **두 leg 의 입력이 다르다**: 엔진은 문자열만 받는 계약이므로 engine leg 에는
 * 문자열만 넘긴다. 숫자를 문자열로 바꿔 주는 것이 파이프라인의 책임이라, 숫자
 * 케이스는 pipeline leg 에만 싣는다 (store 는 `flexBasis: 0` 을 담을 수 있다).
 */

const kid = (label: string, basis: string | number): CaseNode => ({
  label,
  style: {
    width: "40px",
    height: "20px",
    flexBasis: basis,
    flexGrow: 0,
    flexShrink: 1,
  },
});

/** flex 부모 > block 자식 — 자식이 `applyFlexItemProperties` 주입 대상이 된다. */
function basisCase(basis: string | number): ParityCase {
  return {
    name: `flexBasis=${JSON.stringify(basis)}`,
    availW: 400,
    availH: 600,
    nodes: [
      kid("c0", basis),
      kid("c1", basis),
      {
        label: "box",
        style: {
          display: "flex",
          flexDirection: "row",
          flexWrap: "nowrap",
          alignItems: "flex-start",
          width: "300px",
          height: "100px",
        },
        children: [0, 1],
      },
      {
        label: "root",
        style: { display: "block", width: "400px", height: "600px" },
        children: [2],
      },
    ],
  };
}

// 절대 길이(파이프라인에서 숫자로 파싱됨) 와 백분율/auto(문자열 유지) 를 나란히 둬서,
// 회귀 시 "절대 길이만 깨진다" 는 형태가 그대로 읽히게 한다.
const STRING_CASES = ["0px", "50px", "0%", "50%", "auto"].map(basisCase);
// 숫자는 `0` 만 — 단위 없는 `50` 은 **CSS 로는 무효**(DOM 이 무시)인데 store 관례로는
// px 라, 넣으면 계약이 아니라 하니스 입력 비대칭을 재는 케이스가 된다.
const PIPELINE_CASES = [...STRING_CASES, basisCase(0)];

describe("flex item dimension 정규화 — CSS 대조", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(STRING_CASES.map((c) => [c.name, c] as const))(
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

  it.each(PIPELINE_CASES.map((c) => [c.name, c] as const))(
    "pipeline leg — %s",
    (_name, c) => {
      // 정규화가 빠지면 좌표 비교 이전에 배치 파싱이 실패해
      // `calculateFullTreeLayout null` 로 throw 한다.
      const bad = diffCase(
        c.nodes,
        domLeg(c.nodes, c.availW),
        pipelineLeg(c.nodes, c.availW, c.availH),
      );
      expect(bad, bad.join("\n")).toEqual([]);
    },
  );
});
