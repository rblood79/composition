import { beforeAll, describe, expect, it, vi } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import { CompositionEngineLayout } from "@/builder/workspace/canvas/wasm-bindings/compositionEngine";
import {
  LAYOUT_CAPABILITY_MATRIX,
  type CapabilityPolicy,
  type EngineSupport,
  type LayoutCapabilityRow,
} from "@/builder/workspace/canvas/layout/engines/layoutCapabilityMatrix";
import {
  type CaseNode,
  type StyleRecord,
  domLeg,
  pipelineLeg,
} from "./harness";

/**
 * ADR-923 Phase 6 — capability matrix **seed** 의 Chrome 격차 실측·고정 + policy 경계 대조 (round 33 정정).
 *
 * matrix 의 각 oracle (S4 · S7 · S8 subgrid · S8 dense) 이 가리키는 케이스 1개를 DOM leg (실 Chrome) ↔
 * production 파이프라인 (`calculateFullTreeLayout`) 으로 돌려 지정 노드의 |Δx| |Δy| |Δw| |Δh| 를 잰다.
 * 단언은 **표에 적힌 수치와 같은가** 다 — 격차가 0 이어야 한다는 뜻이 아니다 (선언만, 집행은 breakdown §8).
 * 엔진이 그 의미를 구현하면 격차가 줄어 RED 가 나고, 그때 표를 수리 결과로 갱신한다.
 *
 * policy 는 표 값 그대로 (행별 정확값) 고정하고, 같은 실행의 `buildTreeBatch` JSON 인자 (엔진 경계 record)
 * 로 그 근거를 대조한다 — 값이 경계에 **실리면** `declared-substitution`, 키 자체가 **없으면** `ignored`
 * (r33m2: `display: inline` 은 실린다 → ignored 가 아니다).
 *
 * 케이스 계약: production 이 경계까지 운반하는 키만 쓴다 — `gridColumn` shorthand 는 파이프라인이
 * 버리므로 (grid 분기 · `engineStyleToRecord` 는 `gridColumnStart/End` longhand 만 싣는다) DOM 과 파이프라인이
 * 서로 다른 이유로 같아져 Δ0 이 "구현됨" 으로 잘못 읽혔다 (r33m1 — dense). 부모 `fontSize:"0px"` (strut
 * 폰트 축 0) 는 텍스트가 없는 케이스에만. S4 는 순수 inline 의 본질이 텍스트 run 이라 실제 폰트 (16px /
 * lineHeight 20px) 를 쓴다 — Chrome 과 파이프라인이 같은 폰트 체인으로 재므로 (ADR-165) 폭은 결정적이다.
 */

const FS0: StyleRecord = { fontSize: "0px" };

/** 경계 record 대조 — 케이스 노드 index 의 style 에서 `key` 가 실렸는가 (+ 실린 값). */
interface BoundaryProbe {
  nodeIdx: number;
  key: string;
  carried: boolean;
  value?: unknown;
}

interface SeedCase {
  caseId: string;
  availW: number;
  nodes: CaseNode[];
  boundary: BoundaryProbe;
}

const CASES: SeedCase[] = [
  {
    caseId: "S4-inline-text-pair",
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
    boundary: { nodeIdx: 1, key: "display", carried: true, value: "inline" },
  },
  {
    caseId: "S7-float-left",
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
    boundary: { nodeIdx: 0, key: "float", carried: false },
  },
  {
    // span 은 production 이 운반하는 longhand (`gridColumnStart`/`gridColumnEnd`) 로 — shorthand 금지.
    caseId: "S8-grid-subgrid",
    availW: 200,
    nodes: [
      { label: "s1", style: { height: "20px" } },
      { label: "s2", style: { height: "20px" } },
      {
        label: "sub",
        style: {
          display: "grid",
          gridColumnStart: "1",
          gridColumnEnd: "3",
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
    boundary: {
      nodeIdx: 2,
      key: "gridTemplateColumns",
      carried: true,
      value: ["subgrid"],
    },
  },
  {
    caseId: "S8-grid-dense",
    availW: 200,
    nodes: [
      {
        label: "a",
        style: { gridColumnStart: "1", gridColumnEnd: "3", height: "20px" },
      },
      { label: "b", style: { height: "20px" } },
      {
        label: "c",
        style: { gridColumnStart: "1", gridColumnEnd: "3", height: "20px" },
      },
      { label: "d", style: { height: "20px" } },
      {
        label: "root",
        style: {
          display: "grid",
          gridTemplateColumns: ["100px", "100px"],
          gridAutoFlow: "row dense",
          width: "200px",
          ...FS0,
        },
        children: [0, 1, 2, 3],
      },
    ],
    boundary: {
      nodeIdx: 4,
      key: "gridAutoFlow",
      carried: true,
      value: "row dense",
    },
  },
];

/** 행별 정확값 — 표와 독립 선언 (r33m2: enum 집합 검사가 아니라 값 고정). */
const EXPECTED: Record<
  LayoutCapabilityRow["id"],
  { policy: CapabilityPolicy; engineSupport: EngineSupport }
> = {
  S4: { policy: "declared-substitution", engineSupport: "none" },
  S7: { policy: "ignored", engineSupport: "none" },
  S8: { policy: "declared-substitution", engineSupport: "partial" },
};

interface BatchNode {
  style: Record<string, unknown>;
  children: number[];
}

interface Measured {
  caseId: string;
  node: string;
  dom: { x: number; y: number; w: number; h: number };
  pipe: { x: number; y: number; w: number; h: number };
  gap: { dx: number; dy: number; dw: number; dh: number };
  /** 경계 record 의 대상 노드 style (probe 대조용) */
  boundaryStyle: Record<string, unknown>;
}

const measured: Measured[] = [];

/** 케이스 노드 index → batch index (root 에서 children 순서로 내려가 대응). */
function mapCaseToBatch(nodes: CaseNode[], batch: BatchNode[]): number[] {
  const referenced = new Set<number>();
  for (const n of batch) for (const c of n.children) referenced.add(c);
  const batchRoots = batch.map((_, i) => i).filter((i) => !referenced.has(i));
  if (batchRoots.length !== 1)
    throw new Error(`batch root 가 1개가 아니다: ${batchRoots.length}`);
  const map = new Array<number>(nodes.length).fill(-1);
  const walk = (caseIdx: number, batchIdx: number) => {
    map[caseIdx] = batchIdx;
    const cc = nodes[caseIdx].children ?? [];
    const bc = batch[batchIdx].children;
    if (cc.length !== bc.length)
      throw new Error(
        `자식 수 불일치 case#${caseIdx} ${cc.length} vs batch#${batchIdx} ${bc.length}`,
      );
    cc.forEach((ci, k) => walk(ci, bc[k]));
  };
  walk(nodes.length - 1, batchRoots[0]);
  if (map.some((v) => v < 0)) throw new Error("batch 대응 누락");
  return map;
}

function oracleOf(caseId: string) {
  for (const row of LAYOUT_CAPABILITY_MATRIX) {
    const o = row.oracles.find((x) => x.caseId === caseId);
    if (o) return { row, oracle: o };
  }
  throw new Error(`matrix 에 oracle 없음: ${caseId}`);
}

beforeAll(async () => {
  await initCompositionEngineWasm();
  for (const c of CASES) {
    const { oracle } = oracleOf(c.caseId);
    const idx = c.nodes.findIndex((n) => n.label === oracle.node);
    if (idx < 0) throw new Error(`${c.caseId}: 노드 ${oracle.node} 없음`);
    const dom = domLeg(c.nodes, c.availW);
    const jsonSpy = vi.spyOn(
      CompositionEngineLayout.prototype,
      "buildTreeBatch",
    );
    let pipe: ReturnType<typeof pipelineLeg>;
    let batch: BatchNode[];
    try {
      pipe = pipelineLeg(c.nodes, c.availW, -1);
      const calls = jsonSpy.mock.calls.map(
        ([json]) => JSON.parse(json) as BatchNode[],
      );
      const found =
        calls.filter((b) => b.length === c.nodes.length).at(-1) ?? calls.at(-1);
      if (!found) throw new Error(`${c.caseId}: buildTreeBatch 미호출`);
      batch = found;
    } finally {
      jsonSpy.mockRestore();
    }
    const map = mapCaseToBatch(c.nodes, batch);
    const d = dom[idx];
    const p = pipe[idx];
    const r1 = (v: number) => Math.round(v * 10) / 10;
    measured.push({
      caseId: c.caseId,
      node: oracle.node,
      dom: { x: r1(d.x), y: r1(d.y), w: r1(d.w), h: r1(d.h) },
      pipe: { x: r1(p.x), y: r1(p.y), w: r1(p.w), h: r1(p.h) },
      gap: {
        dx: r1(Math.abs(d.x - p.x)),
        dy: r1(Math.abs(d.y - p.y)),
        dw: r1(Math.abs(d.w - p.w)),
        dh: r1(Math.abs(d.h - p.h)),
      },
      boundaryStyle: batch[map[c.boundary.nodeIdx]].style,
    });
  }
});

describe("ADR-923 Phase 6 — capability matrix seed (S4 · S7 · S8 Chrome 격차 고정 + policy 경계 대조)", () => {
  it("행 계약 — B 갈래 3 자리가 전부 선언돼 있고 policy · engineSupport 는 행별 정확값, oracle 마다 케이스가 있다", () => {
    expect(LAYOUT_CAPABILITY_MATRIX.map((r) => r.id).sort()).toEqual([
      "S4",
      "S7",
      "S8",
    ]);
    for (const r of LAYOUT_CAPABILITY_MATRIX) {
      expect(r.policy, `${r.id} policy`).toBe(EXPECTED[r.id].policy);
      expect(r.engineSupport, `${r.id} engineSupport`).toBe(
        EXPECTED[r.id].engineSupport,
      );
      expect(r.behavior.length, r.id).toBeGreaterThan(20);
      expect(r.followUp, r.id).toMatch(/§8/);
      expect(r.oracles.length, `${r.id} oracles`).toBeGreaterThan(0);
      for (const o of r.oracles) {
        expect(
          CASES.some((c) => c.caseId === o.caseId),
          `${r.id} ${o.caseId} 케이스`,
        ).toBe(true);
      }
    }
    // 역방향 — 케이스마다 표 oracle 이 있다 (고아 케이스 금지).
    for (const c of CASES) expect(() => oracleOf(c.caseId)).not.toThrow();
  });

  it("policy 근거 — 값이 엔진 경계 record 에 실리면 declared-substitution, 키가 없으면 ignored", () => {
    expect(measured).toHaveLength(CASES.length);
    for (const c of CASES) {
      const m = measured.find((x) => x.caseId === c.caseId)!;
      const { row } = oracleOf(c.caseId);
      const has = Object.prototype.hasOwnProperty.call(
        m.boundaryStyle,
        c.boundary.key,
      );
      expect(has, `${c.caseId} 경계 record 에 ${c.boundary.key} 실림?`).toBe(
        c.boundary.carried,
      );
      if (c.boundary.carried) {
        expect(m.boundaryStyle[c.boundary.key], `${c.caseId} 경계 값`).toEqual(
          c.boundary.value,
        );
        expect(row.policy, `${c.caseId} policy (실림)`).toBe(
          "declared-substitution",
        );
      } else {
        expect(row.policy, `${c.caseId} policy (안 실림)`).toBe("ignored");
      }
    }
  });

  it("Chrome 격차 — 각 oracle 의 수치가 실측과 같다 (0 이어야 한다는 뜻이 아니다 — 선언 고정)", () => {
    for (const m of measured) {
      console.log(
        `ADR923CAP ${m.caseId} node=${m.node} dom=${JSON.stringify(m.dom)} pipe=${JSON.stringify(m.pipe)} gap=${JSON.stringify(m.gap)}`,
      );
    }
    expect(measured).toHaveLength(CASES.length);
    for (const m of measured) {
      const { oracle } = oracleOf(m.caseId);
      expect(
        m.gap,
        `${m.caseId} gap (표 oracle.gap 갱신 필요 — 수리 결과로만)`,
      ).toEqual(oracle.gap);
      // 격차가 실제로 존재해야 seed 로서 뜻이 있다 — 넷 다 0 이면 그 값이 구현된 것 (표 수정 대상).
      const any = m.gap.dx + m.gap.dy + m.gap.dw + m.gap.dh;
      expect(
        any,
        `${m.caseId} 격차 0 — 엔진이 구현했으면 oracle 을 빼고 행을 재판정할 것`,
      ).toBeGreaterThan(0);
    }
  });
});
