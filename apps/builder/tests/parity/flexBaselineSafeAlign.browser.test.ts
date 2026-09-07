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
 * flex 정렬 키워드 — `baseline` · `safe`/`unsafe` 접두 · `self-start`/`self-end`
 * (upstream 대조 ⑦, 2026-09-07 — Taffy #1109 · #1127 · #952 · #1077)
 *
 * - CSS-FLEXBOX-1 §8.3 `align-items: baseline`: baseline 그룹의 item 은 baseline 을 맞춰 놓이고
 *   그룹은 라인 cross-start 에 붙는다. baseline 이 없는 상자는 border-box 아래 모서리로 합성한다
 *   (F4 — h30 · h60 → a.y 30, 종전 0). cross 축 auto margin 이 있는 item 은 그룹에서 빠진다 (#1109).
 *   column 방향의 baseline 은 start 로 동작한다.
 * - CSS-ALIGN-3 §4.4 `safe`: 넘치면 start 로 (F8b — `safe center` 여유 있으면 150 · 넘치면 0). flex 의
 *   기본 (접두 없음) 은 unsafe — center 가 양쪽으로 넘친다 (종전 crossAxisOverflow 실측 유지).
 * - `self-start` / `self-end` 는 flex 에서 start / end (writing-mode 미지원 → 동치).
 */

const n = (label: string, style: StyleRecord, children?: number[]): CaseNode =>
  ({ label, style, children }) as CaseNode;

const box = (label: string, extra: StyleRecord = {}): CaseNode =>
  n(label, { width: "50px", height: "30px", ...extra });

const row = (extra: StyleRecord, children: number[]): CaseNode =>
  n(
    "root",
    { display: "flex", flexDirection: "row", width: "400px", ...extra },
    children,
  );

const BASELINE: ParityCase[] = [
  {
    name: "F4 row align-items baseline > a h30 · b h60 → a.y 30 (합성 baseline = 아래 모서리)",
    availW: 400,
    availH: -1,
    nodes: [
      box("a"),
      box("b", { height: "60px" }),
      row({ alignItems: "baseline" }, [0, 1]),
    ],
  },
  {
    name: "baseline > a h30 · b mt10 h60 → b baseline 70, a.y 40, root h 70",
    availW: 400,
    availH: -1,
    nodes: [
      box("a"),
      box("b", { height: "60px", marginTop: "10px" }),
      row({ alignItems: "baseline" }, [0, 1]),
    ],
  },
  {
    name: "baseline > a h100 · b h20 → b.y 80, root h 100",
    availW: 400,
    availH: -1,
    nodes: [
      box("a", { height: "100px" }),
      box("b", { height: "20px" }),
      row({ alignItems: "baseline" }, [0, 1]),
    ],
  },
  {
    name: "baseline + padding-bottom — a h30 pb20 · b h60 → 합성은 border-box 아래, a.y 30",
    availW: 400,
    availH: -1,
    nodes: [
      box("a", { paddingBottom: "20px" }),
      box("b", { height: "60px" }),
      row({ alignItems: "baseline" }, [0, 1]),
    ],
  },
  {
    name: "align-self baseline 둘 + 셋째 start — a h30 · b h60 (baseline) · c h20 (start)",
    availW: 400,
    availH: -1,
    nodes: [
      box("a", { alignSelf: "baseline" }),
      box("b", { height: "60px", alignSelf: "baseline" }),
      box("c", { height: "20px" }),
      row({ alignItems: "flex-start" }, [0, 1, 2]),
    ],
  },
  {
    name: "baseline 그룹 + definite 높이 h200 — 그룹은 cross-start 에 (a.y 30 · b.y 0)",
    availW: 400,
    availH: -1,
    nodes: [
      box("a"),
      box("b", { height: "60px" }),
      row({ alignItems: "baseline", height: "200px" }, [0, 1]),
    ],
  },
  {
    name: "baseline + 자식 margin-top auto — b 는 그룹 밖 (#1109), a.y 0",
    availW: 400,
    availH: -1,
    nodes: [
      box("a"),
      box("b", { height: "60px", marginTop: "auto" }),
      row({ alignItems: "baseline", height: "200px" }, [0, 1]),
    ],
  },
  {
    name: "column + baseline → start (a.x 0 · b.x 0)",
    availW: 400,
    availH: -1,
    nodes: [
      box("a"),
      box("b", { width: "100px" }),
      n(
        "root",
        {
          display: "flex",
          flexDirection: "column",
          width: "400px",
          alignItems: "baseline",
        },
        [0, 1],
      ),
    ],
  },
  {
    name: "baseline + 중첩 flex item — b 는 row 컨테이너 (자식 h60) → b 의 baseline 은 자식 아래",
    availW: 400,
    availH: -1,
    nodes: [
      box("a"),
      box("b-child", { height: "60px" }),
      n("b", { display: "flex", flexDirection: "row" }, [1]),
      row({ alignItems: "baseline" }, [0, 2]),
    ],
  },
  {
    name: "wrap 2 줄 baseline — 줄마다 독립 (a h30 · b h60 | c h30 · d h80)",
    availW: 400,
    availH: -1,
    nodes: [
      box("a", { width: "200px" }),
      box("b", { width: "200px", height: "60px" }),
      box("c", { width: "200px" }),
      box("d", { width: "200px", height: "80px" }),
      row({ alignItems: "baseline", flexWrap: "wrap" }, [0, 1, 2, 3]),
    ],
  },
  {
    name: "대조군 — align-items flex-start > a h30 · b h60 → a.y 0",
    availW: 400,
    availH: -1,
    nodes: [
      box("a"),
      box("b", { height: "60px" }),
      row({ alignItems: "flex-start" }, [0, 1]),
    ],
  },
];

const SAFE: ParityCase[] = [
  {
    name: "F8b justify-content safe center w400 > item w100 → x 150",
    availW: 400,
    availH: -1,
    nodes: [
      box("a", { width: "100px" }),
      row({ justifyContent: "safe center" }, [0]),
    ],
  },
  {
    name: "justify safe center 넘침 w100 > item w300 → x 0",
    availW: 400,
    availH: -1,
    nodes: [
      box("a", { width: "300px", flexShrink: 0 }),
      row({ justifyContent: "safe center", width: "100px" }, [0]),
    ],
  },
  {
    name: "justify unsafe center 넘침 w100 > item w300 → x −100",
    availW: 400,
    availH: -1,
    nodes: [
      box("a", { width: "300px", flexShrink: 0 }),
      row({ justifyContent: "unsafe center", width: "100px" }, [0]),
    ],
  },
  {
    name: "justify safe flex-end 넘침 → x 0 · unsafe flex-end → −200",
    availW: 400,
    availH: -1,
    nodes: [
      box("a", { width: "300px", flexShrink: 0 }),
      row({ justifyContent: "safe flex-end", width: "100px" }, [0]),
    ],
  },
  {
    name: "justify unsafe flex-end 넘침 → x −200",
    availW: 400,
    availH: -1,
    nodes: [
      box("a", { width: "300px", flexShrink: 0 }),
      row({ justifyContent: "unsafe flex-end", width: "100px" }, [0]),
    ],
  },
  {
    name: "align-items safe center 넘침 h100 > item h300 → y 0",
    availW: 400,
    availH: -1,
    nodes: [
      box("a", { height: "300px" }),
      row({ alignItems: "safe center", height: "100px" }, [0]),
    ],
  },
  {
    name: "align-items safe center 여유 h200 > item h50 → y 75",
    availW: 400,
    availH: -1,
    nodes: [
      box("a", { height: "50px" }),
      row({ alignItems: "safe center", height: "200px" }, [0]),
    ],
  },
  {
    name: "align-self safe flex-end 넘침 h100 > item h300 → y 0 (컨테이너 center 무시)",
    availW: 400,
    availH: -1,
    nodes: [
      box("a", { height: "300px", alignSelf: "safe flex-end" }),
      row({ alignItems: "center", height: "100px" }, [0]),
    ],
  },
  {
    name: "align-content safe center — wrap h200 두 줄 합 60 → 70 · 넘침 (h50) → 0",
    availW: 400,
    availH: -1,
    nodes: [
      box("a", { width: "300px" }),
      box("b", { width: "300px" }),
      row(
        { alignContent: "safe center", flexWrap: "wrap", height: "200px" },
        [0, 1],
      ),
    ],
  },
  {
    name: "align-content safe center 넘침 — wrap h20 두 줄 합 60 → 0",
    availW: 400,
    availH: -1,
    nodes: [
      box("a", { width: "300px" }),
      box("b", { width: "300px" }),
      row(
        { alignContent: "safe center", flexWrap: "wrap", height: "20px" },
        [0, 1],
      ),
    ],
  },
  {
    name: "대조군 — justify center 넘침 (접두 없음) → x −100",
    availW: 400,
    availH: -1,
    nodes: [
      box("a", { width: "300px", flexShrink: 0 }),
      row({ justifyContent: "center", width: "100px" }, [0]),
    ],
  },
];

const SELF_START_END: ParityCase[] = [
  {
    name: "align-items self-end h200 > item h50 → y 150",
    availW: 400,
    availH: -1,
    nodes: [
      box("a", { height: "50px" }),
      row({ alignItems: "self-end", height: "200px" }, [0]),
    ],
  },
  {
    name: "align-items self-start h200 > item h50 → y 0",
    availW: 400,
    availH: -1,
    nodes: [
      box("a", { height: "50px" }),
      row({ alignItems: "self-start", height: "200px" }, [0]),
    ],
  },
  {
    name: "align-self self-end (컨테이너 flex-start) h200 → y 150",
    availW: 400,
    availH: -1,
    nodes: [
      box("a", { height: "50px", alignSelf: "self-end" }),
      row({ alignItems: "flex-start", height: "200px" }, [0]),
    ],
  },
  {
    name: "column align-items self-end w400 > item w50 → x 350",
    availW: 400,
    availH: -1,
    nodes: [
      box("a"),
      n(
        "root",
        {
          display: "flex",
          flexDirection: "column",
          width: "400px",
          alignItems: "self-end",
        },
        [0],
      ),
    ],
  },
];

const ALL = [...BASELINE, ...SAFE, ...SELF_START_END];

describe("⑦ flex baseline · safe/unsafe · self-start/self-end", () => {
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
