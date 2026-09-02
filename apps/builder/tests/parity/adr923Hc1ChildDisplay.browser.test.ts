import { beforeAll, describe, expect, it, vi } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import { CompositionEngineLayout } from "@/builder/workspace/canvas/wasm-bindings/compositionEngine";
import type { CaseNode } from "./harness";
import { pipelineLeg } from "./harness";

/**
 * ADR-923 Phase 4 — **HC1**: 부모가 자식을 분류할 때 쓰는 `childDisplays[i]` 는 자식 노드 자신이
 * 엔진에 보내는 `display` 와 같아야 한다 (같은 요소에 대한 두 시각이 갈리면 부모는 IFC 시뮬레이션을,
 * 자식은 flex solver 를 타는 이원 상태가 된다 — ADR-923 Context 의 사실 4·5).
 *
 * 캡처는 production 진입점(`calculateFullTreeLayout` = pipelineLeg) 을 그대로 돌리며:
 *   - 부모 시각 = `toTaffyDisplay(display, childDisplays, …)` 의 `childDisplays` 인자 (module mock 으로 기록)
 *   - 자식 시각 = `buildTreeBatch` JSON 인자의 자식 노드 `style.display` (wasm 경계 실제 도달값)
 *
 * 현재 Button 은 부모가 `INLINE_BLOCK_TAGS → inline-block`, 자식 자신은 catalog fallback → `flex`
 * 로 갈린다 → `it.fails` 로 고정. Phase 5 (getElementDisplay → resolveDefaultDisplay 배선 + S9) 가
 * 두 값을 `inline-flex` 로 맞추면 일반 `it` 로 전환한다. 대조군(명시 display 자식) 은 지금도 통과해
 * 캡처 자체가 살아 있음을 보인다.
 */
interface DisplayCall {
  display: string;
  childDisplays: string[];
}
const CALLS: DisplayCall[] = [];

vi.mock(
  "@/builder/workspace/canvas/layout/engines/taffyDisplayAdapter",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/builder/workspace/canvas/layout/engines/taffyDisplayAdapter")
      >();
    return {
      ...actual,
      toTaffyDisplay: (
        display: string,
        childDisplays: string[],
        childElements?: unknown,
      ) => {
        CALLS.push({ display, childDisplays: [...childDisplays] });
        return actual.toTaffyDisplay(
          display,
          childDisplays,
          childElements as Parameters<typeof actual.toTaffyDisplay>[2],
        );
      },
    };
  },
);

interface BatchNode {
  style: Record<string, unknown>;
  children: number[];
}

function captureCase(nodes: CaseNode[]): {
  parentChildDisplays: string[];
  batchChildDisplays: string[];
} {
  CALLS.length = 0;
  const jsonSpy = vi.spyOn(CompositionEngineLayout.prototype, "buildTreeBatch");
  try {
    pipelineLeg(nodes, 400, -1);
    const calls = jsonSpy.mock.calls.map(
      ([json]) => JSON.parse(json) as BatchNode[],
    );
    const batch =
      calls.filter((b) => b.length === nodes.length).at(-1) ?? calls.at(-1);
    if (!batch) throw new Error("buildTreeBatch 미호출");
    const parentIdx = batch.findIndex((n) => n.children.length === 2);
    if (parentIdx === -1) throw new Error("두 자식 부모 노드 없음");
    const batchChildDisplays = batch[parentIdx].children.map((ci) =>
      String(batch[ci].style.display ?? ""),
    );
    // 부모(block) 는 toTaffyDisplay 를 한 번 부른다 — childDisplays 길이 2 인 호출.
    const parentCall = CALLS.filter((c) => c.childDisplays.length === 2).at(-1);
    if (!parentCall)
      throw new Error("부모 toTaffyDisplay 호출 미캡처 (mock 미적용?)");
    return {
      parentChildDisplays: parentCall.childDisplays,
      batchChildDisplays,
    };
  } finally {
    jsonSpy.mockRestore();
  }
}

describe("ADR-923 HC1 — childDisplays[i] == 자식 노드의 엔진 도달 display", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it("대조군: 명시 display 자식(block box 2) 은 두 시각이 같다", () => {
    const { parentChildDisplays, batchChildDisplays } = captureCase([
      {
        label: "a",
        elementType: "box",
        style: { display: "block", height: 20 },
      },
      {
        label: "b",
        elementType: "box",
        style: { display: "block", height: 20 },
      },
      {
        label: "parent",
        elementType: "box",
        style: { display: "block", width: 400 },
        children: [0, 1],
      },
    ]);
    expect(parentChildDisplays).toEqual(["block", "block"]);
    expect(batchChildDisplays).toEqual(parentChildDisplays);
  });

  it.fails(
    "style 없는 catalog Button 2 — 부모 시각(inline-block) ≠ 자식 도달값(flex) [Phase 5 에서 pass 전환]",
    () => {
      const { parentChildDisplays, batchChildDisplays } = captureCase([
        { label: "btn-a", elementType: "Button", style: {}, text: "A" },
        { label: "btn-b", elementType: "Button", style: {}, text: "B" },
        {
          label: "parent",
          elementType: "box",
          style: { display: "block", width: 400 },
          children: [0, 1],
        },
      ]);
      expect(batchChildDisplays).toEqual(parentChildDisplays);
    },
  );

  it("현재 사실 고정: Button 은 부모 inline-block / 자식 flex (Phase 5 의도된 diff 목록의 근거)", () => {
    const { parentChildDisplays, batchChildDisplays } = captureCase([
      { label: "btn-a", elementType: "Button", style: {}, text: "A" },
      { label: "btn-b", elementType: "Button", style: {}, text: "B" },
      {
        label: "parent",
        elementType: "box",
        style: { display: "block", width: 400 },
        children: [0, 1],
      },
    ]);
    expect(parentChildDisplays).toEqual(["inline-block", "inline-block"]);
    expect(batchChildDisplays).toEqual(["flex", "flex"]);
  });
});
