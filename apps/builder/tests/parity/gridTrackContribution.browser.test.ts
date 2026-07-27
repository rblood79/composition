import { beforeAll, describe, expect, it } from "vitest";

import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";

import {
  domLeg,
  engineLeg,
  pipelineLeg,
  runParityCase,
  runPipelineParityCase,
  type CaseNode,
  type ParityCase,
  type StyleRecord,
} from "./harness";

/**
 * 트랙 크기는 자식의 **content 기여**에서 나온다 — CSS-GRID-1 §12.5
 *
 * `<track-size>` 는 언제나 min·max **두 개**의 sizing function 이다. 단일 값은 CSS 가
 * 펼쳐 준다: `auto` = `minmax(auto, auto)`, `1fr` = `minmax(auto, 1fr)`,
 * `min-content` = `minmax(min-content, min-content)`, `fit-content(L)` =
 * `minmax(auto, fit-content(L))`. 그리고 자리에 따라 `auto` 의 뜻이 다르다:
 *
 * | 자리 | `auto` 의 뜻                        |
 * | ---- | ----------------------------------- |
 * | min  | 자동 최소 크기 = **min-content** 기여 |
 * | max  | **max-content** 기여                |
 *
 * 종전 엔진은 이 기여를 아예 몰랐다. `tree.rs` 가 `auto` 토큰만 골라 "컨테이너 폭으로
 * solve 한 결과" 하나를 `{n}px` 로 치환했고, `min-content`/`max-content`/`fit-content()`
 * 는 grid.rs 파서에서 `auto` 로 폴백해 **1fr 근사**가 됐으며, `minmax(auto, 80px)` 의
 * base 는 0 이었다.
 *
 * ## 왜 두 값이어야 하는가 — `auto auto` 한 줄이 증명한다
 *
 * 자식 min-content 40 / max-content 120, 두 열, gap 0:
 *
 * | 컨테이너 | 트랙   | 계산                                              |
 * | -------- | ------ | ------------------------------------------------- |
 * | 150      | 75·75  | base 40 + §12.6 여유 70 을 균등(35) — 상한 미도달 |
 * | 300      | 150·150| §12.6 이 120 에서 freeze → 남은 60 을 §12.8 이 분배 |
 * | 500      | 250·250| 같은 형태, §12.8 몫이 130                          |
 *
 * 하나의 측정값(고정 px)으로는 세 점을 동시에 맞출 수 없다. base ↔ 상한 사이를 §12.6 이
 * 움직이고, 상한을 넘는 여유만 §12.8 이 가져간다.
 *
 * ## 이 파일이 잠그지 않는 것
 *
 * - **블록 축(row)의 min/max 분리** — 높이는 폭이 정해진 뒤의 내용 크기 하나라 두 값이
 *   갈리지 않는다. row 는 `(h, h)` 를 공급하므로 `auto` row 는 종전과 동일하게 측정값에
 *   고정되고, 달라지는 것은 `minmax(auto, px)` row 의 base 뿐이다 (아래 R 그룹).
 * - **grid 자식의 기여** — `measure_intrinsic_width` 가 grid 서브트리에 `None` 을 돌려
 *   "컨테이너로 solve" 근사로 떨어진다 (ADR-169 이연). 그 경우 min == max 라 종전 동작.
 * - **stretch-fit definite 판정** — `gridItemBox.browser.test.ts` 잔존 ②.
 */

const box = (
  label: string,
  style: StyleRecord,
  children?: number[],
  extra: Partial<CaseNode> = {},
): CaseNode => ({ label, style, children, ...extra }) as CaseNode;

/**
 * min-content 40 / max-content 120 인 자식.
 *
 * DOM leg 은 `fontSize:0` 컨테이너 안의 inline-block 원자 5개 — 공백 폭이 0 이라
 * min-content = max(원자) = 40, max-content = Σ원자 = 120 이 **정확 정수**다.
 * 엔진 leg 은 같은 값을 스칼라로 직접 받는다 (소비 격리).
 *
 * 폭을 명시하지 않아 자식이 트랙을 채우므로 **자식 폭 = 트랙 폭**이고, 형제의 x 가
 * 그 트랙 폭을 한 번 더 증명한다.
 */
function kid(i: number, h = 20): CaseNode {
  return box(
    `kid${i}`,
    { height: `${h}px`, contentMinWidth: 40, contentMaxWidth: 120 },
    undefined,
    { domAtoms: [40, 20, 20, 20, 20] },
  );
}

function colCase(
  cols: string[],
  containerW = 300,
  nKids = 2,
  extra: StyleRecord = {},
): ParityCase {
  const kids = Array.from({ length: nKids }, (_, i) => kid(i));
  return {
    name: `${cols.join(" ")} @${containerW}`,
    availW: 400,
    availH: 600,
    nodes: [
      ...kids,
      box(
        "grid",
        {
          display: "grid",
          width: `${containerW}px`,
          height: "100px",
          gridTemplateColumns: cols,
          ...extra,
        },
        kids.map((_, i) => i),
      ),
      box("root", { display: "block", width: "400px", height: "600px" }, [
        nKids,
      ]),
    ],
  };
}

const ENGINE_CASES: ParityCase[] = [
  // ── A. 단일 키워드 — min·max 양쪽에 같은 함수가 와 트랙이 그 크기에 고정된다 ──
  colCase(["min-content", "100px"]),
  colCase(["max-content", "100px"]),
  colCase(["auto", "100px"]),

  // ── B. fit-content(L) = clamp(min-content, L, max-content) ──
  colCase(["fit-content(60px)", "100px"]), // 40 < 60 < 120 → 60
  colCase(["fit-content(200px)", "100px"]), // 상한이 max-content 로 잘림 → 120
  colCase(["fit-content(60px)", "1fr"]), // fr 이 여유를 먹어도 60 유지

  // ── C. minmax() 조합 ──
  colCase(["minmax(auto,80px)", "100px"]), // base 40 → §12.6 → 80
  colCase(["minmax(min-content,max-content)", "100px"]),
  colCase(["minmax(max-content,1fr)", "100px"]),
  colCase(["minmax(50px,max-content)", "100px"]), // 한쪽만 content 기반
  colCase(["minmax(min-content,100px)", "100px"]),

  // ── C2. §6.6 자동 최소 크기 clamp — **`auto` min 에만** 걸린다 ──
  // "고정 max 트랙만 span 하는" 아이템의 content-based minimum 은 그 상한으로 잘린다.
  // 세 줄이 나란히 있어야 조건이 보인다: auto 만 20 이고 명시 키워드는 자기 기여 그대로.
  colCase(["minmax(auto,20px)", "100px"]), // 40 → **20** (clamp)
  colCase(["minmax(min-content,20px)", "100px"]), // 40 (clamp 없음)
  colCase(["minmax(max-content,20px)", "100px"]), // 120 (clamp 없음)
  colCase(["minmax(auto,10%)", "100px"]), // % 도 고정 → 30 (=10%×300)
  colCase(["minmax(auto,1fr)", "100px"]), // fr 은 고정 아님 → clamp 없음
  colCase(["fit-content(20px)", "100px"]), // fit-content 도 고정 아님 → 40

  // ── D. fr 이웃 — fr 이 여유를 흡수해 content 트랙은 기여값에 머문다 ──
  colCase(["auto", "1fr"]),
  colCase(["min-content", "1fr"]),
  colCase(["max-content", "1fr"]),

  // ── E. 여유의 세 구간 (헤더 표) — 한 측정값으로는 못 맞추는 지점 ──
  colCase(["auto", "auto"], 150), // §12.6 균등, 상한 미도달
  colCase(["auto", "auto"], 300), // §12.6 freeze 후 §12.8
  colCase(["auto", "auto"], 500),
  colCase(["max-content", "max-content"], 150), // 넘쳐도 트랙은 그대로 (자르지 않는다)
  colCase(["min-content", "min-content"], 500), // max sizing 이 auto 가 아니라 stretch 없음

  // ── F. §12.8 게이트 — content-distribution 이 stretch 를 막아도 §12.6 은 돈다 ──
  ...["start", "center", "end", "space-between"].map((jc) =>
    colCase(["auto", "auto"], 300, 2, { justifyContent: jc }),
  ),

  // ── G. gap 은 여유에서 먼저 빠진다 ──
  colCase(["auto", "auto"], 300, 2, { columnGap: "40px" }),
  colCase(["fit-content(60px)", "auto"], 300, 2, { columnGap: "20px" }),

  // ── H. 열 기여 = 그 열 자식들의 최댓값 (3자식 2열) ──
  colCase(["max-content", "100px"], 300, 3),
  colCase(["auto", "auto"], 300, 4),
];

// ── R. row 축 — `(h, h)` 공급이라 달라지는 것은 minmax base 뿐 ──

function rowCase(rows: string[], containerH: number, kidHeights: number[]) {
  const kids = kidHeights.map((h, i) => kid(i, h));
  return {
    name: `rows ${rows.join(" ")} @${containerH}`,
    availW: 400,
    availH: 600,
    nodes: [
      ...kids,
      box(
        "grid",
        {
          display: "grid",
          width: "300px",
          height: `${containerH}px`,
          gridTemplateColumns: ["1fr"],
          gridTemplateRows: rows,
        },
        kids.map((_, i) => i),
      ),
      box("root", { display: "block", width: "400px", height: "600px" }, [
        kids.length,
      ]),
    ],
  } satisfies ParityCase;
}

const ROW_CASES: ParityCase[] = [
  // base 가 0 이던 자리 — 자식 60 이 상한 40 을 밀어 올린다 (§12.4).
  rowCase(["minmax(auto,40px)", "auto"], 300, [60, 20]),
  // 상한이 base 보다 크면 §12.6 이 상한까지 키운다.
  rowCase(["minmax(auto,90px)", "auto"], 300, [60, 20]),
  rowCase(["min-content", "auto"], 300, [60, 20]),
  rowCase(["max-content", "auto"], 300, [60, 20]),
  rowCase(["fit-content(50px)", "auto"], 300, [60, 20]),
  // 종전 동작 보존 — `auto` row 는 측정값 고정 + §12.8 stretch.
  rowCase(["auto", "auto"], 300, [60, 20]),
  rowCase(["auto", "100px"], 300, [60, 20]),
];

// ── P. pipeline leg — 실 텍스트로 공급 체인 end-to-end ──
//
// 원자는 pipeline elementsMap 에 없으므로 여기서는 `Text` leaf 를 쓴다.
// `alignItems:"start"` 로 두는 이유: 기본 stretch 면 DOM 텍스트가 행 높이(100)로 늘고
// pipeline 은 주입된 lineHeight(20)를 유지해 **높이 축**이 함께 어긋난다 — 이 파일이
// 보려는 것은 인라인 축의 기여 공급이라 세로 축을 비교에서 뺀다
// (`intrinsicSizing.browser.test.ts` 의 `alignItems:"flex-start"` 와 같은 이유).

const TEXT_STYLE = {
  width: "auto",
  fontSize: 16,
  fontFamily: "Arial",
  fontWeight: 400,
  lineHeight: "20px",
} as const;

function textColCase(name: string, cols: string[], containerW: number) {
  return {
    name,
    availW: 400,
    availH: 600,
    nodes: [
      box("txt", { ...TEXT_STYLE }, undefined, {
        elementType: "Text",
        text: "Hello World",
      }),
      box("pad", { width: "60px", height: "20px" }),
      box(
        "grid",
        {
          display: "grid",
          width: `${containerW}px`,
          height: "100px",
          alignItems: "start",
          gridTemplateColumns: cols,
        },
        [0, 1],
      ),
      box("root", { display: "block", width: "400px", height: "600px" }, [2]),
    ],
  } satisfies ParityCase;
}

/** 트랙이 content 와 무관한 대조군 — 텍스트 측정 없이도 자리가 정해진다. */
const PIPELINE_CASES: ParityCase[] = [
  textColCase("pipeline: 1fr 트랙 (content 무관)", ["1fr", "1fr"], 300),
  textColCase("pipeline: px 트랙 (content 무관)", ["100px", "1fr"], 300),
];

describe("grid 트랙 content 기여 — CSS 대조 (engine leg)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  for (const c of [...ENGINE_CASES, ...ROW_CASES]) {
    it(c.name, () => {
      const bad = runParityCase(c);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }

  it("규칙 요약 — 자리에 따라 `auto` 의 뜻이 다르다", () => {
    // min 자리의 auto = min-content(40) / max 자리의 auto = max-content(120).
    // `minmax(auto, auto)` 를 편 것이 바로 `auto` 이므로 셋의 트랙 폭이 같아야 한다.
    const w = (cols: string[]) =>
      engineLeg(colCase(cols, 300).nodes, 400, 600)[1].x;
    expect(w(["auto", "100px"])).toBe(w(["minmax(auto,auto)", "100px"]));
    expect(w(["minmax(min-content,max-content)", "100px"])).toBe(120);
    // 반대로 뒤집으면 min-content 에 고정 — 상한이 base 를 넘지 못한다(§12.4 역방향 없음).
    expect(w(["minmax(max-content,min-content)", "100px"])).toBe(120);
  });

  it("§12.8 은 max sizing 이 `auto` 인 트랙만 — fit-content/min-content 는 제외", () => {
    const track0 = (cols: string[]) =>
      engineLeg(colCase(cols, 300).nodes, 400, 600)[1].x;
    // auto 는 남은 여유를 받아 200, fit-content(60)/min-content 는 제자리.
    expect(track0(["auto", "100px"])).toBe(200);
    expect(track0(["fit-content(60px)", "100px"])).toBe(60);
    expect(track0(["min-content", "100px"])).toBe(40);
    // DOM 도 같은 판정인지 함께 잠근다.
    const dom0 = (cols: string[]) => domLeg(colCase(cols, 300).nodes, 400)[1].x;
    expect(dom0(["auto", "100px"])).toBe(200);
    expect(dom0(["fit-content(60px)", "100px"])).toBe(60);
    expect(dom0(["min-content", "100px"])).toBe(40);
  });
});

describe("grid 트랙 content 기여 — end-to-end (pipeline leg)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  for (const c of PIPELINE_CASES) {
    it(c.name, () => {
      const bad = runPipelineParityCase(c);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }

  /**
   * 잔존 — content 기반 트랙 안의 **텍스트 leaf** 가 폭 0 으로 무너진다.
   *
   * 엔진은 기여를 소비할 준비가 됐지만(위 engine 그룹 전부 green), TS 층이 그 기여를
   * **공급하지 않는다**: `enrichWithIntrinsicSize` 의 측정 스칼라 주입 조건이
   * `isFlexChild && TEXT_LEAF_TAGS.has(type)` 라 grid 자식은 빠진다. 스칼라가 없으면
   * 엔진은 텍스트 크기를 알 길이 없어 `width:auto` leaf 가 0 이 된다.
   *
   * 트랙이 content 와 무관하면(`1fr`/`px`, 위 대조군) 자식이 트랙으로 stretch 되어
   * 우연히 맞는다 — 그래서 이 결함이 `auto`/`min-content`/`max-content` 트랙에서만
   * 드러난다. 본 변경(엔진) 이전에도 동일했다 (baseline 실측 확인).
   */
  it("잔존 — content 트랙 안 텍스트 leaf 가 pipeline 에서 0 (실측 스냅샷)", () => {
    for (const cols of [
      ["auto", "1fr"],
      ["min-content", "1fr"],
      ["max-content", "1fr"],
    ]) {
      const c = textColCase(`residual ${cols[0]}`, cols, 300);
      expect(domLeg(c.nodes, c.availW)[0].w).toBeGreaterThan(0);
      expect(pipelineLeg(c.nodes, c.availW, c.availH)[0].w).toBe(0);
    }
  });
});
