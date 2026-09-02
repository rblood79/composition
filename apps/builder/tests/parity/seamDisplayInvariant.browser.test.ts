import { beforeAll, describe, expect, it, vi } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import { CompositionEngineLayout } from "@/builder/workspace/canvas/wasm-bindings/compositionEngine";
import type { CaseNode } from "./harness";
import { pipelineLeg } from "./harness";

/**
 * ADR-923 HC7 seam 불변식 (Phase 1~4): wasm 경계 `buildTreeBatch` JSON 의 `display` 는 TS
 * 운반 union `TaffyDisplay`("flex" | "grid" | "block" | "none") 안이다 — inline-flex /
 * inline-grid / inline-block 은 Phase 5 cutover 전까지 엔진에 도달하지 않는다. Phase 1 이
 * 엔진의 outer → line item 판정을 켰으므로, 이 불변식이 깨지면 프로덕션 배치가 phase 경계
 * 밖에서 바뀐다 (reviews/923.md round 6 r6h1: `patchBatchStyleFromImplicit` 가 raw display
 * 를 batch 에 다시 써 union 을 우회했다 — Label 공통 주입(flexShrink) 이 style 을 clone 하는
 * 경우 등).
 *
 * 케이스: block 부모 아래 `Label(style.display: inline-flex)` — applyImplicitStyles 의 Label
 * 공통 주입이 style 을 clone → post-order patch 경로 진입 → raw display 복사 (수리 전).
 *
 * **Phase 5 (2026-09-02) 에서 반전됐다** — 이제 CSS 값 통과가 계약이다: 경계 display 는 CSS 8 값
 * union 안이고 (`normalizeCssDisplay` — 미인식만 block), Label 의 `inline-flex` 는 접히지 않고 도달한다.
 */

/** Phase 5 운반 union (`layoutTypes.ts` `TaffyDisplay`) — CSS 값 그대로. */
const BATCH_DISPLAY_UNION: ReadonlySet<string> = new Set([
  "block",
  "inline",
  "inline-block",
  "flex",
  "inline-flex",
  "grid",
  "inline-grid",
  "none",
]);

const NODES: CaseNode[] = [
  {
    label: "label",
    elementType: "Label",
    style: { display: "inline-flex" },
    text: "Label",
  },
  { label: "sibling", style: { width: 40, height: 20 } },
  {
    label: "parent",
    style: { display: "block", width: 400 },
    children: [0, 1],
  },
];

interface BatchNode {
  style: Record<string, unknown>;
  children: number[];
}

interface Offender {
  call: number;
  node: number;
  display: unknown;
}

function captureAllBatches(): BatchNode[][] {
  const jsonSpy = vi.spyOn(CompositionEngineLayout.prototype, "buildTreeBatch");
  try {
    pipelineLeg(NODES, 400, -1);
    return jsonSpy.mock.calls.map(([json]) => JSON.parse(json) as BatchNode[]);
  } finally {
    jsonSpy.mockRestore();
  }
}

let batches: BatchNode[][];

beforeAll(async () => {
  await initCompositionEngineWasm();
  batches = captureAllBatches();
});

describe("ADR-923 HC7 (Phase 5 반전) — wasm 경계 display 는 CSS 값 그대로 (inline-* 보존)", () => {
  it("post-order implicit patch 경로(Label)를 지나도 inline-flex 가 그대로 경계에 도달한다", () => {
    expect(batches.length).toBeGreaterThan(0);
    const displays = batches.map((nodes) => nodes.map((n) => n.style.display));
    console.log("[ADR-923 HC7 seam]", JSON.stringify(displays));
    const offenders: Offender[] = batches.flatMap((nodes, call) =>
      nodes.flatMap((n, node) => {
        const d = n.style.display;
        return d !== undefined && !BATCH_DISPLAY_UNION.has(String(d))
          ? [{ call, node, display: d }]
          : [];
      }),
    );
    expect(offenders).toEqual([]);
    // 반전 핵심: Label 의 inline-flex 가 지워지지 않고 경계에 닿는다 (Phase 4 까지는 flex 로 접혔다).
    const reached = batches.flatMap((nodes) =>
      nodes.map((n) => n.style.display),
    );
    expect(reached).toContain("inline-flex");
    expect(reached).not.toContain("flow-root");
  });
});
