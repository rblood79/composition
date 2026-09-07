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
 * grid 암묵 트랙 — 명시 grid 를 넘어서는 배치와 template 없는 grid (ADR-206 Phase 2, ② · ④)
 *
 * CSS-GRID-1 §7.6 / §8.5: 명시 배치 (`grid-column` / `grid-row` 의 start 또는 span) 가 명시 grid
 * 밖으로 나가면 **암묵 트랙이 생긴다**. 암묵 트랙의 크기는 `grid-auto-columns` / `grid-auto-rows`
 * (기본 `auto`) 가 목록을 순환하며 정한다. template 이 아예 없는 grid 도 같은 규칙으로 암묵
 * 열 1개를 가진다. 엔진은 라인을 10,000 에서 clamp 한다 (Chrome 은 10,000,000 — 실측, 편차 기록).
 *
 * 종전 엔진 (Chrome 실측 2026-09-07, TAFFY_UPSTREAM_DELTA_2026-09.md §2):
 * - G4 — 2열 grid 에 `grid-column: 1 / span 3` → `block_fits` 의 열 한계가 명시 배치에도 걸려
 *   10,000 반복 가드가 실패 위치 (행 10,001) 를 그대로 배치 → item y **100,000**.
 * - G12 — 정폭 grid 에 template 이 없으면 셀 폭 폴백 **100** (Chrome 400 = 암묵 `auto` 열 stretch).
 * - G10 — auto 축의 `repeat(2, 40px)` 이 하나의 content 행으로 접힘 (b.y 20 / Chrome 40).
 * - G11 — `grid-auto-columns: 1fr 2fr` 가 첫 토큰 px 만 읽혀 100/100 (Chrome 133/267), root h 0.
 *
 * 대조군은 **자동 배치가 명시 열 한계를 지키는** 케이스 — 한계 해제가 자동 배치 축으로 새면
 * 3번째 item 이 다음 행으로 안 내려간다.
 */

const n = (label: string, style: StyleRecord, children?: number[]): CaseNode =>
  ({ label, style, children }) as CaseNode;

const leaf = (label: string, extra: StyleRecord = {}): CaseNode =>
  n(label, { height: "20px", ...extra });

const CASES: ParityCase[] = [
  {
    name: "G4 cols 100px 100px > item grid-column 1 / span 3 → 암묵 3열, y 0",
    availW: 400,
    availH: -1,
    nodes: [
      leaf("a", { gridColumnStart: "1", gridColumnEnd: "span 3" }),
      n(
        "root",
        {
          display: "grid",
          width: "400px",
          gridTemplateColumns: ["100px", "100px"],
          rowGap: "10px",
        },
        [0],
      ),
    ],
  },
  {
    name: "G4b span 초과 뒤 자동 item — 다음 행, 열 1",
    availW: 400,
    availH: -1,
    nodes: [
      leaf("a", { gridColumnStart: "1", gridColumnEnd: "span 3" }),
      leaf("b"),
      n(
        "root",
        {
          display: "grid",
          width: "400px",
          gridTemplateColumns: ["100px", "100px"],
        },
        [0, 1],
      ),
    ],
  },
  {
    name: "G4' rows 40px > item grid-row-start 3 → 암묵 행 2·3",
    availW: 400,
    availH: -1,
    nodes: [
      leaf("a", { gridRowStart: "3" }),
      n(
        "root",
        {
          display: "grid",
          width: "400px",
          gridTemplateColumns: ["100px", "100px"],
          gridTemplateRows: ["40px"],
        },
        [0],
      ),
    ],
  },
  {
    name: "G4'' col-start 4 (열 한계 2) → 암묵 열 3·4, x 200",
    availW: 400,
    availH: -1,
    nodes: [
      leaf("a", { gridColumnStart: "4" }),
      n(
        "root",
        {
          display: "grid",
          width: "400px",
          gridTemplateColumns: ["100px", "100px"],
        },
        [0],
      ),
    ],
  },
  {
    name: "G12 정폭 w400 template 없음 > item 1 → 400×20",
    availW: 400,
    availH: -1,
    nodes: [leaf("item"), n("root", { display: "grid", width: "400px" }, [0])],
  },
  {
    name: "G12 정폭 w400 template 없음 > item 3 → 행 3개 400 폭",
    availW: 400,
    availH: -1,
    nodes: [
      leaf("a"),
      leaf("b", { height: "30px" }),
      leaf("c"),
      n("root", { display: "grid", width: "400px" }, [0, 1, 2]),
    ],
  },
  {
    name: "G10 rows repeat(2, 40px) height auto > a, b → b.y 40, root h 80",
    availW: 400,
    availH: -1,
    nodes: [
      leaf("a"),
      leaf("b"),
      n(
        "root",
        {
          display: "grid",
          width: "400px",
          gridTemplateRows: ["repeat(2, 40px)"],
        },
        [0, 1],
      ),
    ],
  },
  {
    name: "G11 auto-flow column · auto-columns 1fr 2fr w400 > a, b → 133 / 267",
    availW: 400,
    availH: -1,
    nodes: [
      leaf("a"),
      leaf("b"),
      n(
        "root",
        {
          display: "grid",
          width: "400px",
          gridAutoFlow: "column",
          gridAutoColumns: ["1fr", "2fr"],
        },
        [0, 1],
      ),
    ],
  },
  {
    name: "G11b auto-flow column · auto-columns 50px 1fr > 4 item → 50/1fr 순환",
    availW: 400,
    availH: -1,
    nodes: [
      leaf("a"),
      leaf("b"),
      leaf("c"),
      leaf("d"),
      n(
        "root",
        {
          display: "grid",
          width: "400px",
          gridAutoFlow: "column",
          gridAutoColumns: ["50px", "1fr"],
          gridTemplateRows: ["20px"],
        },
        [0, 1, 2, 3],
      ),
    ],
  },
  {
    name: "row-flow · auto-rows 30px 1fr > 3 item (cols 1) → 30 / 1fr(content) / 30",
    availW: 400,
    availH: -1,
    nodes: [
      leaf("a"),
      leaf("b"),
      leaf("c"),
      n(
        "root",
        {
          display: "grid",
          width: "400px",
          gridTemplateColumns: ["100px"],
          gridAutoRows: ["30px", "1fr"],
        },
        [0, 1, 2],
      ),
    ],
  },
  {
    // 엔진 라인 상한은 10,000 (`grid.rs::MAX_GRID_LINE` — Firefox · Taffy 값). Chrome 실측
    // (2026-09-07) 은 10,000,000 (line 10000001 → y 9999999) — 그 사이 값은 의도된 편차라
    // 여기서는 상한 안쪽 (5000) 만 대조한다. 상한 자체는 grid.rs unit 이 잠근다.
    name: "먼 명시 라인 grid-row-start 5000 · auto-rows 1px → 암묵 행 4999 (y 4,999)",
    availW: 400,
    availH: -1,
    nodes: [
      leaf("a", { gridRowStart: "5000" }),
      n(
        "root",
        {
          display: "grid",
          width: "400px",
          gridTemplateColumns: ["100px"],
          gridAutoRows: ["1px"],
        },
        [0],
      ),
    ],
  },
];

const CONTROLS: ParityCase[] = [
  {
    name: "대조군 — 자동 배치 3 item / cols 2 → 3번째는 다음 행",
    availW: 400,
    availH: -1,
    nodes: [
      leaf("a"),
      leaf("b"),
      leaf("c"),
      n(
        "root",
        {
          display: "grid",
          width: "400px",
          gridTemplateColumns: ["100px", "100px"],
        },
        [0, 1, 2],
      ),
    ],
  },
  {
    name: "gridColumnEnd span 2 단독 (auto / span 2) · cols 3 → 커서가 열 한계 안에서 줄바꿈",
    availW: 400,
    availH: -1,
    nodes: [
      leaf("a"),
      leaf("b", { gridColumnEnd: "span 2" }),
      leaf("c", { gridColumnEnd: "span 2" }),
      n(
        "root",
        {
          display: "grid",
          width: "400px",
          gridTemplateColumns: ["100px", "100px", "100px"],
        },
        [0, 1, 2],
      ),
    ],
  },
  {
    name: "대조군 — 명시 span 이 한계 안 (1 / 3) → 종전과 같음",
    availW: 400,
    availH: -1,
    nodes: [
      leaf("a", { gridColumnStart: "1", gridColumnEnd: "3" }),
      leaf("b"),
      n(
        "root",
        {
          display: "grid",
          width: "400px",
          gridTemplateColumns: ["100px", "100px"],
        },
        [0, 1],
      ),
    ],
  },
  {
    name: "대조군 — column flow · auto-columns 60px (E14 px 경로) → 60 폭 열",
    availW: 400,
    availH: -1,
    nodes: [
      leaf("a"),
      leaf("b"),
      leaf("c"),
      n(
        "root",
        {
          display: "grid",
          width: "400px",
          gridAutoFlow: "column",
          gridAutoColumns: ["60px"],
          gridTemplateRows: ["20px"],
        },
        [0, 1, 2],
      ),
    ],
  },
];

describe("ADR-206 Phase 2 — grid 암묵 트랙", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each([...CASES, ...CONTROLS].map((c) => [c.name, c] as const))(
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

  it.each([...CASES, ...CONTROLS].map((c) => [c.name, c] as const))(
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
