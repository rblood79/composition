import { beforeAll, describe, expect, it } from "vitest";

import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";

import {
  domLeg,
  engineLeg,
  runParityCase,
  runPipelineParityCase,
  type CaseNode,
  type ParityCase,
  type StyleRecord,
} from "./harness";

/**
 * 그리드 자신의 min/max-content 크기 — CSS-GRID-1 §12.5 + §12.6 + §12.7.1
 *
 * 인라인 축이 미결정이면 **나눠 줄 여유가 없다**. 세 진입이 같은 상태다:
 *
 * | 진입                       | 예                                    |
 * | -------------------------- | ------------------------------------- |
 * | 측정 모드 센티넬           | flex item 의 shrink-to-fit base size  |
 * | `width` 가 intrinsic 키워드 | `width: max-content` 인 그리드        |
 * | 상속 available 이 indefinite | 미결정 폭 컨테이너 안의 그리드       |
 *
 * 이 상태에서 종전 엔진은 `resolve_grid_tracks` 2단계의
 * `remaining = (container - fixed - gap).max(0.0)` 이 음수 available 에서 0 을 내
 * **fr·auto 트랙을 통째로 붕괴**시켰다. 그래서 ADR-169 는 grid 서브트리를 측정에서
 * 아예 제외했고(`subtree_has_grid` 가드), 그 이연이 `containerIntrinsic` I/J 스냅샷
 * (DOM 400 / 엔진 1920)으로 고정돼 있었다.
 *
 * ## 트랙별 규칙 (자식 min 40 / max 120 기준 실측으로 확정)
 *
 * | 트랙          | min-content 모드 | max-content 모드                 |
 * | ------------- | ---------------- | -------------------------------- |
 * | `px`          | 그 값            | 그 값                            |
 * | `%`           | min-content 기여 | max-content 기여 (auto 와 동형)  |
 * | `auto`        | min-content 기여 | max-content 기여                 |
 * | `min-content` | min-content      | min-content                      |
 * | `max-content` | max-content      | max-content                      |
 * | `fit-content(L)` | min-content   | clamp(min, L, max)               |
 * | `minmax(a,b)` | a 의 base        | b 의 상한 (b 가 fr 이면 §12.7.1) |
 * | `fr`          | min-content 기여 | flex factor × used fraction      |
 *
 * 두 가지가 직관과 어긋나므로 케이스로 못 박는다:
 * - **`%` 는 `auto` 처럼 동작한다** — 백분율의 기준이 지금 구하려는 바로 그 크기다.
 * - **min-content 모드에서 `fr` 은 펴지 않는다** — base 그대로다.
 */

const box = (
  label: string,
  style: StyleRecord,
  children?: number[],
  extra: Partial<CaseNode> = {},
): CaseNode => ({ label, style, children, ...extra }) as CaseNode;

/** DOM 은 fontSize:0 원자, 엔진은 대응 스칼라 — min = max(원자), max = Σ원자. */
function kid(i: number, atoms: number[]): CaseNode {
  return box(
    `k${i}`,
    {
      height: "20px",
      contentMinWidth: Math.max(...atoms),
      contentMaxWidth: atoms.reduce((a, b) => a + b, 0),
    },
    undefined,
    { domAtoms: atoms },
  );
}

const A = [40, 20, 20, 20, 20]; // min 40 / max 120
const B = [30, 30]; // min 30 / max 60

/** 그리드 자신에게 intrinsic 폭 키워드를 걸고 그 폭을 읽는다. */
function keywordCase(
  cols: string[],
  gridWidth: string,
  kidAtoms: number[][] = [A, B],
  extra: StyleRecord = {},
): ParityCase {
  const kids = kidAtoms.map((a, i) => kid(i, a));
  return {
    name: `width:${gridWidth} / ${cols.join(" ")}${
      Object.keys(extra).length ? ` (${JSON.stringify(extra)})` : ""
    }${kidAtoms.length !== 2 ? ` [${kidAtoms.length} kid]` : ""}`,
    availW: 600,
    availH: 600,
    nodes: [
      ...kids,
      box(
        "g",
        {
          display: "grid",
          width: gridWidth,
          gridTemplateColumns: cols,
          alignItems: "start",
          ...extra,
        },
        kids.map((_, i) => i),
      ),
      box("root", { display: "block", width: "600px", height: "600px" }, [
        kids.length,
      ]),
    ],
  };
}

/** flex row 안의 그리드 — shrink-to-fit(측정 센티넬) 경로. */
function flexItemCase(
  cols: string[],
  kidAtoms: number[][] = [A, B],
): ParityCase {
  const kids = kidAtoms.map((a, i) => kid(i, a));
  const n = kids.length;
  return {
    name: `flex item / ${cols.join(" ")}`,
    availW: 600,
    availH: 600,
    nodes: [
      ...kids,
      box(
        "g",
        { display: "grid", gridTemplateColumns: cols, alignItems: "start" },
        kids.map((_, i) => i),
      ),
      box(
        "flex",
        {
          display: "flex",
          flexDirection: "row",
          width: "600px",
          alignItems: "start",
        },
        [n],
      ),
      box("root", { display: "block", width: "600px", height: "600px" }, [
        n + 1,
      ]),
    ],
  };
}

const TEMPLATES: string[][] = [
  ["100px", "100px"],
  ["1fr", "1fr"],
  ["auto", "auto"],
  ["2fr", "1fr"],
  ["3fr", "1fr"],
  ["0.5fr", "0.5fr"], // flex factor < 1 — Σ가 1 미만이면 1 로 본다
  ["auto", "1fr"],
  ["minmax(50px,1fr)", "auto"],
  ["minmax(100px,200px)", "auto"],
  ["min-content", "max-content"],
  ["fit-content(70px)", "auto"],
];

const KEYWORD_CASES: ParityCase[] = [
  "max-content",
  "min-content",
  "fit-content",
]
  .flatMap((w) => TEMPLATES.map((cols) => keywordCase(cols, w)))
  .concat([
    // gap 은 트랙 합에 더해진다.
    keywordCase(["auto", "auto"], "max-content", [A, B], { columnGap: "20px" }),
    keywordCase(["1fr", "1fr"], "max-content", [A, B], { columnGap: "20px" }),
    keywordCase(["auto", "auto"], "min-content", [A, B], { columnGap: "20px" }),
    keywordCase(["1fr", "1fr"], "min-content", [A, B], { columnGap: "20px" }),
    // **빈 트랙도 자리를 차지한다** — 셀 bounding box 가 아니라 트랙 extent 다.
    keywordCase(["1fr", "1fr"], "max-content", [A]),
    keywordCase(["100px", "100px"], "max-content", [A]),
    keywordCase(["1fr", "1fr", "1fr"], "max-content", [A, B]),
    keywordCase(["1fr", "1fr"], "min-content", [A]),
    keywordCase(["100px", "100px"], "min-content", [A]),
    // 한 트랙에 아이템 둘 — 기여는 그 트랙 아이템들의 최댓값.
    keywordCase(["1fr"], "max-content", [A, B]),
    keywordCase(["1fr"], "min-content", [A, B]),
    // 자식 없음.
    keywordCase(["auto", "auto"], "max-content", []),
    keywordCase(["auto", "auto"], "min-content", []),
  ]);

const FLEX_ITEM_CASES: ParityCase[] = TEMPLATES.map((cols) =>
  flexItemCase(cols),
);

describe("그리드 컨테이너 intrinsic — CSS 대조 (engine leg)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  for (const c of [...KEYWORD_CASES, ...FLEX_ITEM_CASES]) {
    it(c.name, () => {
      const bad = runParityCase(c);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }

  it("§12.7.1 — fr 은 used flex fraction 으로 편다", () => {
    // 기여 A=120 / B=60. uff = max(기여 ÷ Σfactor) 이고 factor 합이 1 미만이면 1 로 본다.
    const w = (cols: string[]) =>
      engineLeg(keywordCase(cols, "max-content").nodes, 600, 600)[2].w;
    expect(w(["1fr", "1fr"])).toBe(240); // uff 120 → 120·120
    expect(w(["2fr", "1fr"])).toBe(180); // uff max(120/2, 60/1)=60 → 120·60
    expect(w(["3fr", "1fr"])).toBe(240); // uff max(40, 60)=60 → 180·60
    expect(w(["0.5fr", "0.5fr"])).toBe(120); // Σfactor<1 → 1 로 → uff 120 → 60·60
    // min-content 모드에서는 펴지 않는다 — base(=min-content 기여) 합.
    const m = (cols: string[]) =>
      engineLeg(keywordCase(cols, "min-content").nodes, 600, 600)[2].w;
    expect(m(["1fr", "1fr"])).toBe(70);
    expect(m(["3fr", "1fr"])).toBe(70);
    // DOM 도 같은 값인지 함께 잠근다 (엔진 자기 참조 방지).
    const d = (cols: string[], kw: string) =>
      domLeg(keywordCase(cols, kw).nodes, 600)[2].w;
    expect(d(["3fr", "1fr"], "max-content")).toBe(240);
    expect(d(["3fr", "1fr"], "min-content")).toBe(70);
    expect(d(["0.5fr", "0.5fr"], "max-content")).toBe(120);
  });

  it("`%` 트랙은 **컨테이너 크기 산출**에서 `auto` 처럼 동작한다", () => {
    // 백분율의 기준이 지금 구하려는 크기 자신이라 기여 단계에서는 해소할 수 없다.
    // 컨테이너 폭은 그래서 `auto auto` 와 같다 — DOM·엔진 양쪽에서.
    for (const kw of ["max-content", "min-content"]) {
      const pct = keywordCase(["50%", "auto"], kw);
      const auto = keywordCase(["auto", "auto"], kw);
      expect(engineLeg(pct.nodes, 600, 600)[2].w).toBe(
        engineLeg(auto.nodes, 600, 600)[2].w,
      );
      expect(domLeg(pct.nodes, 600)[2].w).toBe(domLeg(auto.nodes, 600)[2].w);
    }
  });

  /**
   * 잔존 — `%` 트랙의 **내부 배분**이 최종 컨테이너 기준으로 재해소되지 않는다.
   *
   * 컨테이너 크기는 맞다(위 케이스). 다만 CSS 는 크기가 정해진 뒤 `%` 를 그 크기에
   * 대해 다시 풀고 남은 공간을 다른 트랙에 준다 — `50% auto` / max-content 는 컨테이너
   * 180 에서 90·90 이 된다. 엔진은 기여 단계의 값(120·60)을 그대로 얼린다.
   *
   * **`fr` 은 얼리는 것이 맞다** — `1fr 1fr` / min-content 가 35·35 가 아니라 40·30 인
   * 것이 그 근거다(CSS-GRID-1 §12.7.1 의 "base 를 밑도는 fr 은 inflexible 로 재시작"
   * 조항과 같은 결과). 그래서 이 잔존은 `%` 축 하나이며, 고치려면 컨테이너 확정 후
   * 트랙 sizing 을 한 번 더 도는 2-pass 가 필요하다.
   *
   * 라이브 영향 없음 — catalog·앱 소스에 `%` grid 트랙 사용 0건.
   */
  it("잔존 — `%` 트랙 내부 배분 (실측 스냅샷)", () => {
    const t0 = (kw: string, cols: string[]) => {
      const c = keywordCase(cols, kw);
      return {
        dom: domLeg(c.nodes, 600)[1].x,
        eng: engineLeg(c.nodes, 600, 600)[1].x,
      };
    };
    expect(t0("max-content", ["50%", "auto"])).toEqual({ dom: 90, eng: 120 });
    expect(t0("min-content", ["50%", "auto"])).toEqual({ dom: 35, eng: 40 });
    expect(t0("max-content", ["30%", "70%"])).toEqual({ dom: 54, eng: 120 });
    // 대조 — fr 은 얼리는 것이 정답이라 정합이다.
    expect(t0("min-content", ["1fr", "1fr"])).toEqual({ dom: 40, eng: 40 });
    expect(t0("max-content", ["2fr", "1fr"])).toEqual({ dom: 120, eng: 120 });
  });
});

describe("그리드 컨테이너 intrinsic — end-to-end (pipeline leg)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  // 원자는 pipeline elementsMap 에 없으므로 **명시 폭 자식**으로 같은 구조를 돌린다 —
  // 기여 공급 경로가 아니라 트랙 산출이 Skia 좌표까지 도달하는지가 목적.
  const fixedKid = (i: number, w: number) =>
    box(`f${i}`, { width: `${w}px`, height: "20px" });

  const pipeCase = (cols: string[], gridWidth: string): ParityCase => ({
    name: `pipeline: width:${gridWidth} / ${cols.join(" ")}`,
    availW: 600,
    availH: 600,
    nodes: [
      fixedKid(0, 120),
      fixedKid(1, 60),
      box(
        "g",
        {
          display: "grid",
          width: gridWidth,
          gridTemplateColumns: cols,
          alignItems: "start",
        },
        [0, 1],
      ),
      box("root", { display: "block", width: "600px", height: "600px" }, [2]),
    ],
  });

  for (const c of [
    pipeCase(["auto", "auto"], "max-content"),
    pipeCase(["1fr", "1fr"], "max-content"),
    pipeCase(["2fr", "1fr"], "max-content"),
    pipeCase(["100px", "100px"], "max-content"),
    pipeCase(["auto", "auto"], "min-content"),
    pipeCase(["1fr", "1fr"], "min-content"),
  ]) {
    it(c.name, () => {
      const bad = runPipelineParityCase(c);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
});
