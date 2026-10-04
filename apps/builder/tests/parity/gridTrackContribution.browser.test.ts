import { beforeAll, describe, expect, it } from "vitest";

import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";

import {
  domLeg,
  engineLeg,
  runParityCase,
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
 * - **그리드 컨테이너 자신의 크기** — 인라인 축은 `gridContainerIntrinsic`, 블록 축은
 *   `gridContainerBlockSize` 소관이다. 여기서는 컨테이너 크기를 명시로 고정해 둔다.
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

// ── I. grid item 의 width 키워드 — stretch 는 크기가 `auto` 일 때만 (CSS-ALIGN-3 §4.1) ──
//
// flex 부모 대조군이 함께 있어야 이것이 **grid 축 하나**의 비대칭임이 보인다.
// 종전엔 명시 px 는 존중받는데 키워드만 셀 폭으로 늘어났다 (`resolve_self_size` 가
// 키워드를 길이로 못 풀어 0=미설정과 구분되지 않았다).

function itemWidthCase(
  itemWidth: string,
  cols: string[],
  display = "grid",
): ParityCase {
  const kids = [0, 1].map((i) => {
    const k = kid(i);
    return { ...k, style: { ...k.style, width: itemWidth } } as CaseNode;
  });
  const host: StyleRecord = {
    display,
    width: "300px",
    height: "100px",
    alignItems: "start",
  };
  if (display === "grid") host.gridTemplateColumns = cols;
  return {
    name: `item width:${itemWidth} in ${display} ${cols.join(" ")}`,
    availW: 400,
    availH: 600,
    nodes: [
      ...kids,
      box("host", host, [0, 1]),
      box("root", { display: "block", width: "400px", height: "600px" }, [2]),
    ],
  };
}

const ITEM_WIDTH_CASES: ParityCase[] = [
  "fit-content",
  "min-content",
  "max-content",
  "auto",
].flatMap((w) => [
  itemWidthCase(w, ["1fr", "1fr"]),
  itemWidthCase(w, ["200px", "100px"]),
  itemWidthCase(w, [], "flex"), // 대조군 — flex 는 종전에도 정합이었다
]);

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

describe("grid 트랙 content 기여 — CSS 대조 (engine leg)", () => {
  beforeAll(async () => {
    await initEngineWasm();
  });

  for (const c of [...ENGINE_CASES, ...ITEM_WIDTH_CASES, ...ROW_CASES]) {
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
