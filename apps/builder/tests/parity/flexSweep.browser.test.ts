import { beforeAll, describe, expect, it } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import {
  type CaseNode,
  type ParityCase,
  type StyleRecord,
  runParityCase,
} from "./harness";

/**
 * ADR-156 Phase 1 — §1-2 flex 파라메트릭 sweep (G1)
 *
 * breakdown §1-2 의 "정합 확인 영역" 672 조합(교차축 384 + main 축 288)에서 출발해, 2026-07-27
 * 에 **음수 free space**(내용이 컨테이너를 넘김) 조합을 더해 1152 조합(576 + 576)이 됐다.
 * 전부 **소비 O 필드**(§1-3)만 사용 — align_self(E1)/justify_items(E2)/grid_auto_*(E14)
 * 등 미소비 9필드는 이 sweep 대상 아님(그 발산은 Phase 2~5). 따라서 정합(전부 통과)이
 * 기대값이며, 실패 시 (a) 하니스 구성 오류(§1-4 계약) 또는 (b) 미기록 발산이다.
 *
 * ## 음수 free space 조합의 민감도 (2026-07-27 실측)
 *
 * 종전 sweep 은 양수 여유만 훑어 정렬 결함 3건을 전부 놓쳤다. 확장분이 실제로 그 경로를
 * 훑는지 엔진을 되돌려 확인한 값 — 인위적 조합이 아니라는 근거이자, 이 축을 지웠을 때
 * 잃는 커버리지의 크기다:
 *
 * | 되돌린 수정                              | 교차축     | main 축   |
 * | ---------------------------------------- | ---------- | --------- |
 * | 라인 cross 승격 `max` → 대입 (§9.4 step 8) | 48/576 red | —         |
 * | 정렬 여유 `.max(0.0)` 클램프 (3축)         | 80/576 red | 32/576 red |
 *
 * §1-4 계약 준수: gap=longhand(rowGap/columnGap), flexGrow/Shrink=숫자, display:none 제외.
 */

const DIRECTIONS = ["row", "column"] as const;
const WRAPS = ["nowrap", "wrap"] as const;
// flex align-items 4종 (align_self 는 미소비=E1 이라 sweep 제외; 이건 컨테이너 축).
const ALIGN_ITEMS = ["flex-start", "flex-end", "center", "stretch"] as const;
const ALIGN_CONTENT = [
  "flex-start",
  "flex-end",
  "center",
  "stretch",
  "space-between",
  "space-around",
] as const;
// definite-overflow = 내용이 컨테이너 cross 를 넘겨 **음수 free space** 가 되는 확정 크기.
// 정렬 규칙이 양수 여유와 갈리는 영역이라(위치 정렬은 음수 offset, 분배·stretch 는
// fallback) 별도 값으로 훑는다. `auto` 는 컨테이너가 내용으로 자라 음수가 성립하지 않으므로
// 대응 변형이 없다 — 그래서 직교 차원이 아니라 CROSS_SIZE 의 세 번째 값이다.
const CROSS_SIZE = ["definite", "definite-overflow", "auto"] as const;
const LINE_COUNTS = [1, 2] as const;

const JUSTIFY = [
  "flex-start",
  "flex-end",
  "center",
  "space-between",
  "space-around",
  "space-evenly",
] as const;
const GAPS = [0, 12] as const;
const GROWS = [0, 1] as const;
const SHRINKS = [0, 1] as const;
const BASES = ["auto", "0px", "50px"] as const;
// main 축 여유 부호. negative 는 자식 합이 컨테이너를 넘기는 크기 — 단 `shrink=1` 조합은
// 자식이 줄어들어 실제로는 여유 0 이 된다(그 자체가 shrink 계약 검증이라 유지).
const MAIN_SPACE = ["positive", "negative"] as const;

// 테스트 대상 flex 컨테이너를 definite root 아래로 중첩시킨다.
// **Why**: 컨테이너를 root 로 두면 `compute_layout(root, w, -1)` 의 root 자기 크기
// 경로(E5)에 걸려 무폭(auto) 컨테이너가 CSS(부모 채움) 대신 shrink-to-fit 된다.
// §1-2 는 "정합 확인 영역"(root 만 결함, 중첩은 통과 — NST 행)이므로 중첩이 정본.
function nestUnderRoot(
  container: StyleRecord,
  children: CaseNode[],
  name: string,
): ParityCase {
  return {
    name,
    availW: 200,
    availH: -1,
    nodes: [
      ...children,
      { label: "flex", style: container, children: [0, 1, 2] },
      {
        label: "root",
        style: { display: "block", width: "200px", height: "500px" },
        children: [3],
      },
    ],
  };
}

// ── 교차축 케이스 (direction × wrap × alignItems × alignContent × crossSize × lines) ──
function crossAxisCase(
  dir: (typeof DIRECTIONS)[number],
  wrap: (typeof WRAPS)[number],
  ai: (typeof ALIGN_ITEMS)[number],
  ac: (typeof ALIGN_CONTENT)[number],
  crossSize: (typeof CROSS_SIZE)[number],
  lines: (typeof LINE_COUNTS)[number],
): ParityCase {
  const isRow = dir === "row";
  const mainProp = isRow ? "width" : "height";
  const crossProp = isRow ? "height" : "width";
  // 컨테이너 main 은 wrap 이 동작하려면 definite 여야 한다.
  const containerMain = isRow ? 200 : 100;
  // lines=2 는 3자식이 2줄로 나뉘도록 main 크기를 키운다(2 fit, 3 overflow).
  const childMain = isRow ? (lines === 1 ? 40 : 80) : lines === 1 ? 20 : 40;
  // 자식 cross 는 서로 달라야 alignItems 가 관측된다.
  const childCross = isRow ? [20, 40, 30] : [40, 70, 55];

  const children: CaseNode[] = [0, 1, 2].map((i) => ({
    label: `c${i}`,
    style: {
      [mainProp]: `${childMain}px`,
      [crossProp]: `${childCross[i]}px`,
    },
  }));

  const containerStyle: StyleRecord = {
    display: "flex",
    flexDirection: dir,
    flexWrap: wrap,
    alignItems: ai,
    alignContent: ac,
    [mainProp]: `${containerMain}px`,
  };
  // cross 크기: definite = 명시 px(줄 배치 여유로 alignContent 관측).
  // auto = row 는 height 미설정(content), column 은 width:100%(부모 채움).
  //   **Why 100%**: column 의 bare width:auto 는 block-level flex 컨테이너를 CSS 는
  //   부모 채움(200)하나 엔진은 shrink-to-fit(70) 한다 — latent 발산(비-라이브, catalog
  //   가 항상 width 주입). builder-정확 패턴인 width:100% 는 N10 계약대로 양쪽 채움.
  // definite       = 2줄 cross 합보다 **크게** (row 줄합≈70, column 줄합≈125) → 양수 여유.
  // definite-overflow = 최대 자식 cross(row 40 / column 70)와 줄 합 **둘 다보다 작게** →
  //   align-items(라인 안)와 align-content(라인 간) 양쪽에서 음수 여유가 되도록 한 값.
  //   한쪽만 음수로 만들면 나머지 축은 양수 조합의 중복이 된다.
  if (crossSize === "definite") {
    containerStyle[crossProp] = isRow ? "100px" : "160px";
  } else if (crossSize === "definite-overflow") {
    containerStyle[crossProp] = isRow ? "25px" : "50px";
  } else if (!isRow) {
    containerStyle[crossProp] = "100%";
  }

  return nestUnderRoot(
    containerStyle,
    children,
    `X dir=${dir} wrap=${wrap} ai=${ai} ac=${ac} cross=${crossSize} lines=${lines}`,
  );
}

function crossAxisCases(): ParityCase[] {
  const out: ParityCase[] = [];
  for (const dir of DIRECTIONS)
    for (const wrap of WRAPS)
      for (const ai of ALIGN_ITEMS)
        for (const ac of ALIGN_CONTENT)
          for (const cross of CROSS_SIZE)
            for (const lines of LINE_COUNTS)
              out.push(crossAxisCase(dir, wrap, ai, ac, cross, lines));
  return out;
}

// ── main 축 케이스 (direction × justify × gap × grow × shrink × basis) ──
function mainAxisCase(
  dir: (typeof DIRECTIONS)[number],
  jc: (typeof JUSTIFY)[number],
  gap: (typeof GAPS)[number],
  grow: (typeof GROWS)[number],
  shrink: (typeof SHRINKS)[number],
  basis: (typeof BASES)[number],
  space: (typeof MAIN_SPACE)[number],
): ParityCase {
  const isRow = dir === "row";
  const mainProp = isRow ? "width" : "height";
  const crossProp = isRow ? "height" : "width";
  const gapProp = isRow ? "columnGap" : "rowGap";
  // positive = children 합(≤3×50+2×12=174)보다 크게 → justify-content 가 양수 여유로 동작.
  // negative = 그보다 작게 → 넘침. 위치 정렬(center/flex-end)은 음수 offset, 분배 정렬은
  //   fallback 으로 start — 두 규칙이 갈리는 영역이라 sweep 대상에 포함한다.
  const containerMain = space === "positive" ? (isRow ? 200 : 250) : 80;
  const containerCross = 60;
  const childMain = 40;
  const childCross = 30;

  const children: CaseNode[] = [0, 1, 2].map((i) => ({
    label: `c${i}`,
    style: {
      [mainProp]: `${childMain}px`,
      [crossProp]: `${childCross}px`,
      flexGrow: grow, // 숫자 (§1-4: f32 only)
      flexShrink: shrink, // 숫자
      flexBasis: basis, // 문자열
    },
  }));

  const containerStyle: StyleRecord = {
    display: "flex",
    flexDirection: dir,
    justifyContent: jc,
    [gapProp]: `${gap}px`,
    [mainProp]: `${containerMain}px`,
    [crossProp]: `${containerCross}px`,
  };

  return nestUnderRoot(
    containerStyle,
    children,
    `M dir=${dir} jc=${jc} gap=${gap} grow=${grow} shrink=${shrink} basis=${basis} space=${space}`,
  );
}

function mainAxisCases(): ParityCase[] {
  const out: ParityCase[] = [];
  for (const dir of DIRECTIONS)
    for (const jc of JUSTIFY)
      for (const gap of GAPS)
        for (const grow of GROWS)
          for (const shrink of SHRINKS)
            for (const basis of BASES)
              for (const space of MAIN_SPACE)
                out.push(
                  mainAxisCase(dir, jc, gap, grow, shrink, basis, space),
                );
  return out;
}

function runSweep(cases: ParityCase[]): string[] {
  const failures: string[] = [];
  for (const c of cases) {
    const bad = runParityCase(c);
    if (bad.length) failures.push(`${c.name}\n  ${bad.join("\n  ")}`);
  }
  return failures;
}

describe("ADR-156 Phase 1 — §1-2 flex 파라메트릭 sweep (G1)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it("flex 교차축 576 조합 — 전부 엔진↔CSS 정합", () => {
    const cases = crossAxisCases();
    expect(cases.length).toBe(576);
    const failures = runSweep(cases);
    expect(
      failures,
      `발산 ${failures.length}/576:\n${failures.slice(0, 25).join("\n")}`,
    ).toEqual([]);
  });

  it("flex main 축 576 조합 — 전부 엔진↔CSS 정합", () => {
    const cases = mainAxisCases();
    expect(cases.length).toBe(576);
    const failures = runSweep(cases);
    expect(
      failures,
      `발산 ${failures.length}/576:\n${failures.slice(0, 25).join("\n")}`,
    ).toEqual([]);
  });
});
