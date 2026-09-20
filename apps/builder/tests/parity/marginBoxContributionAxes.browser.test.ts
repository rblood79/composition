import { beforeAll, describe, expect, it } from "vitest";

import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";

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
 * 컨테이너 auto 크기에 자식 **margin-box** 가 들어가는가 — 양축 × 컨테이너 종류 sweep (2026-09-20).
 * grid 행 기여가 margin 을 빼먹던 결함 (`gridContainerBlockSize` A9~A11) 의 유사 패턴 점검 → 수정 전
 * RED 6 (engine/pipeline 각):
 *
 * | 케이스                                  | Chrome | 종전 엔진 | 병인                                         |
 * | --------------------------------------- | ------ | --------- | -------------------------------------------- |
 * | flex row auto 높이 + marginBottom 30    | 80     | 50        | `solve_flex` 4) bbox 가 border-box (end margin 누락) |
 * | flex row shrink-to-fit + marginRight 20 | 65     | 45        | 같은 bbox                                    |
 * | flex column shrink-to-fit + marginRight | 65     | 45        | 같은 bbox (cross)                            |
 * | flex wrap 2 라인 + marginBottom         | 140    | 120       | 같은 bbox                                    |
 * | block shrink-to-fit + marginRight 20    | 65     | 45        | `solve_block` max_right 가 border-box        |
 * | grid auto 행 + margin 5% / wrap 자식    | 60/80  | 40/40     | 행을 열보다 먼저 **컨테이너 폭**으로 잼      |
 *
 * 수리: flex/block 은 margin-box extent (`flex_margin_box_extent*` · block `m_right`), grid 는 열을
 * 먼저 확정하고 행을 각 자식의 **area 폭**으로 잰다 (§12.1 step 1→2). 대조군 (열 기여 · column
 * main 합 · block auto 높이 · grid shrink-to-fit 폭) 은 종전에도 GREEN.
 */
const box = (
  label: string,
  style: StyleRecord,
  children?: number[],
): CaseNode => ({ label, style, children }) as CaseNode;
const ROOT = (children: number[], style: StyleRecord = {}): CaseNode =>
  box(
    "root",
    { display: "block", width: "400px", height: "600px", ...style },
    children,
  );
const KID: StyleRecord = { width: "40px", height: "40px" };
const M4: StyleRecord = {
  marginTop: "10px",
  marginRight: "20px",
  marginBottom: "30px",
  marginLeft: "5px",
};
const c = (name: string, nodes: CaseNode[]): ParityCase => ({
  name,
  availW: 400,
  availH: 600,
  nodes,
});

const CASES: ParityCase[] = [
  // ── flex ──
  c("flex row auto 높이 (cross) > 자식 marginTop/Bottom → 컨테이너 80", [
    box("a", { ...KID, ...M4 }),
    box("b", KID),
    box(
      "flex",
      { display: "flex", flexDirection: "row", width: "300px" },
      [0, 1],
    ),
    ROOT([2]),
  ]),
  c("flex column auto 높이 (main) > 자식 margin → 합 (40+40+40+10)", [
    box("a", { ...KID, ...M4 }),
    box("b", { ...KID, marginTop: "10px" }),
    box(
      "flex",
      { display: "flex", flexDirection: "column", width: "300px" },
      [0, 1],
    ),
    ROOT([2]),
  ]),
  c("flex row shrink-to-fit 폭 (flex item 안) > 자식 margin → 합 (main)", [
    box("a", { ...KID, ...M4 }),
    box("b", KID),
    box("inner", { display: "flex", flexDirection: "row" }, [0, 1]),
    box(
      "outer",
      { display: "flex", flexDirection: "row", width: "400px" },
      [2],
    ),
    ROOT([3]),
  ]),
  c(
    "flex column shrink-to-fit 폭 (flex item 안) > 자식 marginLeft/Right → max (cross)",
    [
      box("a", { ...KID, ...M4 }),
      box("b", KID),
      box("inner", { display: "flex", flexDirection: "column" }, [0, 1]),
      box(
        "outer",
        { display: "flex", flexDirection: "row", width: "400px" },
        [2],
      ),
      ROOT([3]),
    ],
  ),
  c("flex row wrap auto 높이 > 2 라인 자식 margin (라인 cross 합)", [
    box("a", { ...KID, ...M4, width: "200px" }),
    box("b", { ...KID, width: "200px", marginBottom: "20px" }),
    box(
      "flex",
      {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        width: "300px",
      },
      [0, 1],
    ),
    ROOT([2]),
  ]),
  // ── block ──
  c(
    "block shrink-to-fit 폭 (flex item 안) > 자식 marginLeft/Right → max-content 에 margin",
    [
      box("a", { ...KID, ...M4 }),
      box("inner", { display: "block" }, [0]),
      box(
        "outer",
        { display: "flex", flexDirection: "row", width: "400px" },
        [1],
      ),
      ROOT([2]),
    ],
  ),
  c("block auto 높이 (padding 으로 collapse 차단) > 자식 margin → 합", [
    box("a", { ...KID, ...M4 }),
    box("b", { ...KID, marginTop: "10px" }),
    box(
      "inner",
      { display: "block", paddingTop: "1px", paddingBottom: "1px" },
      [0, 1],
    ),
    ROOT([2]),
  ]),
  // ── grid 다른 축 · `%` ──
  c("grid shrink-to-fit 폭 (flex item 안) auto 열 > 자식 marginLeft/Right", [
    box("a", { ...KID, ...M4 }),
    box("b", KID),
    box(
      "grid",
      { display: "grid", gridTemplateColumns: ["auto", "auto"] },
      [0, 1],
    ),
    box(
      "outer",
      { display: "flex", flexDirection: "row", width: "400px" },
      [2],
    ),
    ROOT([3]),
  ]),
  c("grid auto 행 > 자식 margin 5% (Chrome 은 area 폭 200 기준 10 → 트랙 60)", [
    box("a", {
      ...KID,
      marginTop: "5%",
      marginRight: "5%",
      marginBottom: "5%",
      marginLeft: "5%",
    }),
    box("b", KID),
    box(
      "grid",
      { display: "grid", gridTemplateColumns: ["1fr", "1fr"], width: "400px" },
      [0, 1],
    ),
    ROOT([2]),
  ]),
  c("grid auto 행 > 자식 paddingTop 10% (area 폭 200 기준 20 → 트랙 60)", [
    box("inner", KID),
    box("a", { width: "40px", paddingTop: "10%" }, [0]),
    box("b", { ...KID, height: "10px" }),
    box(
      "grid",
      { display: "grid", gridTemplateColumns: ["1fr", "1fr"], width: "400px" },
      [1, 2],
    ),
    ROOT([3]),
  ]),
  c(
    "grid auto 행 (2열) > wrap flex 자식 — 행 측정 폭이 area 200 이면 2줄 (Chrome 80)",
    [
      box("k1", { width: "100px", height: "40px" }),
      box("k2", { width: "100px", height: "40px" }),
      box("k3", { width: "100px", height: "40px" }),
      box(
        "a",
        { display: "flex", flexDirection: "row", flexWrap: "wrap" },
        [0, 1, 2],
      ),
      box("b", { ...KID, height: "10px" }),
      box(
        "grid",
        {
          display: "grid",
          gridTemplateColumns: ["1fr", "1fr"],
          width: "400px",
        },
        [3, 4],
      ),
      ROOT([5]),
    ],
  ),
  c(
    "grid auto 행 > 자식 marginTop 10 + paddingTop 10 (auto 높이 · pad/border 와 margin 합)",
    [
      box("a", {
        width: "40px",
        marginTop: "10px",
        paddingTop: "10px",
        minHeight: "20px",
      }),
      box(
        "grid",
        { display: "grid", gridTemplateColumns: ["100px"], width: "300px" },
        [0],
      ),
      ROOT([1]),
    ],
  ),
];

describe("margin-box 기여 — 양축 sweep", () => {
  beforeAll(async () => {
    await initEngineWasm();
  });
  it.each(CASES.map((k) => [k.name, k] as const))("engine — %s", (_n, k) => {
    const bad = diffCase(
      k.nodes,
      domLeg(k.nodes, k.availW),
      engineLeg(k.nodes, k.availW, k.availH),
    );
    expect(bad, bad.join("\n")).toEqual([]);
  });
  it.each(CASES.map((k) => [k.name, k] as const))("pipeline — %s", (_n, k) => {
    const bad = diffCase(
      k.nodes,
      domLeg(k.nodes, k.availW),
      pipelineLeg(k.nodes, k.availW, k.availH),
    );
    expect(bad, bad.join("\n")).toEqual([]);
  });
});
