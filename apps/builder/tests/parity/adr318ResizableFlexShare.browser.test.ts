import { beforeAll, describe, expect, it } from "vitest";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import {
  type CaseNode,
  domLeg,
  type ParityCase,
  runParityCase,
} from "./harness";

/**
 * ADR-318 Phase 0 시제품 P1 — Resizable 분할창의 크기 식 (breakdown §5.2) 을 엔진이 Chrome 과 같은
 * rect 로 푸는가. 기준값은 실제 Chrome 의 `getBoundingClientRect` (DOM leg — measurement-validity Q5).
 *
 * 식: Group = flex · 방향 · overflow hidden · main 축 확정. Panel = `flexGrow` 몫 · `flexShrink 1` ·
 * `flexBasis 0px` · main 축 min / max · overflow hidden (내용이 몫보다 넓어도 자동 최소 0). Handle =
 * `flex 0 0 auto` · main 축 두께 px. px 로 접힌 Panel = `flexGrow 0` · `flexBasis` 그 px.
 *
 * 입력 차원 (계약이 갈리는 것): 가로 · 세로 · 3 분할 (미지정 몫) · 손잡이 두께 · 중첩 (부모 Panel 의
 * stretch 된 cross 가 안쪽 Group 의 `100%`) · px min · % max (인라인 축) · % min (블록 축) · px 접힘 ·
 * 몫보다 넓은 / 높은 내용.
 */

const group = (
  direction: "row" | "column",
  w: string,
  h: string,
  children: number[],
): CaseNode => ({
  label: "group",
  style: {
    display: "flex",
    flexDirection: direction,
    width: w,
    height: h,
    overflowX: "hidden",
    overflowY: "hidden",
  },
  children,
});

const panel = (
  label: string,
  share: number,
  children: number[] = [],
  extra: Record<string, string | number> = {},
): CaseNode => ({
  label,
  style: {
    flexGrow: share,
    flexShrink: 1,
    flexBasis: "0px",
    overflowX: "hidden",
    overflowY: "hidden",
    ...extra,
  },
  children,
});

const handle = (
  label: string,
  direction: "row" | "column",
  thickness = 1,
): CaseNode => ({
  label,
  style: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: "auto",
    ...(direction === "row"
      ? { width: `${thickness}px` }
      : { height: `${thickness}px` }),
  },
});

/** 몫보다 넓고 높은 내용 — 자동 최소가 0 이 아니면 Panel 을 밀어낸다. */
const wide = (label: string): CaseNode => ({
  label,
  style: { width: "900px", height: "900px", flexShrink: 0 },
});

const CASES: ParityCase[] = [
  {
    name: "가로 50 / 50 · 손잡이 1px · 넓은 내용",
    availW: 600,
    availH: -1,
    nodes: [
      wide("c0"),
      panel("p0", 50, [0]),
      handle("h0", "row"),
      panel("p1", 50),
      group("row", "600px", "200px", [1, 2, 3]),
    ],
  },
  {
    name: "세로 30 / 70 · 높은 내용",
    availW: 300,
    availH: -1,
    nodes: [
      wide("c0"),
      panel("p0", 30, [0]),
      handle("h0", "column"),
      panel("p1", 70),
      group("column", "300px", "400px", [1, 2, 3]),
    ],
  },
  {
    name: "3 분할 25 / (미지정 → 50) / 25 · 손잡이 8px",
    availW: 600,
    availH: -1,
    nodes: [
      panel("p0", 25),
      handle("h0", "row", 8),
      panel("p1", 50),
      handle("h1", "row", 8),
      panel("p2", 25),
      group("row", "600px", "200px", [0, 1, 2, 3, 4]),
    ],
  },
  {
    name: "중첩 — 가로 40 / 60 의 뒤 Panel 안 세로 Group (100% · 100%)",
    availW: 600,
    availH: -1,
    nodes: [
      wide("c0"),
      panel("q0", 50, [0]),
      handle("k0", "column"),
      panel("q1", 50),
      {
        label: "inner",
        style: {
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          overflowX: "hidden",
          overflowY: "hidden",
        },
        children: [1, 2, 3],
      },
      panel("p0", 40),
      handle("h0", "row"),
      panel("p1", 60, [4]),
      group("row", "600px", "300px", [5, 6, 7]),
    ],
  },
  {
    name: "px 최소 걸림 — 10 (min 200px) / 90",
    availW: 600,
    availH: -1,
    nodes: [
      panel("p0", 10, [], { minWidth: "200px" }),
      handle("h0", "row"),
      panel("p1", 90),
      group("row", "600px", "200px", [0, 1, 2]),
    ],
  },
  {
    name: "% 최대 걸림 (인라인 축) — 80 (max 50%) / 20",
    availW: 600,
    availH: -1,
    nodes: [
      panel("p0", 80, [], { maxWidth: "50%" }),
      handle("h0", "row"),
      panel("p1", 20),
      group("row", "600px", "200px", [0, 1, 2]),
    ],
  },
  {
    name: "% 최소 걸림 (블록 축) — 세로 10 (min 25%) / 90",
    availW: 300,
    availH: -1,
    nodes: [
      panel("p0", 10, [], { minHeight: "25%" }),
      handle("h0", "column"),
      panel("p1", 90),
      group("column", "300px", "400px", [0, 1, 2]),
    ],
  },
  {
    name: "px 로 접힘 — 48px (grow 0 · basis 48px) / 70 / 30",
    availW: 600,
    availH: -1,
    nodes: [
      wide("c0"),
      panel("p0", 0, [0], { flexBasis: "48px" }),
      handle("h0", "row"),
      panel("p1", 70),
      handle("h1", "row"),
      panel("p2", 30),
      group("row", "600px", "200px", [1, 2, 3, 4, 5]),
    ],
  },
];

/**
 * 식이 뜻한 크기 (따로 적은 값 — 손잡이를 뺀 자리를 몫 비율로): Chrome 이 이 값을 내야 식이 맞다.
 * engine ↔ Chrome 대조만으로는 「둘이 같이 틀린」 식을 못 잡는다.
 */
const EXPECTED: Record<string, Record<string, number>> = {
  "가로 50 / 50 · 손잡이 1px · 넓은 내용": { "p0.w": 299.5, "p1.w": 299.5 },
  "세로 30 / 70 · 높은 내용": { "p0.h": 119.7, "p1.h": 279.3 },
  "3 분할 25 / (미지정 → 50) / 25 · 손잡이 8px": {
    "p0.w": 146,
    "p1.w": 292,
    "p2.w": 146,
  },
  "중첩 — 가로 40 / 60 의 뒤 Panel 안 세로 Group (100% · 100%)": {
    "p0.w": 239.6,
    "p1.w": 359.4,
    "inner.h": 300,
    "q0.h": 149.5,
  },
  "px 최소 걸림 — 10 (min 200px) / 90": { "p0.w": 200, "p1.w": 399 },
  "% 최대 걸림 (인라인 축) — 80 (max 50%) / 20": { "p0.w": 300, "p1.w": 299 },
  "% 최소 걸림 (블록 축) — 세로 10 (min 25%) / 90": {
    "p0.h": 100,
    "p1.h": 299,
  },
  "px 로 접힘 — 48px (grow 0 · basis 48px) / 70 / 30": {
    "p0.w": 48,
    "p1.w": 385,
    "p2.w": 165,
  },
};

describe("ADR-318 P1 — Resizable 크기 식 (flex 몫 + basis 0px) engine ↔ Chrome", () => {
  beforeAll(async () => {
    await initEngineWasm();
  });

  for (const c of CASES) {
    it(c.name, () => {
      expect(runParityCase(c)).toEqual([]);
    });
    it(`${c.name} — Chrome = 식이 뜻한 크기`, () => {
      const dom = domLeg(c.nodes, c.availW);
      for (const [key, want] of Object.entries(EXPECTED[c.name])) {
        const [label, field] = key.split(".") as [string, "w" | "h"];
        const at = c.nodes.findIndex((node) => node.label === label);
        expect(Math.abs(dom[at][field] - want), key).toBeLessThanOrEqual(0.5);
      }
    });
  }
});
