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
 * breakdown §1-2 의 "정합 확인 영역" 672 조합(교차축 384 + main 축 288)을 재도출한다.
 * 전부 **소비 O 필드**(§1-3)만 사용 — align_self(E1)/justify_items(E2)/grid_auto_*(E14)
 * 등 미소비 9필드는 이 sweep 대상 아님(그 발산은 Phase 2~5). 따라서 정합(전부 통과)이
 * 기대값이며, 실패 시 (a) 하니스 구성 오류(§1-4 계약) 또는 (b) 미기록 발산이다.
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
const CROSS_SIZE = ["definite", "auto"] as const;
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
  // definite cross 는 2줄 cross 합보다 크게 잡는다 (row 줄합≈70, column 줄합≈125) —
  // 이 sweep 은 **양수 free space** 조합만 훑는다. 음수 free space(= 내용이 컨테이너를
  // 넘김)는 정렬값마다 규칙이 갈리므로(위치 정렬은 음수 offset, 분배는 fallback)
  // `crossAxisOverflow.browser.test.ts` 가 전담한다.
  // **주의**: 종전 주석은 이 영역을 "엔진이 0 클램프해서 발산" 이라 적어 뒀으나 2026-07-27
  // 에 해소됐다 — 여전히 sweep 밖이라는 사실만 유효하다. sweep 통과를 overflow 커버리지로
  // 읽지 말 것.
  if (crossSize === "definite") {
    containerStyle[crossProp] = isRow ? "100px" : "160px";
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
): ParityCase {
  const isRow = dir === "row";
  const mainProp = isRow ? "width" : "height";
  const crossProp = isRow ? "height" : "width";
  const gapProp = isRow ? "columnGap" : "rowGap";
  // main 은 children 합(≤3×50+2×12=174)보다 커야 justify-content 가 양수 free space
  // 로 동작한다. 작으면 overflow → CSS 음수 offset vs 엔진 0 클램프로 갈린다.
  const containerMain = isRow ? 200 : 250;
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
    `M dir=${dir} jc=${jc} gap=${gap} grow=${grow} shrink=${shrink} basis=${basis}`,
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
              out.push(mainAxisCase(dir, jc, gap, grow, shrink, basis));
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

  it("flex 교차축 384 조합 — 전부 엔진↔CSS 정합", () => {
    const cases = crossAxisCases();
    expect(cases.length).toBe(384);
    const failures = runSweep(cases);
    expect(
      failures,
      `발산 ${failures.length}/384:\n${failures.slice(0, 25).join("\n")}`,
    ).toEqual([]);
  });

  it("flex main 축 288 조합 — 전부 엔진↔CSS 정합", () => {
    const cases = mainAxisCases();
    expect(cases.length).toBe(288);
    const failures = runSweep(cases);
    expect(
      failures,
      `발산 ${failures.length}/288:\n${failures.slice(0, 25).join("\n")}`,
    ).toEqual([]);
  });
});
