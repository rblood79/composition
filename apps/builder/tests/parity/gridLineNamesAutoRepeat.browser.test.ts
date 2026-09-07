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
 * grid 파서 — 대괄호 라인 이름 · auto-fill/auto-fit 반복 수 · auto-fit 빈 트랙 collapse
 * (upstream 대조 ⑥, 2026-09-07 — Taffy #1138 · #946 · #1035)
 *
 * - CSS-GRID-1 §7.2.1: `[name]` 은 트랙이 아니라 라인 이름이다. 종전 tokenizer 가 `[a]` 를
 *   토큰으로 남겨 `auto` 트랙으로 읽었다 (G3 — `[a] 1fr [b] 1fr [c]` 가 5 트랙, Chrome 150 / 엔진 60).
 *   `grid-column-start: b` 같은 이름 배치는 이름 → 라인 번호로 푼다.
 * - §7.2.3.2: auto-repeat 반복 수는 각 트랙을 "max 가 definite 면 max, 아니면 min" 으로 보고
 *   센다. 종전엔 minmax 의 min px 만 합산해 `minmax(auto, 200px)` 가 1 반복 (G1b — Chrome b.x 200 / 엔진 0,20).
 * - §7.2.3.2 auto-fit: 배치 뒤 빈 반복 트랙은 0 으로 collapse 하고 그 gutter 도 없어진다
 *   (G1 — `repeat(auto-fit, minmax(100px,1fr))` w600 2 item → 300/300, 종전 100/100).
 */

const n = (label: string, style: StyleRecord, children?: number[]): CaseNode =>
  ({ label, style, children }) as CaseNode;

const leaf = (label: string, extra: StyleRecord = {}): CaseNode =>
  n(label, { height: "20px", ...extra });

const grid = (
  cols: string[],
  extra: StyleRecord,
  children: number[],
): CaseNode =>
  n("root", { display: "grid", gridTemplateColumns: cols, ...extra }, children);

const LINE_NAMES: ParityCase[] = [
  {
    name: "G3 [a] 1fr [b] 1fr [c] w300 > a → 2 트랙, a w 150",
    availW: 400,
    availH: -1,
    nodes: [
      leaf("a"),
      grid(["[a]", "1fr", "[b]", "1fr", "[c]"], { width: "300px" }, [0]),
    ],
  },
  {
    name: "이름에 공백 [a b] 100px [c] 100px [d e] > a, b → 2 트랙",
    availW: 400,
    availH: -1,
    nodes: [
      leaf("a"),
      leaf("b"),
      grid(
        ["[a b]", "100px", "[c]", "100px", "[d e]"],
        { width: "400px" },
        [0, 1],
      ),
    ],
  },
  {
    name: "이름 배치 grid-column-start: b → x 100",
    availW: 400,
    availH: -1,
    nodes: [
      leaf("a", { gridColumnStart: "b" }),
      grid(["[a]", "100px", "[b]", "100px", "[c]"], { width: "400px" }, [0]),
    ],
  },
  {
    name: "이름 배치 a / c → w 200",
    availW: 400,
    availH: -1,
    nodes: [
      leaf("a", { gridColumnStart: "a", gridColumnEnd: "c" }),
      grid(["[a]", "100px", "[b]", "100px", "[c]"], { width: "400px" }, [0]),
    ],
  },
  {
    name: "행 이름 배치 grid-row-start: mid → y 30",
    availW: 400,
    availH: -1,
    nodes: [
      leaf("a", { gridRowStart: "mid" }),
      grid(["100px"], {
        width: "400px",
        gridTemplateRows: ["[top]", "30px", "[mid]", "30px", "[bot]"],
      }, [0]),
    ],
  },
  {
    name: "같은 이름 둘 — [x] 100px [x] 100px, grid-column-start: x 2 → x 100",
    availW: 400,
    availH: -1,
    nodes: [
      leaf("a", { gridColumnStart: "x 2" }),
      grid(["[x]", "100px", "[x]", "100px"], { width: "400px" }, [0]),
    ],
  },
  {
    name: "대조군 — 이름 없는 100px 100px > a, b",
    availW: 400,
    availH: -1,
    nodes: [leaf("a"), leaf("b"), grid(["100px", "100px"], { width: "400px" }, [0, 1])],
  },
];

const AUTO_REPEAT: ParityCase[] = [
  {
    name: "G1 repeat(auto-fit, minmax(100px,1fr)) w600 > a, b → 300 / 300 (빈 4 트랙 collapse)",
    availW: 600,
    availH: -1,
    nodes: [
      leaf("a"),
      leaf("b"),
      grid(["repeat(auto-fit, minmax(100px, 1fr))"], { width: "600px" }, [0, 1]),
    ],
  },
  {
    name: "auto-fit + gap 20 w600 > a, b → collapse 된 트랙의 gutter 도 없다",
    availW: 600,
    availH: -1,
    nodes: [
      leaf("a"),
      leaf("b"),
      grid(["repeat(auto-fit, minmax(100px, 1fr))"], { width: "600px", columnGap: "20px" }, [0, 1]),
    ],
  },
  {
    name: "auto-fit + 명시 배치 grid-column-start 3 w600 > a → 앞 빈 트랙 collapse, x 0",
    availW: 600,
    availH: -1,
    nodes: [
      leaf("a", { gridColumnStart: "3" }),
      grid(["repeat(auto-fit, minmax(100px, 1fr))"], { width: "600px" }, [0]),
    ],
  },
  {
    name: "auto-fit 전부 채움 w600 > 6 item → auto-fill 과 같음 (100 씩)",
    availW: 600,
    availH: -1,
    nodes: [
      leaf("a"), leaf("b"), leaf("c"), leaf("d"), leaf("e"), leaf("f"),
      grid(["repeat(auto-fit, minmax(100px, 1fr))"], { width: "600px" }, [0, 1, 2, 3, 4, 5]),
    ],
  },
  {
    name: "G1b repeat(auto-fill, minmax(auto,200px)) w600 > a, b, c → 3 반복, b.x 200",
    availW: 600,
    availH: -1,
    nodes: [
      leaf("a"),
      leaf("b"),
      leaf("c"),
      grid(["repeat(auto-fill, minmax(auto, 200px))"], { width: "600px" }, [0, 1, 2]),
    ],
  },
  {
    name: "auto-fill minmax(100px,1fr) w600 > a, b → 빈 트랙 유지, 100 / 100",
    availW: 600,
    availH: -1,
    nodes: [
      leaf("a"),
      leaf("b"),
      grid(["repeat(auto-fill, minmax(100px, 1fr))"], { width: "600px" }, [0, 1]),
    ],
  },
  {
    name: "auto-fill 150px w600 > 5 item → 4 트랙, 5번째는 2행",
    availW: 600,
    availH: -1,
    nodes: [
      leaf("a"), leaf("b"), leaf("c"), leaf("d"), leaf("e"),
      grid(["repeat(auto-fill, 150px)"], { width: "600px" }, [0, 1, 2, 3, 4]),
    ],
  },
  {
    name: "auto-fill 25% w400 > 5 item → 4 트랙 100",
    availW: 400,
    availH: -1,
    nodes: [
      leaf("a"), leaf("b"), leaf("c"), leaf("d"), leaf("e"),
      grid(["repeat(auto-fill, 25%)"], { width: "400px" }, [0, 1, 2, 3, 4]),
    ],
  },
  {
    name: "auto-fill + gap 20 minmax(100px,1fr) w600 > 2 item → 5 트랙 (100+20)",
    availW: 600,
    availH: -1,
    nodes: [
      leaf("a"),
      leaf("b"),
      grid(["repeat(auto-fill, minmax(100px, 1fr))"], { width: "600px", columnGap: "20px" }, [0, 1]),
    ],
  },
  {
    name: "auto-fill 앞뒤 고정 트랙 — 50px repeat(auto-fill, 100px) 50px w400 > 5 item → 3 반복, e 는 뒤 50px 트랙",
    availW: 400,
    availH: -1,
    nodes: [
      leaf("a"), leaf("b"), leaf("c"), leaf("d"), leaf("e"),
      grid(["50px", "repeat(auto-fill, 100px)", "50px"], { width: "400px" }, [0, 1, 2, 3, 4]),
    ],
  },
  {
    name: "행 auto-fill — rows repeat(auto-fill, 40px) h200 > a, b → b.y 40",
    availW: 400,
    availH: -1,
    nodes: [
      leaf("a"),
      leaf("b"),
      grid(["100px"], { width: "400px", height: "200px", gridTemplateRows: ["repeat(auto-fill, 40px)"] }, [0, 1]),
    ],
  },
  {
    name: "대조군 — 정수 repeat(3, 1fr) w600 > a, b → 200 / 200",
    availW: 600,
    availH: -1,
    nodes: [leaf("a"), leaf("b"), grid(["repeat(3, 1fr)"], { width: "600px" }, [0, 1])],
  },
];

const ALL = [...LINE_NAMES, ...AUTO_REPEAT];

describe("⑥ grid 라인 이름 · auto-repeat", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(ALL.map((c) => [c.name, c] as const))("engine leg — %s", (_name, c) => {
    const bad = diffCase(c.nodes, domLeg(c.nodes, c.availW), engineLeg(c.nodes, c.availW, c.availH));
    expect(bad, bad.join("\n")).toEqual([]);
  });

  it.each(ALL.map((c) => [c.name, c] as const))("pipeline leg — %s", (_name, c) => {
    const bad = diffCase(c.nodes, domLeg(c.nodes, c.availW), pipelineLeg(c.nodes, c.availW, c.availH));
    expect(bad, bad.join("\n")).toEqual([]);
  });
});
