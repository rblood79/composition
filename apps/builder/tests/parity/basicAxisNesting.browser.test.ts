import { beforeAll, describe, expect, it } from "vitest";

import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";

import { KNOWN_NESTING, KNOWN_NESTING_PIPELINE } from "./basicAxis.known";
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
 * **ADR-170 부분 격자 3 — 중첩 전파** (조부 컨텍스트 × 중간 display × 중간 크기 × leaf 크기)
 *
 * 검증 대상은 **한 단계 전파**다: 조부가 내려준 available / percentage base 가 중간
 * 컨테이너를 거쳐 leaf 까지 같은 의미로 도달하는가. 기존 parity 에서 크기 축의 전파를
 * 훑은 파일은 `slotPercentChild` (`%` 폭 1축) 뿐이었다 (breakdown §2).
 *
 * 2단 이상 중첩은 사각으로 남긴다 (breakdown §4) — 조합 폭발이고, 1단이 정합이면
 * 귀납이 성립한다는 가정이다. 그 가정 자체가 틀릴 수 있다는 것이 사각의 뜻이다.
 *
 * 잠금 형식은 부분 격자 1·2와 동일 — 키 집합 정확 일치 ratchet (breakdown §3.5).
 */

const AVAIL_W = 400;

// 조부 2종 — 부분 격자 1의 부모 컨텍스트와 같은 정의 (breakdown §3.0).
const GRANDS = {
  definite: { display: "block", width: "300px", height: "200px" },
  shrink: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "300px",
  },
} as const satisfies Record<string, StyleRecord>;

const MID_DISPLAYS = {
  block: { display: "block" },
  "flex-row": { display: "flex", flexDirection: "row" },
  "grid-auto": { display: "grid", gridTemplateColumns: ["auto", "auto"] },
} as const satisfies Record<string, StyleRecord>;

const MID_SIZES = {
  auto: {},
  "150px": { width: "150px" },
  "50%": { width: "50%" },
} as const satisfies Record<string, StyleRecord>;

const LEAF_SIZES = {
  auto: {},
  "50%": { width: "50%" },
} as const satisfies Record<string, StyleRecord>;

const LEAF_B: CaseNode = {
  label: "leafB",
  style: { height: "20px", contentMinWidth: 30, contentMaxWidth: 30 },
  domAtoms: [30],
};

function makeCase(
  name: string,
  leafStyle: StyleRecord,
  mid: StyleRecord,
  grand: StyleRecord,
): ParityCase {
  return {
    name,
    availW: AVAIL_W,
    availH: -1,
    nodes: [
      {
        label: "leafA",
        style: {
          height: "30px",
          contentMinWidth: 50,
          contentMaxWidth: 90,
          ...leafStyle,
        },
        domAtoms: [40, 50],
      },
      LEAF_B,
      { label: "mid", style: mid, children: [0, 1] },
      { label: "grand", style: grand, children: [2] },
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

// ── 격자 3: 조부 × 중간 display × 중간 크기 × leaf 크기 (2×3×3×2 = 36) ──
function nestingCases(): ParityCase[] {
  const cases: ParityCase[] = [];
  for (const [gn, g] of Object.entries(GRANDS)) {
    for (const [dn, d] of Object.entries(MID_DISPLAYS)) {
      for (const [sn, s] of Object.entries(MID_SIZES)) {
        for (const [ln, l] of Object.entries(LEAF_SIZES)) {
          cases.push(
            makeCase(`${gn}|${dn}|mid=${sn}|leaf=${ln}`, l, { ...d, ...s }, g),
          );
        }
      }
    }
  }
  return cases;
}

describe("ADR-170 부분 격자 3 — 중첩 전파", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it("조부×중간display×중간크기×leaf크기 36 조합 — 발산 집합 고정", () => {
    const cases = nestingCases();
    expect(cases.length).toBe(36);
    const failures = sweep(cases);
    expect(keysOf(failures), detail(failures, cases.length)).toEqual(
      KNOWN_NESTING,
    );
  });

  it("파이프라인 leg 36 조합 — TS 공급층 마스킹 감시", () => {
    const cases = nestingCases();
    const failures = sweep(cases, (c) =>
      pipelineLeg(c.nodes, c.availW, c.availH),
    );
    expect(keysOf(failures), detail(failures, cases.length)).toEqual(
      KNOWN_NESTING_PIPELINE,
    );
  });
});
