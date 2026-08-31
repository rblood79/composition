import { beforeAll, describe, expect, it, vi } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import { CompositionEngineLayout } from "@/builder/workspace/canvas/wasm-bindings/compositionEngine";
import type { LayoutResult } from "@/builder/workspace/canvas/wasm-bindings/compositionEngine";
import type { CaseNode } from "./harness";
import { pipelineLeg } from "./harness";

/**
 * ADR-923 Phase 2 — baseline 계약의 wasm 경계 왕복 검증 (실 브라우저).
 *
 * 입력: 텍스트 leaf(Text) 의 batch record 에 enrichWithIntrinsicSize 가 주입한
 *   `leafBaseline`(측정 스칼라, content-box 상단 기준 px) 이 실려 도달한다 —
 *   contentMin/MaxWidth 와 같은 공급 채널 (utils.ts → applyCommonTaffyStyle →
 *   taffyStyleToRecord → buildTreeBatch JSON).
 * 출력: `getLayoutsBatch` 의 `LayoutResult.baseline` (stride 5) — 엔진이 원천 없는
 *   노드를 height(bottom 폴백, CSS 2.1 §10.8.1)로 해소하므로 모든 노드에서 숫자다.
 *
 * r6h1 교훈(seam 검증은 경계 도달값으로): batch 를 다시 쓰는 경로(post-order patch)
 * 가 있어도 최종 buildTreeBatch JSON 캡처가 판정 기준이다.
 */

const NODES: CaseNode[] = [
  {
    label: "text",
    elementType: "Text",
    // width intrinsic 키워드 → enrichWithIntrinsicSize 의 스칼라 주입 트리거
    // (block 자식은 stretch 라 기본 미주입 — needsWidth 조건, utils.ts).
    // lineHeight px 문자열: post-order patch / 2-pass 재-enrich 경로가 raw 복사하면
    // 엔진 Option<f32> serde 가 터진다 (r6h1 과 동일 기전 — 이 케이스가 가드).
    style: { fontSize: 16, width: "fit-content", lineHeight: "20px" },
    text: "baseline probe wraps here",
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

let batches: BatchNode[][];
let layoutMaps: Map<number, LayoutResult>[];
let styleWrites: Record<string, unknown>[];

beforeAll(async () => {
  await initCompositionEngineWasm();
  const jsonSpy = vi.spyOn(CompositionEngineLayout.prototype, "buildTreeBatch");
  const outSpy = vi.spyOn(CompositionEngineLayout.prototype, "getLayoutsBatch");
  // r6h1 교훈: batch 를 다시 쓰는 **모든** writer 를 캡처 — 2-pass 재-enrich /
  // post-order patch 는 updateStyleRaw 로 나간다 (buildTreeBatch 만 보면 누락).
  const updSpy = vi.spyOn(CompositionEngineLayout.prototype, "updateStyleRaw");
  try {
    pipelineLeg(NODES, 400, -1);
    batches = jsonSpy.mock.calls.map(
      ([json]) => JSON.parse(json) as BatchNode[],
    );
    styleWrites = [
      ...batches.flat().map((n) => n.style),
      ...updSpy.mock.calls.map(
        ([, json]) => JSON.parse(json) as Record<string, unknown>,
      ),
    ];
    layoutMaps = outSpy.mock.results
      .filter((r) => r.type === "return")
      .map((r) => r.value as Map<number, LayoutResult>);
  } finally {
    jsonSpy.mockRestore();
    outSpy.mockRestore();
    updSpy.mockRestore();
  }
});

describe("ADR-923 Phase 2 — baseline 입력/출력 wasm 경계 계약", () => {
  it("텍스트 leaf 의 batch record 에 leafBaseline 측정 스칼라가 실린다", () => {
    expect(batches.length).toBeGreaterThan(0);
    const textRecords = batches
      .flat()
      .filter((n) => typeof n.style.contentMaxWidth === "number");
    expect(textRecords.length).toBeGreaterThan(0);
    for (const rec of textRecords) {
      expect(typeof rec.style.leafBaseline).toBe("number");
      expect(rec.style.leafBaseline as number).toBeGreaterThan(0);
    }
  });

  it("모든 엔진 style write 에서 lineHeight 는 px 숫자다 (raw 문자열 금지 — NodeStyle Option<f32>)", () => {
    expect(styleWrites.length).toBeGreaterThan(0);
    const offenders = styleWrites
      .filter(
        (s) => s.lineHeight !== undefined && typeof s.lineHeight !== "number",
      )
      .map((s) => s.lineHeight);
    expect(offenders).toEqual([]);
  });

  it("getLayoutsBatch 가 노드마다 숫자 baseline 을 낸다 (stride 5, height 폴백 포함)", () => {
    expect(layoutMaps.length).toBeGreaterThan(0);
    const results = layoutMaps.flatMap((m) => [...m.values()]);
    expect(results.length).toBeGreaterThan(0);
    for (const l of results) {
      expect(typeof l.baseline).toBe("number");
      expect(Number.isFinite(l.baseline)).toBe(true);
      // 원천 없는 box 도 경계에서는 height 폴백 — 절대 undefined/NaN 아님.
      expect((l.baseline as number) >= 0).toBe(true);
    }
  });
});
