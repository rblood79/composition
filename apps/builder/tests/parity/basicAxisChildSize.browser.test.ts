import { beforeAll, describe, expect, it } from "vitest";

import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";

import { KNOWN_CHILD_SIZE, KNOWN_CHILD_PIPELINE } from "./basicAxis.known";
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
 * **ADR-170 부분 격자 2 — 자식 크기**
 * (부모 display × 자식 width × height × margin × min/max)
 *
 * 부분 격자 1 이 "컨테이너가 자기 크기를 어떻게 정하나" 를 훑는다면, 여기는 **확정 크기
 * 부모 안에서 자식이 자기 크기를 어떻게 정하나** 다. 기존 parity 에서 `margin` 은 auto
 * (`autoMargin`) 와 음수·상쇄 (`phase4`) 만 있었고 **일반 px/% margin × 부모 display**
 * 직교는 열거된 적이 없다 (breakdown §2).
 *
 * 부모는 항상 definite (`300×150`) — 미결정 부모는 부분 격자 1·3 담당이다. 축을 받는 것은
 * 첫째 자식 하나뿐이고 둘째는 고정 크기 형제다. **형제의 x 좌표**가 첫째의 폭·margin 을
 * 증명한다 (트랙 폭을 자식 폭으로 확인하면 안 된다는 기존 관행과 같은 이유).
 *
 * 잠금 형식은 부분 격자 1과 동일 — 키 집합 정확 일치 ratchet (breakdown §3.5).
 */

const AVAIL_W = 400;

const ROOT: StyleRecord = { display: "block", width: "300px", height: "200px" };

const PARENT_DISPLAYS = {
  block: { display: "block" },
  "flex-row": { display: "flex", flexDirection: "row" },
  "flex-col": { display: "flex", flexDirection: "column" },
  "grid-auto": { display: "grid", gridTemplateColumns: ["auto", "auto"] },
} as const satisfies Record<string, StyleRecord>;

const CHILD_WIDTHS = {
  auto: {},
  "60px": { width: "60px" },
  "50%": { width: "50%" },
  "fit-content": { width: "fit-content" },
  "max-content": { width: "max-content" },
} as const satisfies Record<string, StyleRecord>;

const CHILD_HEIGHTS = {
  auto: {},
  "30px": { height: "30px" },
  "50%": { height: "50%" },
} as const satisfies Record<string, StyleRecord>;

// 인라인 축 margin — auto 는 여유 흡수(§8.1), `%` 는 부모 인라인 크기 기준.
const CHILD_MARGINS = {
  "0": {},
  "ml-10px": { marginLeft: "10px" },
  "ml-10%": { marginLeft: "10%" },
  "ml-auto": { marginLeft: "auto" },
} as const satisfies Record<string, StyleRecord>;

const CHILD_MINMAX = {
  none: {},
  minW100: { minWidth: "100px" },
  maxW40: { maxWidth: "40px" },
} as const satisfies Record<string, StyleRecord>;

/**
 * 축을 받는 자식 — **고정 크기 손자 하나를 가진 작은 컨테이너**.
 *
 * 스칼라 leaf 를 쓰면 `height:auto` 축이 측정 불가다: ADR-165 측정 스칼라 계약은 **폭
 * 채널만** 있어서 (`contentMin/MaxWidth`) 엔진이 내용 높이를 모른다 — DOM 은 원자
 * 높이로 10, 엔진은 0 이 되어 135/240 이 하니스 산출물로 잡혔다 (Phase 1 실측).
 * 손자가 크기를 확정하면 `width:fit-content`/`max-content` 는 손자 폭에서, `height:auto`
 * 는 손자 높이에서 나와 두 leg 가 같은 근거를 갖는다.
 */
const GRANDCHILD: CaseNode = {
  label: "grandchild",
  style: { width: "70px", height: "25px" },
};
/** 고정 형제 — 이 노드의 x/y 가 subject 의 폭·높이·margin 을 증명한다. */
const SIBLING: CaseNode = {
  label: "sibling",
  style: { width: "30px", height: "20px" },
};

function makeCase(
  name: string,
  childStyle: StyleRecord,
  parentDisplay: StyleRecord,
): ParityCase {
  return {
    name,
    availW: AVAIL_W,
    availH: -1,
    nodes: [
      GRANDCHILD,
      {
        label: "subject",
        style: { display: "block", ...childStyle },
        children: [0],
      },
      SIBLING,
      {
        label: "parent",
        style: { ...parentDisplay, width: "300px", height: "150px" },
        children: [1, 2],
      },
      { label: "root", style: ROOT, children: [3] },
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

function detail(failures: Failure[], total: number): string {
  return `발산 ${failures.length}/${total}:\n${failures
    .slice(0, 20)
    .map((f) => `${f.name}\n  ${f.bad.join("\n  ")}`)
    .join("\n")}`;
}

function keysOf(failures: Failure[]): string[] {
  return failures.map((f) => f.name).sort();
}

// ── 격자 2: 부모 display × width × height × margin × min/max (4×5×3×4×3 = 720) ──
function childSizeCases(): ParityCase[] {
  const cases: ParityCase[] = [];
  for (const [pn, p] of Object.entries(PARENT_DISPLAYS)) {
    for (const [wn, w] of Object.entries(CHILD_WIDTHS)) {
      for (const [hn, h] of Object.entries(CHILD_HEIGHTS)) {
        for (const [mn, m] of Object.entries(CHILD_MARGINS)) {
          for (const [mmn, mm] of Object.entries(CHILD_MINMAX)) {
            cases.push(
              makeCase(
                `${pn}|w=${wn}|h=${hn}|${mn}|${mmn}`,
                { ...w, ...h, ...m, ...mm },
                p,
              ),
            );
          }
        }
      }
    }
  }
  return cases;
}

// ── pipeline leg 대표 부분집합 (부모 display × 자식 width = 20) ──
function pipelineSubsetCases(): ParityCase[] {
  const cases: ParityCase[] = [];
  for (const [pn, p] of Object.entries(PARENT_DISPLAYS)) {
    for (const [wn, w] of Object.entries(CHILD_WIDTHS)) {
      cases.push(makeCase(`pipe|${pn}|w=${wn}`, w, p));
    }
  }
  return cases;
}

describe("ADR-170 부분 격자 2 — 자식 크기", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it("부모display×width×height×margin×min/max 720 조합 — 발산 집합 고정", () => {
    const cases = childSizeCases();
    expect(cases.length).toBe(720);
    const failures = sweep(cases);
    expect(keysOf(failures), detail(failures, cases.length)).toEqual(
      KNOWN_CHILD_SIZE,
    );
  });

  it("파이프라인 leg 20 조합 — TS 공급층 마스킹 감시", () => {
    const cases = pipelineSubsetCases();
    expect(cases.length).toBe(20);
    const failures = sweep(cases, (c) =>
      pipelineLeg(c.nodes, c.availW, c.availH),
    );
    expect(keysOf(failures), detail(failures, cases.length)).toEqual(
      KNOWN_CHILD_PIPELINE,
    );
  });
});
