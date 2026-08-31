import { beforeAll, describe, expect, it } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import {
  calculateFullTreeLayout,
  resetPersistentTree,
} from "@/builder/workspace/canvas/layout/engines/fullTreeLayout";
import type { CanvasLayoutNode } from "@/types/builder/unified.types";
import type { CaseNode } from "./harness";

/**
 * ADR-923 Phase 0 §D — `calculateFullTreeLayout` 시간 baseline (G3 대조군).
 *
 * 기본 **skip**. `VITE_ADR923_BASELINE=1 pnpm --filter @composition/builder test:parity -- \
 *   tests/parity/adr923LayoutBaseline.browser.test.ts` 로만 실행한다 (Vite 는 `VITE_` 접두
 * process.env 를 `import.meta.env` 로 노출 — 브라우저 leg 에서 process.env 는 없다).
 *
 * 두 arm 을 같은 fixture 생성 규칙으로 잰다 — Phase 5(cutover) 후 **같은 규칙으로 재측정**해
 * p95 ≤ baseline +5% (HC6 / G3) 를 판정한다. 수치는 절대값이 아니라 재측정 대조용이다
 * (measurement-validity.md Q1: 합성 fixture = 규모 전용 · Q2: block arm = 불리 케이스 · Q3: 본
 * 파일이 대조군).
 *
 * - arm F (flex 위주, 통상 형태): root flex-column → 8 flex-row(wrap) → 8 flex-column → 8
 *   flex-row(wrap) → 9 고정 크기 `box` leaf(40×20). 노드 5,193 (깊이 5, fan-out 8/8/8/9).
 * - arm B (block 위주, 불리 케이스): root block → 100 `display:"block"` 컨테이너 → 각 49
 *   catalog `Button`(`style: {}`, 짧은 text). 노드 5,001 (깊이 3, fan-out 100/49). 현재는
 *   IFC 시뮬레이션(flex wrap) 경로, Phase 5 후 block.rs line box 경로가 되는 fixture.
 *
 * 측정: WASM init 은 `beforeAll` 로 제외. run 마다 `resetPersistentTree(pageId)` 를 **타이머
 * 밖**에서 호출해 full build 를 강제(증분 경로 배제). warm-up 5회 뒤 30회, p50/p95 는
 * nearest-rank. 결과 JSON: `tests/parity/.artifacts/adr-923-layout-baseline.json` (untracked
 * — 수치는 evidence 문서로 옮긴다).
 *
 * pipelineLeg(`harness.ts:223`) 와 같은 방식으로 elementsMap/childrenMap 을 만든다 — 결과 대신
 * 시간을 재므로 harness 를 수정하지 않고 map 구성만 미러한다.
 */

const ENABLED = import.meta.env.VITE_ADR923_BASELINE === "1";
const ARTIFACT = "tests/parity/.artifacts/adr-923-layout-baseline.json";
const WARMUP_RUNS = 5;
const MEASURED_RUNS = 30;
const AVAIL_W = 1200;
const AVAIL_H = -1; // auto (pipelineLeg 관례)

interface ArmStats {
  arm: string;
  shape: string;
  nodeCount: number;
  containerCount: number;
  leafCount: number;
  warmupRuns: number;
  measuredRuns: number;
  p50Ms: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
  meanMs: number;
  samplesMs: number[];
}

interface BaselineResult {
  adr: "923";
  phase: "0";
  measuredAt: string;
  availW: number;
  availH: number;
  environment: Record<string, unknown>;
  arms: ArmStats[];
}

// ── fixture 생성 규칙 (Phase 5 후 동일 규칙으로 재측정) ──

/** post-order 로 노드를 쌓는 builder — root 를 마지막에 push (CaseNode 계약). */
function createNodeList(): {
  nodes: CaseNode[];
  push: (node: CaseNode) => number;
} {
  const nodes: CaseNode[] = [];
  return {
    nodes,
    push: (node) => {
      nodes.push(node);
      return nodes.length - 1;
    },
  };
}

function buildFlexArm(): CaseNode[] {
  const { nodes, push } = createNodeList();
  const leaf = (): number =>
    push({ label: "leaf", style: { width: 40, height: 20 } });
  const level3 = (): number => {
    const children = Array.from({ length: 9 }, leaf);
    return push({
      label: "row3",
      style: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        columnGap: 4,
        rowGap: 4,
      },
      children,
    });
  };
  const level2 = (): number => {
    const children = Array.from({ length: 8 }, level3);
    return push({
      label: "col2",
      style: { display: "flex", flexDirection: "column", rowGap: 4 },
      children,
    });
  };
  const level1 = (): number => {
    const children = Array.from({ length: 8 }, level2);
    return push({
      label: "row1",
      style: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        columnGap: 8,
        rowGap: 8,
      },
      children,
    });
  };
  const top = Array.from({ length: 8 }, level1);
  push({
    label: "root",
    style: {
      display: "flex",
      flexDirection: "column",
      width: AVAIL_W,
      rowGap: 8,
    },
    children: top,
  });
  return nodes;
}

function buildBlockArm(): CaseNode[] {
  const { nodes, push } = createNodeList();
  const containers: number[] = [];
  for (let c = 0; c < 100; c++) {
    const buttons: number[] = [];
    for (let b = 0; b < 49; b++) {
      buttons.push(
        push({
          label: `btn-${c}-${b}`,
          elementType: "Button",
          style: {},
          text: `Button ${b % 10}`,
        }),
      );
    }
    containers.push(
      push({
        label: `block-${c}`,
        style: { display: "block", width: AVAIL_W },
        children: buttons,
      }),
    );
  }
  push({
    label: "root",
    style: { display: "block", width: AVAIL_W },
    children: containers,
  });
  return nodes;
}

// ── pipelineLeg 미러 (map 구성만) ──

interface PipelineMaps {
  pageId: string;
  rootId: string;
  elementsMap: Map<string, CanvasLayoutNode>;
  childrenMap: Map<string, string[]>;
  getChild: (id: string) => CanvasLayoutNode[];
}

let pageSeq = 0;
function buildPipelineMaps(nodes: CaseNode[]): PipelineMaps {
  const rootIdx = nodes.length - 1;
  const ids = nodes.map((_, i) => `p${i}`);
  const pageId = `adr923-baseline-${pageSeq++}`;
  const elementsMap = new Map<string, CanvasLayoutNode>();
  const childrenMap = new Map<string, string[]>();
  nodes.forEach((node, i) => {
    const style: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node.style)) {
      style[k] = Array.isArray(v) ? v.join(" ") : v;
    }
    childrenMap.set(
      ids[i],
      (node.children ?? []).map((ci) => ids[ci]),
    );
    elementsMap.set(ids[i], {
      id: ids[i],
      type: node.elementType ?? "box",
      page_id: i === rootIdx ? pageId : null,
      props:
        node.text !== undefined ? { children: node.text, style } : { style },
    } as unknown as CanvasLayoutNode);
  });
  const getChild = (id: string): CanvasLayoutNode[] =>
    (childrenMap.get(id) ?? []).map((cid) => elementsMap.get(cid)!);
  return { pageId, rootId: ids[rootIdx], elementsMap, childrenMap, getChild };
}

function nearestRank(sorted: number[], q: number): number {
  const rank = Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1);
  return sorted[Math.max(0, rank)];
}

function measureArm(arm: string, shape: string, nodes: CaseNode[]): ArmStats {
  const maps = buildPipelineMaps(nodes);
  const samples: number[] = [];
  for (let run = 0; run < WARMUP_RUNS + MEASURED_RUNS; run++) {
    resetPersistentTree(maps.pageId);
    const t0 = performance.now();
    const result = calculateFullTreeLayout(
      maps.rootId,
      maps.elementsMap,
      maps.childrenMap,
      AVAIL_W,
      AVAIL_H,
      maps.getChild,
    );
    const t1 = performance.now();
    if (!result) {
      throw new Error(
        `[ADR-923 baseline] calculateFullTreeLayout null (arm ${arm}, run ${run}) — composition-engine WASM 미준비 확인`,
      );
    }
    if (result.size !== nodes.length) {
      throw new Error(
        `[ADR-923 baseline] layout 결과 ${result.size} ≠ 노드 ${nodes.length} (arm ${arm})`,
      );
    }
    if (run >= WARMUP_RUNS) samples.push(t1 - t0);
  }
  resetPersistentTree(maps.pageId);

  const sorted = [...samples].sort((a, b) => a - b);
  const containerCount = nodes.filter(
    (n) => (n.children ?? []).length > 0,
  ).length;
  const round = (v: number): number => Math.round(v * 1000) / 1000;
  return {
    arm,
    shape,
    nodeCount: nodes.length,
    containerCount,
    leafCount: nodes.length - containerCount,
    warmupRuns: WARMUP_RUNS,
    measuredRuns: MEASURED_RUNS,
    p50Ms: round(nearestRank(sorted, 0.5)),
    p95Ms: round(nearestRank(sorted, 0.95)),
    minMs: round(sorted[0]),
    maxMs: round(sorted[sorted.length - 1]),
    meanMs: round(samples.reduce((a, b) => a + b, 0) / samples.length),
    samplesMs: samples.map(round),
  };
}

describe.skipIf(!ENABLED)(
  "ADR-923 Phase 0 §D — calculateFullTreeLayout 5k baseline (VITE_ADR923_BASELINE=1)",
  () => {
    let result: BaselineResult;

    beforeAll(async () => {
      await initCompositionEngineWasm();
      const armF = measureArm(
        "F-flex",
        "root flex-column > 8 flex-row(wrap) > 8 flex-column > 8 flex-row(wrap) > 9 box(40x20)",
        buildFlexArm(),
      );
      const armB = measureArm(
        "B-block",
        "root block > 100 block(width 1200) > 49 catalog Button(style {}, text 'Button N')",
        buildBlockArm(),
      );
      result = {
        adr: "923",
        phase: "0",
        measuredAt: new Date().toISOString(),
        availW: AVAIL_W,
        availH: AVAIL_H,
        environment: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          hardwareConcurrency: navigator.hardwareConcurrency,
          devicePixelRatio: window.devicePixelRatio,
          viewport: { width: window.innerWidth, height: window.innerHeight },
          visibilityState: document.visibilityState,
        },
        arms: [armF, armB],
      };
      console.log(
        "[ADR-923 baseline]",
        JSON.stringify(result.arms.map(({ samplesMs: _s, ...rest }) => rest)),
      );
      const { server } = await import("vitest/browser");
      await server.commands.writeFile(
        ARTIFACT,
        JSON.stringify(result, null, 2),
      );
    });

    it("arm F (flex 위주) ≈5k 노드 p50/p95 를 기록한다", () => {
      const armF = result.arms[0];
      expect(armF.nodeCount).toBeGreaterThanOrEqual(5000);
      expect(armF.samplesMs).toHaveLength(MEASURED_RUNS);
      expect(armF.p95Ms).toBeGreaterThan(0);
      expect(armF.p50Ms).toBeLessThanOrEqual(armF.p95Ms);
    });

    it("arm B (block 위주 — 불리 케이스) ≈5k 노드 p50/p95 를 기록한다", () => {
      const armB = result.arms[1];
      expect(armB.nodeCount).toBeGreaterThanOrEqual(5000);
      expect(armB.samplesMs).toHaveLength(MEASURED_RUNS);
      expect(armB.p95Ms).toBeGreaterThan(0);
      expect(armB.p50Ms).toBeLessThanOrEqual(armB.p95Ms);
    });
  },
);
