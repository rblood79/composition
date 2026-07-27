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
 * `minmax()` 트랙은 상한까지 자란다 — CSS-GRID-1 §12.6 "Maximize Tracks"
 *
 * 트랙 sizing 은 base size 에서 끝나지 않는다. 남는 공간이 있으면 각 트랙의 base 를
 * **growth limit 까지** 키우고(§12.6), 그 다음에 `fr` 을 분배하고(§12.7), 마지막으로
 * `auto` 트랙을 stretch 한다(§12.8 — `gridAutoTrackStretch.browser.test.ts`).
 *
 * 종전 엔진은 §12.6 이 통째로 없었다. `minmax(_, px)` 트랙이 base(=min)에 머물러
 * `minmax(50px,80px)` 이 50 으로 굳었고, fr 이 함께 있을 때만 우연히 상한에 닿았다.
 * 부작용으로 `fr` 분배가 minmax 의 성장분을 빼지 않아 **트랙 합이 컨테이너를 넘기도**
 * 했다 (`minmax(100px,150px) 1fr` / 400 → 150+300 = 450).
 *
 * 세 규칙이 서로 다르니 한 줄로 요약하면 틀린다:
 *
 * | 단계  | 대상                   | content-distribution 게이트 |
 * | ----- | ---------------------- | --------------------------- |
 * | §12.6 | `minmax(_, px)`        | **없음** — 항상 돈다        |
 * | §12.7 | `fr`                   | 없음                        |
 * | §12.8 | max sizing 이 `auto`   | `normal`/`stretch` 에서만   |
 *
 * 분배는 균등이고 상한에 닿은 트랙은 freeze 한 뒤 남은 몫을 나머지에 재분배한다.
 * 전원이 상한에 닿으면 남는 공간은 **그대로 남는다**(§12.8 대상이 없으면 미분배).
 */

const box = (
  label: string,
  style: StyleRecord,
  children?: number[],
): CaseNode => ({ label, style, children }) as CaseNode;

/**
 * 컨테이너 폭 300. 자식은 10px 로 작게 둬 **트랙이 내용이 아니라 규칙으로** 정해지게 하고,
 * 트랙 폭은 형제의 x 좌표로 읽는다 (자식 폭 ≠ 트랙 폭 — CSS-GRID §10.1).
 */
function gridCase(
  name: string,
  cols: string[],
  kidWidths: number[] = cols.map(() => 10),
  extra: StyleRecord = {},
): ParityCase {
  const kids = kidWidths.map(
    (w) => ({ width: `${w}px`, height: "40px" }) as StyleRecord,
  );
  return {
    name,
    availW: 400,
    availH: 600,
    nodes: [
      ...kids.map((s, i) => box(`c${i}`, s)),
      box(
        "grid",
        {
          display: "grid",
          width: "300px",
          height: "100px",
          gridTemplateColumns: cols,
          ...extra,
        },
        kids.map((_, i) => i),
      ),
      box("root", { display: "block", width: "400px", height: "600px" }, [
        kids.length,
      ]),
    ],
  };
}

const CASES: ParityCase[] = [
  // ── 1. 상한까지 성장 — 이웃 트랙 종류와 무관 ──
  gridCase("minmax(50,80) + auto", ["minmax(50px,80px)", "auto"]),
  gridCase("minmax(50,80) + px", ["minmax(50px,80px)", "100px"]),
  gridCase("minmax(50,80) + fr", ["minmax(50px,80px)", "1fr"]),
  gridCase("minmax(50,80) + %", ["minmax(50px,80px)", "30%"]),
  gridCase("minmax(50,80) ×2", ["minmax(50px,80px)", "minmax(50px,80px)"]),

  // ── 2. 상한은 내용보다 우선 — 넘쳐도 트랙은 상한에서 멈춘다 ──
  gridCase("내용 70 (min 초과)", ["minmax(50px,80px)", "auto"], [70, 10]),
  gridCase("내용 200 (상한 초과)", ["minmax(50px,80px)", "auto"], [200, 10]),

  // ── 3. 균등 분배 + freeze + 재분배 ──
  gridCase("여유 충분 — 균등 150·150", [
    "minmax(0px,200px)",
    "minmax(0px,200px)",
  ]),
  gridCase("한쪽 freeze → 남은 몫 재분배", [
    "minmax(0px,200px)",
    "minmax(0px,50px)",
  ]),
  gridCase("3트랙 — 둘이 상한 도달", [
    "minmax(0px,100px)",
    "minmax(0px,100px)",
    "minmax(0px,300px)",
  ]),
  gridCase("전원 상한 도달 → 남는 공간 미분배", [
    "minmax(0px,60px)",
    "minmax(0px,60px)",
  ]),

  // ── 4. §12.6 → §12.8 순서 (minmax 가 먼저 먹고 auto 가 나머지) ──
  gridCase("minmax 먼저, auto 가 나머지", ["minmax(100px,200px)", "auto"]),
  gridCase("auto 가 앞이어도 순서 동일", ["auto", "minmax(0px,200px)"]),

  // ── 5. gap 은 여유에서 먼저 빠진다 ──
  gridCase("gap 20", ["minmax(50px,80px)", "100px"], [10, 10], {
    columnGap: "20px",
  }),
  gridCase(
    "gap 40 + 균등",
    ["minmax(0px,200px)", "minmax(0px,200px)"],
    [10, 10],
    { columnGap: "40px" },
  ),

  // ── 6. §12.6 은 content-distribution 게이트가 없다 (§12.8 과 다른 점) ──
  ...["start", "center", "end", "space-between"].map((jc) =>
    gridCase(
      `jc="${jc}" 여도 상한까지 성장`,
      ["minmax(50px,80px)", "100px"],
      [10, 10],
      { justifyContent: jc },
    ),
  ),

  // ── 7. minmax 의 min/max 가 content 키워드 ──
  gridCase("minmax(50px, auto)", ["minmax(50px,auto)", "100px"]),
  gridCase("minmax(auto, 80px)", ["minmax(auto,80px)", "100px"]),
  gridCase("minmax(auto, auto)", ["minmax(auto,auto)", "100px"]),

  // ── 8. 세로축도 같은 규칙 ──
  {
    name: "rows minmax(50,80) auto / height 300",
    availW: 400,
    availH: 600,
    nodes: [
      box("c0", { height: "10px" }),
      box("c1", { height: "10px" }),
      box(
        "grid",
        {
          display: "grid",
          width: "300px",
          height: "300px",
          gridTemplateColumns: ["1fr"],
          gridTemplateRows: ["minmax(50px,80px)", "auto"],
        },
        [0, 1],
      ),
      box("root", { display: "block", width: "400px", height: "600px" }, [2]),
    ],
  },
];

describe("grid minmax 트랙 — CSS 대조", () => {
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

  it("트랙 합이 컨테이너를 넘지 않는다 — 구 fr 분배 회귀 감시", () => {
    // `minmax(100px,150px) 1fr` / 400 에서 구 엔진은 minmax 를 150 으로 키우면서도
    // fr 에는 base(100)를 뺀 300 을 줘 합이 450 이 됐다. 이 케이스는 그 산술을 잠근다.
    const c = gridCase(
      "minmax(100,150) 1fr / 400",
      ["minmax(100px,150px)", "1fr"],
      [10, 10],
      { width: "400px" },
    );
    const dom = domLeg(c.nodes, c.availW);
    const eng = engineLeg(c.nodes, c.availW, c.availH);
    expect(dom[1].x).toBe(150); // 트랙0 = 상한 150
    expect(eng[1].x).toBe(150);
    // 트랙1 = 400 − 150 = 250 → 두 번째 자식의 우변이 컨테이너를 넘지 않는다
    expect(eng[2].w).toBe(400);
  });

  /**
   * 잔존 — 트랙의 **content 기여**가 측정되지 않는다.
   *
   * `minmax(auto, 80px)` 의 base 는 그 트랙 아이템들의 min-content 인데, 엔진은 grid.rs
   * 에서 0 으로 둔다. 내용이 상한보다 작으면 §12.6 이 상한까지 키워 결과가 우연히 맞고
   * (위 케이스 7), 내용이 상한을 넘으면 어긋난다 — CSS 는 base 가 growth limit 를
   * 밀어올린다.
   *
   * 같은 뿌리로 `min-content`/`max-content`/`fit-content()` 트랙 키워드도 미지원이다
   * (전부 `auto` 로 폴백). 셋 다 **트랙별 content 기여 산출**을 요구하며, 그것이
   * ADR-169 가 이연한 grid intrinsic 축의 재개 조건이다.
   */
  it("잔존 — 트랙 content 기여 미측정 (실측 스냅샷)", () => {
    const over = gridCase(
      "minmax(auto,80px) — 내용 120",
      ["minmax(auto,80px)", "auto"],
      [120, 10],
    );
    expect(domLeg(over.nodes, 400)[1].x).toBe(120); // base=min-content 120 이 상한을 밀어올림
    expect(engineLeg(over.nodes, 400, 600)[1].x).toBe(80); // 엔진: base 0 → 상한 80 에서 멈춤

    const minC = gridCase("min-content 트랙", ["min-content", "auto"]);
    expect(domLeg(minC.nodes, 400)[1].x).toBe(10); // 내용 크기 10
    expect(engineLeg(minC.nodes, 400, 600)[1].x).toBe(290); // 엔진: auto 폴백 → 1fr 근사

    const maxC = gridCase("max-content 트랙", ["max-content", "100px"]);
    expect(domLeg(maxC.nodes, 400)[1].x).toBe(10);
    expect(engineLeg(maxC.nodes, 400, 600)[1].x).toBe(200);
  });
});
