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
import {
  KNOWN_ASPECT,
  KNOWN_CONTAINER_PIPELINE,
  KNOWN_CONTAINER_SIZE,
} from "./basicAxis.known";

/**
 * **ADR-170 부분 격자 1 — 컨테이너 자기 크기**
 * (display × width × height × min/max × leaf 종류 × 부모 컨텍스트)
 *
 * 기존 parity 는 "결함이 발견된 곳" 중심의 점 커버라, `display` 5종 × `width` 6종 ×
 * `height` 3종을 **직교로** 훑은 파일이 없었다 (breakdown §2 실측). 컨테이너 자기 크기
 * 축에서의 `min-*`/`max-*` clamp 도 미열거였다. 이 격자가 그 구멍을 전수로 닫는다.
 *
 * ## leaf 종류가 축인 이유 (Phase 1 대조 probe 실측, 2026-07-28)
 * 같은 조합에서 **자식이 확정 폭이면 정합, 측정 스칼라면 발산**이었다. 예 —
 * `block + width:min-content`: plain 90/90 정합 vs 스칼라 dom 50 / eng 300.
 * leaf 축이 없으면 "엔진이 컨테이너 intrinsic 키워드를 무시한다" 같은 **틀린 귀속**이
 * 나온다 (실제로는 키워드를 처리하되 스칼라 기여를 못 읽는다). 두 종류를 같이 돌려야
 * 원인이 컨테이너 알고리즘인지 leaf 기여 공급인지 갈린다.
 *
 * ## 하니스 계약 (breakdown §3.0 — 어기면 엔진이 아니라 하니스를 측정한다)
 * - 피험 컨테이너는 **root 가 아니라 중첩** — root 는 `compute_layout(root, w, -1)` 의 자기
 *   크기 경로(E5)라 별개 축이다 (`flexSweep.nestUnderRoot` 선례).
 * - 부모 컨텍스트는 **케이스 트리 안의 wrapper 노드**로 만든다. `availH` 는 DOM leg 에
 *   대응물이 없어(`domLeg` wrapper 는 width 만 설정) 블록 축 definite 신호가 못 된다.
 * - 스칼라 leaf 는 텍스트 대신 `contentMin/MaxWidth` + `domAtoms` — 정수 오라클.
 *
 * ## 잠금 형식 (breakdown §3.5)
 * 발산은 **키 집합 정확 일치**로 잠근다. 양방향 ratchet — 신규 발산도 red, 해소된 발산도
 * (목록에서 지우라고) red. 발산 수치는 breakdown §7 인벤토리에 두어, 무관한 엔진 변경마다
 * 테스트 파일이 갱신 대상이 되는 것을 막는다.
 */

const AVAIL_W = 400;

// ── 부모 컨텍스트 2종 (breakdown §3.0) ──
const PARENTS = {
  // 인라인 축 stretch + 블록 축 확정.
  definite: { display: "block", width: "300px", height: "200px" },
  // 인라인 available 미결정(INDEFINITE_AVAIL) — non-stretch align 이 신호.
  shrink: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "300px",
  },
} as const satisfies Record<string, StyleRecord>;

const DISPLAYS = {
  block: { display: "block" },
  "flex-row": { display: "flex", flexDirection: "row" },
  "flex-col": { display: "flex", flexDirection: "column" },
  "grid-auto": { display: "grid", gridTemplateColumns: ["auto", "auto"] },
  "grid-1fr": { display: "grid", gridTemplateColumns: ["1fr", "1fr"] },
} as const satisfies Record<string, StyleRecord>;

const WIDTHS = {
  auto: {},
  "120px": { width: "120px" },
  "50%": { width: "50%" },
  "min-content": { width: "min-content" },
  "max-content": { width: "max-content" },
  "fit-content": { width: "fit-content" },
} as const satisfies Record<string, StyleRecord>;

const HEIGHTS = {
  auto: {},
  "80px": { height: "80px" },
  "50%": { height: "50%" },
} as const satisfies Record<string, StyleRecord>;

// 각 1값 — clamp 가 명시 크기/내용 크기 양쪽을 이기는지 관측.
const MINMAX = {
  none: {},
  minW200: { minWidth: "200px" },
  maxW60: { maxWidth: "60px" },
  minH120: { minHeight: "120px" },
  maxH40: { maxHeight: "40px" },
} as const satisfies Record<string, StyleRecord>;

/**
 * leaf 2종.
 * - `scalar` — 텍스트 leaf 대역 (ADR-165 측정 스칼라 계약). `domAtoms` 가 공백 폭 0 인
 *   inline-block 원자라 min-content = max(원자), max-content = Σ원자 가 정확 정수.
 * - `plain` — 폭이 확정된 비-텍스트 leaf. 컨테이너 알고리즘만 남기는 대조군.
 *
 * 두 leaf 의 크기는 서로 달라야 트랙/정렬 효과가 관측된다.
 */
const LEAVES = {
  scalar: [
    {
      label: "leafA",
      style: { height: "30px", contentMinWidth: 50, contentMaxWidth: 90 },
      domAtoms: [40, 50],
    },
    {
      label: "leafB",
      style: { height: "20px", contentMinWidth: 30, contentMaxWidth: 30 },
      domAtoms: [30],
    },
  ],
  plain: [
    { label: "leafA", style: { height: "30px", width: "90px" } },
    { label: "leafB", style: { height: "20px", width: "30px" } },
  ],
} as const satisfies Record<string, readonly CaseNode[]>;

function makeCase(
  name: string,
  box: StyleRecord,
  parent: StyleRecord,
  kids: readonly CaseNode[] = LEAVES.scalar,
): ParityCase {
  return {
    name,
    availW: AVAIL_W,
    availH: -1,
    nodes: [
      kids[0],
      kids[1],
      { label: "box", style: box, children: [0, 1] },
      { label: "parent", style: parent, children: [2] },
    ],
  };
}

type Failure = { name: string; bad: string[] };

function sweep(
  cases: ParityCase[],
  leg: (c: ParityCase) => ReturnType<typeof engineLeg> = (c) =>
    engineLeg(c.nodes, c.availW, c.availH),
): Failure[] {
  const out: Failure[] = [];
  for (const c of cases) {
    const bad = diffCase(c.nodes, domLeg(c.nodes, c.availW), leg(c));
    if (bad.length) out.push({ name: c.name, bad });
  }
  return out;
}

/** 실패 상세 — 단언 메시지용 (앞 20건). */
function detail(failures: Failure[], total: number): string {
  return `발산 ${failures.length}/${total}:\n${failures
    .slice(0, 20)
    .map((f) => `${f.name}\n  ${f.bad.join("\n  ")}`)
    .join("\n")}`;
}

function keysOf(failures: Failure[]): string[] {
  return failures.map((f) => f.name).sort();
}

// ── 격자 1: leaf × 부모 × display × width × height × min/max (2×2×5×6×3×5 = 1800) ──
function containerSizeCases(): ParityCase[] {
  const cases: ParityCase[] = [];
  for (const [ln, kids] of Object.entries(LEAVES)) {
    for (const [pn, parent] of Object.entries(PARENTS)) {
      for (const [dn, d] of Object.entries(DISPLAYS)) {
        for (const [wn, w] of Object.entries(WIDTHS)) {
          for (const [hn, h] of Object.entries(HEIGHTS)) {
            for (const [mn, mm] of Object.entries(MINMAX)) {
              cases.push(
                makeCase(
                  `${ln}|${pn}|${dn}|w=${wn}|h=${hn}|${mn}`,
                  { ...d, ...w, ...h, ...mm },
                  parent,
                  kids,
                ),
              );
            }
          }
        }
      }
    }
  }
  return cases;
}

// ── aspect-ratio 소블록 (5×3×2 = 30) ──
// 엔진 지원은 확인됐고(`tree.rs::apply_aspect_to_dims`) 기존 커버가 2케이스뿐이라
// (`phase5` E15) 얇은 축을 닫는다. 축으로 곱하지 않고 소블록으로 분리 — breakdown §4.
// 비율은 컨테이너 자기 상자 규칙이라 leaf 종류에 독립 → plain 고정.
const ASPECT_GIVEN = {
  "w-given": { width: "120px" },
  "h-given": { height: "60px" },
  "none-given": {},
} as const satisfies Record<string, StyleRecord>;

const ASPECT_CLAMP = {
  none: {},
  maxW60: { maxWidth: "60px" },
} as const satisfies Record<string, StyleRecord>;

function aspectCases(): ParityCase[] {
  const cases: ParityCase[] = [];
  for (const [dn, d] of Object.entries(DISPLAYS)) {
    for (const [gn, g] of Object.entries(ASPECT_GIVEN)) {
      for (const [cn, c] of Object.entries(ASPECT_CLAMP)) {
        cases.push(
          makeCase(
            `aspect|${dn}|${gn}|${cn}`,
            { ...d, aspectRatio: 2, ...g, ...c },
            PARENTS.definite,
            LEAVES.plain,
          ),
        );
      }
    }
  }
  return cases;
}

// ── pipeline leg 대표 부분집합 (leaf × display × width = 60) ──
// TS 공급층(enrichWithIntrinsicSize / Step 4.5)이 엔진 결과를 마스킹하는지 감시.
// min/max·height 는 대표 1값 고정 — 전 조합은 engine leg 이 담당한다.
function pipelineSubsetCases(): ParityCase[] {
  const cases: ParityCase[] = [];
  for (const [ln, kids] of Object.entries(LEAVES)) {
    for (const [dn, d] of Object.entries(DISPLAYS)) {
      for (const [wn, w] of Object.entries(WIDTHS)) {
        cases.push(
          makeCase(
            `pipe|${ln}|${dn}|w=${wn}`,
            { ...d, ...w },
            PARENTS.definite,
            kids,
          ),
        );
      }
    }
  }
  return cases;
}

describe("ADR-170 부분 격자 1 — 컨테이너 자기 크기", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it("leaf×부모×display×width×height×min/max 1800 조합 — 발산 집합 고정", () => {
    const cases = containerSizeCases();
    expect(cases.length).toBe(1800);
    const failures = sweep(cases);
    expect(keysOf(failures), detail(failures, cases.length)).toEqual(
      KNOWN_CONTAINER_SIZE,
    );
  });

  it("aspect-ratio 30 조합 — 발산 집합 고정", () => {
    const cases = aspectCases();
    expect(cases.length).toBe(30);
    const failures = sweep(cases);
    expect(keysOf(failures), detail(failures, cases.length)).toEqual(
      KNOWN_ASPECT,
    );
  });

  it("파이프라인 leg 60 조합 — TS 공급층 마스킹 감시", () => {
    const cases = pipelineSubsetCases();
    expect(cases.length).toBe(60);
    const failures = sweep(cases, (c) =>
      pipelineLeg(c.nodes, c.availW, c.availH),
    );
    expect(keysOf(failures), detail(failures, cases.length)).toEqual(
      KNOWN_CONTAINER_PIPELINE,
    );
  });
});
