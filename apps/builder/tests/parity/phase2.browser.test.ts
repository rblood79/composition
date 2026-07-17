import { beforeAll, describe, expect, it } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import {
  type CaseNode,
  type ParityCase,
  type StyleRecord,
  runParityCase,
} from "./harness";

/**
 * ADR-156 Phase 2 — E1(align-self) + E6(percent height) 차등 fixture (G2)
 *
 * Phase 1 하니스(harness.ts)를 그대로 써서, 엔진 수정이 실 Chrome(leg 1)과 일치하는지
 * 대조한다. E1/E6 는 §1-1(-b) 에서 「엔진이 CSS 와 갈리는」 축으로 실측됐으므로, 수정 후
 * **diff 0** 이 기대값이다(수정 전이면 이 fixture 가 실패한다 = RED).
 *
 * 모든 케이스는 definite `root`(200×500 block) 아래 **중첩** — root 자기 크기(E5) 격리.
 */

// 테스트 컨테이너를 definite root 아래 중첩 (flexSweep.nestUnderRoot 와 동일 계약).
function nested(
  container: StyleRecord,
  children: CaseNode[],
  name: string,
): ParityCase {
  const kids = children.length;
  return {
    name,
    availW: 200,
    availH: -1,
    nodes: [
      ...children,
      {
        label: "box",
        style: container,
        children: children.map((_, i) => i),
      },
      {
        label: "root",
        style: { display: "block", width: "200px", height: "500px" },
        children: [kids],
      },
    ],
  };
}

// ── E1: align-self (per-item cross 정렬) ──
const E1_CASES: ParityCase[] = [
  nested(
    {
      display: "flex",
      flexDirection: "row",
      alignItems: "flex-start",
      width: "200px",
      height: "100px",
    },
    [
      { label: "a", style: { width: "40px", height: "20px" } },
      {
        label: "b",
        style: { width: "40px", height: "20px", alignSelf: "center" },
      },
      {
        label: "c",
        style: { width: "40px", height: "20px", alignSelf: "flex-end" },
      },
    ],
    "E1 row: align-self center/end override align-items:flex-start",
  ),
  nested(
    {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      width: "200px",
      height: "100px",
    },
    [
      { label: "a", style: { width: "40px", height: "20px" } },
      {
        label: "b",
        style: { width: "40px", height: "20px", alignSelf: "flex-start" },
      },
      {
        label: "c",
        style: { width: "40px", height: "20px", alignSelf: "stretch" },
      },
    ],
    "E1 row: align-self start/stretch override align-items:center",
  ),
  nested(
    {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      width: "200px",
      height: "160px",
    },
    [
      { label: "a", style: { width: "40px", height: "30px" } },
      {
        label: "b",
        style: { width: "40px", height: "30px", alignSelf: "center" },
      },
      {
        label: "c",
        style: { width: "40px", height: "30px", alignSelf: "flex-end" },
      },
    ],
    "E1 column: align-self center/end map to x (cross=width)",
  ),
  nested(
    {
      display: "flex",
      flexDirection: "row",
      alignItems: "flex-start",
      width: "200px",
      height: "100px",
    },
    [
      // auto height + align-self:stretch → 컨테이너 cross(100) 채움.
      { label: "a", style: { width: "40px", alignSelf: "stretch" } },
      // align-self:auto(미지정) → 컨테이너 align-items:flex-start 상속.
      { label: "b", style: { width: "40px", height: "20px" } },
    ],
    "E1 row: align-self stretch fills cross, auto inherits container",
  ),
];

describe("ADR-156 Phase 2 — E1 align-self 엔진↔CSS 정합 (G2)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(E1_CASES)("$name", (c) => {
    const bad = runParityCase(c);
    expect(bad, `${c.name} 발산:\n${bad.join("\n")}`).toEqual([]);
  });
});

// ── E6: percent height 폭 기준 오해석 ──
// 폭≠높이(200×300)로 구성 — "폭 기준 오해석"이 관측된다(수정 전 50%×200=100, 후 50%×300=150).
const E6_CASES: ParityCase[] = [
  nested(
    { display: "block", width: "200px", height: "300px" },
    // block 자식: 폭 auto→stretch(200), height:50% → 컨테이너 높이 300 기준 = 150.
    [{ label: "k", style: { height: "50%" } }],
    "E6 block: child height:50% resolves against container height (150, not width→100)",
  ),
  nested(
    {
      display: "flex",
      flexDirection: "column",
      width: "200px",
      height: "300px",
    },
    // flex column 자식: main=height. height:50% → 300 기준 = 150 (폭 200 기준 100 아님).
    [{ label: "k", style: { height: "50%" } }],
    "E6 flex-column: child height:50% resolves against container height (150)",
  ),
  nested(
    // auto 높이 컨테이너(height 미지정) — child height:50% 는 참조 확정 높이 없음 → auto(0).
    { display: "block", width: "200px" },
    [{ label: "k", style: { width: "40px", height: "50%" } }],
    "E6 block auto-height: child height:50% → auto (h≈0, not width→100)",
  ),
  nested(
    // R8 가드: margin/padding 의 `%` 는 폭 기준 유지 — height 축 도입이 이를 깨면 안 됨.
    // marginLeft:25% → 폭 200 의 25% = 50 → child x=50 (block flow).
    { display: "block", width: "200px" },
    [
      {
        label: "k",
        style: { width: "40px", height: "20px", marginLeft: "25%" },
      },
    ],
    "E6 R8 guard: marginLeft:25% stays width-based (x=50)",
  ),
];

describe("ADR-156 Phase 2 — E6 percent height 엔진↔CSS 정합 (G2)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(E6_CASES)("$name", (c) => {
    const bad = runParityCase(c);
    expect(bad, `${c.name} 발산:\n${bad.join("\n")}`).toEqual([]);
  });
});
