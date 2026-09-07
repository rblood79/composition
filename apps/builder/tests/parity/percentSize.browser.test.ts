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

/**
 * ADR-206 Phase 1 — **늘어난 크기는 definite 다** (CSS-FLEXBOX-1 §9.8 · CSS-GRID-1 §6.6 ·
 * CSS-SIZING-4 §5.2.2). 위 §10.5 규칙 ("상속 available 은 높이를 확정하지 않는다") 은 그대로
 * 유지하되, **stretch / grid area / aspect 전송 / 정의된 컨테이너의 post-flexing main** 으로
 * 확정된 크기는 손자 `%` 의 base 가 된다. Chrome 실측 (2026-09-07, Taffy 0.10→0.14 대조 F5 ·
 * B1d · B6c + 리뷰 round 1 W3 · W4): 종전 엔진은 `explicit_h > 0` 단일 게이트라 전부 0.
 *
 * - Chrome 은 multi-line (`flex-wrap: wrap`) 의 stretch item 도 확정으로 본다 — §9.8 의
 *   "single-line" 한정과 다르다. 기준은 **분배 뒤 라인 cross** (W4 57.5).
 * - 대조군 (`ADR206_CONTROLS`) 은 채널이 **가짜 확정**을 만들지 않음을 잠근다 — 비확정
 *   (align-self start · auto margin · height auto 부모 · grid align start) 은 종전처럼 0.
 */

const n = (label: string, style: StyleRecord, children?: number[]): CaseNode =>
  ({ label, style, children }) as CaseNode;
const pct = (label = "inner", extra: StyleRecord = {}): CaseNode =>
  n(label, { height: "50%", width: "40px", ...extra });
const rowRoot = (children: number[], extra: StyleRecord = {}): CaseNode =>
  n(
    "root",
    {
      display: "flex",
      flexDirection: "row",
      width: "400px",
      height: "200px",
      ...extra,
    },
    children,
  );

const ADR206_CASES: ParityCase[] = [
  {
    name: "F5 row h200 > item(auto) > h50% → 100 (stretch 확정)",
    availW: 400,
    availH: -1,
    nodes: [pct(), n("item", { width: "100px" }, [0]), rowRoot([1])],
  },
  {
    name: "중첩 stretch — row h200 > item(row, auto h) > 손자 auto h → 200",
    availW: 400,
    availH: -1,
    nodes: [
      n("inner", { width: "40px" }),
      n("item", { display: "flex", flexDirection: "row", width: "100px" }, [0]),
      rowRoot([1]),
    ],
  },
  {
    name: "3단 — row h200 > item(block) > mid h100% > inner h50% → 100",
    availW: 400,
    availH: -1,
    nodes: [
      pct(),
      n("mid", { height: "100%", width: "60px" }, [0]),
      n("item", { width: "100px" }, [1]),
      rowRoot([2]),
    ],
  },
  {
    name: "B1d grid rows 200px > item > h50% → 100 (grid area 확정)",
    availW: 200,
    availH: -1,
    nodes: [
      pct(),
      n("item", {}, [0]),
      n(
        "root",
        {
          display: "grid",
          gridTemplateRows: ["200px"],
          gridTemplateColumns: ["200px"],
          width: "200px",
        },
        [1],
      ),
    ],
  },
  {
    name: "grid auto row — item > [A h100px, B h50%] → B 50 (트랙 확정 뒤 area 기준)",
    availW: 200,
    availH: -1,
    nodes: [
      n("a", { height: "100px", width: "40px" }),
      pct("b"),
      n("item", {}, [0, 1]),
      n(
        "root",
        { display: "grid", gridTemplateColumns: ["200px"], width: "200px" },
        [2],
      ),
    ],
  },
  {
    name: "B6c aspect 2 (w300 → h150) > h50% → 75 (전송 높이 확정)",
    availW: 300,
    availH: -1,
    nodes: [
      pct("inner", { width: "20px" }),
      n("ar", { aspectRatio: 2 }, [0]),
      n("root", { width: "300px" }, [1]),
    ],
  },
  {
    name: "aspect 2 (w300 → 150) 이지만 내용 200 > 전송 — [A h200px, B h50%]",
    availW: 300,
    availH: -1,
    nodes: [
      n("a", { height: "200px", width: "20px" }),
      pct("b", { width: "20px" }),
      n("ar", { aspectRatio: 2 }, [0, 1]),
      n("root", { width: "300px" }, [2]),
    ],
  },
  {
    name: "W3 wrap h200 · 3×150 → 2 라인 (100) > h50% → 50",
    availW: 400,
    availH: -1,
    nodes: [
      pct(),
      n("item", { width: "150px" }, [0]),
      n("item2", { width: "150px" }),
      n("item3", { width: "150px" }),
      rowRoot([1, 2, 3], { flexWrap: "wrap" }),
    ],
  },
  {
    name: "W4 wrap + item2 h30 + align-content stretch → 라인 115 > h50% → 57.5",
    availW: 400,
    availH: -1,
    nodes: [
      pct(),
      n("item", { width: "150px" }, [0]),
      n("item2", { width: "150px", height: "30px" }),
      n("item3", { width: "150px" }),
      rowRoot([1, 2, 3], { flexWrap: "wrap", alignContent: "stretch" }),
    ],
  },
  {
    name: "column h200 > item flexGrow 1 > h50% → 100 (post-flexing main 확정)",
    availW: 400,
    availH: -1,
    nodes: [
      pct(),
      n("item", { flexGrow: 1, width: "100px" }, [0]),
      n(
        "root",
        {
          display: "flex",
          flexDirection: "column",
          width: "400px",
          height: "200px",
          alignItems: "flex-start",
        },
        [1],
      ),
    ],
  },
  {
    name: "column h300 > item(auto, 내용 100) > [A h100px, B h50%] → B 50",
    availW: 400,
    availH: -1,
    nodes: [
      n("a", { height: "100px", width: "40px" }),
      pct("b"),
      n("item", { width: "100px" }, [0, 1]),
      n(
        "root",
        {
          display: "flex",
          flexDirection: "column",
          width: "400px",
          height: "300px",
          alignItems: "flex-start",
        },
        [2],
      ),
    ],
  },
];

const ADR206_CONTROLS: ParityCase[] = [
  {
    name: "대조군 — align-items flex-start (비stretch) > h50% → 0",
    availW: 400,
    availH: -1,
    nodes: [
      pct(),
      n("item", { width: "100px" }, [0]),
      rowRoot([1], { alignItems: "flex-start" }),
    ],
  },
  {
    name: "대조군 — item align-self flex-start > h50% → 0",
    availW: 400,
    availH: -1,
    nodes: [
      pct(),
      n("item", { width: "100px", alignSelf: "flex-start" }, [0]),
      rowRoot([1]),
    ],
  },
  {
    name: "대조군 — item margin-top auto (stretch 무효) > h50% → 0",
    availW: 400,
    availH: -1,
    nodes: [
      pct(),
      n("item", { width: "100px", marginTop: "auto" }, [0]),
      rowRoot([1]),
    ],
  },
  {
    name: "대조군 — row height auto 부모 > item > h50% → 0",
    availW: 400,
    availH: -1,
    nodes: [
      pct(),
      n("item", { width: "100px" }, [0]),
      n("root", { display: "flex", flexDirection: "row", width: "400px" }, [1]),
    ],
  },
  {
    name: "대조군 — row minHeight 400 (height auto) > item > h50%",
    availW: 400,
    availH: -1,
    nodes: [
      pct(),
      n("item", { width: "100px" }, [0]),
      n(
        "root",
        {
          display: "flex",
          flexDirection: "row",
          width: "400px",
          minHeight: "400px",
        },
        [1],
      ),
    ],
  },
  {
    // item 에 내용 (a 10px) 을 둔다 — 내용 0 인 auto item 은 엔진의 "0 붕괴 방지" 폴백
    // (`place_grid_axis` real_size ≤ 0 → 셀 채움, ADR-156 §Residual) 이 셀을 채워 Chrome 0 과
    // 갈린다. 그건 본 채널과 무관한 기존 결함 (LOW deferred) 이라 여기서는 비켜 간다.
    name: "대조군 — grid rows 200 > item align-self start (내용 10) > h50% → 0",
    availW: 200,
    availH: -1,
    nodes: [
      n("a", { height: "10px", width: "40px" }),
      pct(),
      n("item", { alignSelf: "start" }, [0, 1]),
      n(
        "root",
        {
          display: "grid",
          gridTemplateRows: ["200px"],
          gridTemplateColumns: ["200px"],
          width: "200px",
        },
        [2],
      ),
    ],
  },
  {
    name: "대조군 — stretch item aspect-ratio 1 · width auto > h50% (stretch 가 aspect 를 이김)",
    availW: 400,
    availH: -1,
    nodes: [pct(), n("item", { aspectRatio: 1 }, [0]), rowRoot([1])],
  },
  {
    name: "대조군 — 명시 height item (h100px) > h50% → 50 (기존 경로)",
    availW: 400,
    availH: -1,
    nodes: [
      pct(),
      n("item", { width: "100px", height: "100px" }, [0]),
      rowRoot([1]),
    ],
  },
  {
    name: "대조군 — stretch item 에 aspect-ratio 1 + w100 > h50%",
    availW: 400,
    availH: -1,
    nodes: [
      pct(),
      n("item", { width: "100px", aspectRatio: 1 }, [0]),
      rowRoot([1]),
    ],
  },
  {
    name: "대조군 — column h200 auto-h item 에 % 없음 (내용 100) → 100",
    availW: 400,
    availH: -1,
    nodes: [
      n("a", { height: "100px", width: "40px" }),
      n("item", { width: "100px" }, [0]),
      n(
        "root",
        {
          display: "flex",
          flexDirection: "column",
          width: "400px",
          height: "200px",
          alignItems: "flex-start",
        },
        [1],
      ),
    ],
  },
];

describe("ADR-206 Phase 1 — 늘어난 크기 definite 전파", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(
    [...ADR206_CASES, ...ADR206_CONTROLS].map((c) => [c.name, c] as const),
  )("engine leg — %s", (_name, c) => {
    const bad = diffCase(
      c.nodes,
      domLeg(c.nodes, c.availW),
      engineLeg(c.nodes, c.availW, c.availH),
    );
    expect(bad, bad.join("\n")).toEqual([]);
  });

  it.each(
    [...ADR206_CASES, ...ADR206_CONTROLS].map((c) => [c.name, c] as const),
  )("pipeline leg — %s", (_name, c) => {
    const bad = diffCase(
      c.nodes,
      domLeg(c.nodes, c.availW),
      pipelineLeg(c.nodes, c.availW, c.availH),
    );
    expect(bad, bad.join("\n")).toEqual([]);
  });
});
