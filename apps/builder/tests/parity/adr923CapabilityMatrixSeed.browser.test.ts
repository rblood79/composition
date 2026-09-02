import { beforeAll, describe, expect, it } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import {
  LAYOUT_CAPABILITY_MATRIX,
  type LayoutCapabilityRow,
} from "@/builder/workspace/canvas/layout/engines/layoutCapabilityMatrix";
import {
  type CaseNode,
  type StyleRecord,
  domLeg,
  pipelineLeg,
} from "./harness";

/**
 * ADR-923 Phase 6 — capability matrix **seed** 의 Chrome 격차 실측·고정.
 *
 * matrix 의 각 행 (S4 · S7 · S8) 이 가리키는 케이스 1개를 DOM leg (실 Chrome) ↔ production 파이프라인
 * (`calculateFullTreeLayout`) 으로 돌려 지정 노드의 |Δx| |Δy| |Δw| |Δh| 를 잰다. 단언은 **표에 적힌 수치와
 * 같은가** 다 — 격차가 0 이어야 한다는 뜻이 아니다 (선언만, 집행은 breakdown §8). 엔진이 그 의미를 구현하면
 * 격차가 줄어 RED 가 나고, 그때 표를 수리 결과로 갱신한다.
 *
 * 케이스 계약: 부모 `fontSize:"0px"` (strut 폰트 축 0) 는 텍스트가 없는 케이스에만. S4 는 순수 inline 의
 * 본질이 텍스트 run 이라 실제 폰트 (16px / lineHeight 20px) 를 쓴다 — Chrome 과 파이프라인이 같은 폰트
 * 체인으로 재므로 (ADR-165) 폭은 결정적이다.
 */

const FS0: StyleRecord = { fontSize: "0px" };

interface SeedCase {
  id: LayoutCapabilityRow["id"];
  availW: number;
  nodes: CaseNode[];
}

const CASES: SeedCase[] = [
  {
    id: "S4",
    availW: 300,
    nodes: [
      {
        label: "a",
        elementType: "Text",
        text: "AAAA",
        style: { display: "inline", fontSize: "16px", lineHeight: "20px" },
      },
      {
        label: "b",
        elementType: "Text",
        text: "BBBB",
        style: { display: "inline", fontSize: "16px", lineHeight: "20px" },
      },
      {
        label: "root",
        style: {
          display: "block",
          width: "300px",
          fontSize: "16px",
          lineHeight: "20px",
        },
        children: [0, 1],
      },
    ],
  },
  {
    id: "S7",
    availW: 300,
    nodes: [
      {
        label: "a",
        style: {
          display: "block",
          float: "left",
          width: "60px",
          height: "20px",
        },
      },
      {
        label: "b",
        style: { display: "block", width: "100px", height: "30px" },
      },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 1],
      },
    ],
  },
  {
    // `grid-auto-flow: dense` 는 실측 Δ0 (구현됨) 이라 seed 케이스가 못 된다 — subgrid 로 잰다.
    id: "S8",
    availW: 200,
    nodes: [
      { label: "s1", style: { height: "20px" } },
      { label: "s2", style: { height: "20px" } },
      {
        label: "sub",
        style: {
          display: "grid",
          gridColumn: "span 2",
          gridTemplateColumns: "subgrid",
        },
        children: [0, 1],
      },
      {
        label: "root",
        style: {
          display: "grid",
          gridTemplateColumns: ["100px", "100px"],
          width: "200px",
          ...FS0,
        },
        children: [2],
      },
    ],
  },
];

interface Measured {
  id: string;
  node: string;
  dom: { x: number; y: number; w: number; h: number };
  pipe: { x: number; y: number; w: number; h: number };
  gap: { dx: number; dy: number; dw: number; dh: number };
}

const measured: Measured[] = [];

beforeAll(async () => {
  await initCompositionEngineWasm();
  for (const c of CASES) {
    const row = LAYOUT_CAPABILITY_MATRIX.find((r) => r.id === c.id)!;
    const idx = c.nodes.findIndex((n) => n.label === row.oracle.node);
    const dom = domLeg(c.nodes, c.availW);
    const pipe = pipelineLeg(c.nodes, c.availW, -1);
    const d = dom[idx];
    const p = pipe[idx];
    const r1 = (v: number) => Math.round(v * 10) / 10;
    measured.push({
      id: c.id,
      node: row.oracle.node,
      dom: { x: r1(d.x), y: r1(d.y), w: r1(d.w), h: r1(d.h) },
      pipe: { x: r1(p.x), y: r1(p.y), w: r1(p.w), h: r1(p.h) },
      gap: {
        dx: r1(Math.abs(d.x - p.x)),
        dy: r1(Math.abs(d.y - p.y)),
        dw: r1(Math.abs(d.w - p.w)),
        dh: r1(Math.abs(d.h - p.h)),
      },
    });
  }
});

describe("ADR-923 Phase 6 — capability matrix seed (S4 · S7 · S8 Chrome 격차 고정)", () => {
  it("행 계약 — B 갈래 3 자리가 전부 선언돼 있고 policy 는 ignored | declared-substitution, 각 행에 oracle 케이스가 있다", () => {
    expect(LAYOUT_CAPABILITY_MATRIX.map((r) => r.id).sort()).toEqual([
      "S4",
      "S7",
      "S8",
    ]);
    for (const r of LAYOUT_CAPABILITY_MATRIX) {
      expect(["ignored", "declared-substitution"], r.id).toContain(r.policy);
      expect(["none", "partial"], r.id).toContain(r.engineSupport);
      expect(r.behavior.length, r.id).toBeGreaterThan(20);
      expect(r.followUp, r.id).toMatch(/§8/);
      expect(
        CASES.some((c) => c.id === r.id),
        r.id,
      ).toBe(true);
    }
  });

  it("Chrome 격차 — 각 행의 oracle 수치가 실측과 같다 (0 이어야 한다는 뜻이 아니다 — 선언 고정)", () => {
    for (const m of measured) {
      console.log(
        `ADR923CAP ${m.id} node=${m.node} dom=${JSON.stringify(m.dom)} pipe=${JSON.stringify(m.pipe)} gap=${JSON.stringify(m.gap)}`,
      );
    }
    expect(measured).toHaveLength(CASES.length);
    for (const m of measured) {
      const row = LAYOUT_CAPABILITY_MATRIX.find((r) => r.id === m.id)!;
      expect(
        m.gap,
        `${m.id} gap (표 oracle.gap 갱신 필요 — 수리 결과로만)`,
      ).toEqual(row.oracle.gap);
      // 격차가 실제로 존재해야 seed 로서 뜻이 있다 — 셋 다 0 이면 행이 pass 로 승격될 후보 (표 수정 대상).
      const any = m.gap.dx + m.gap.dy + m.gap.dw + m.gap.dh;
      expect(
        any,
        `${m.id} 격차 0 — 엔진이 구현했으면 행을 pass 로 옮길 것`,
      ).toBeGreaterThan(0);
    }
  });
});
