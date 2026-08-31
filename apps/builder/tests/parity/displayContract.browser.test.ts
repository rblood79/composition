import { beforeAll, describe, expect, it, vi } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import { CompositionEngineLayout } from "@/builder/workspace/canvas/wasm-bindings/compositionEngine";
import type { CaseNode } from "./harness";
import { pipelineLeg } from "./harness";

/**
 * ADR-923 G0: style 없는 catalog Button의 wasm 경계 display를 고정한다.
 * 현재 계약과 달라 `it.fails`로 두며, Phase 5 뒤 일반 `it`로 전환한다.
 * 캡처는 `toTaffyDisplay` 결과가 아닌 pipelineLeg의 `buildTreeBatch` JSON 인자다.
 */

interface BatchNode {
  style: Record<string, unknown>;
  children: number[];
}

interface BatchCall {
  callNumber: number;
  json: string;
  nodes: BatchNode[];
}

interface BatchCapture {
  calls: BatchCall[];
  selected: BatchCall;
  parentIndex: number;
  buttonAIndex: number;
  buttonBIndex: number;
}

const NODES: CaseNode[] = [
  { label: "btn-a", elementType: "Button", style: {}, text: "A" },
  { label: "btn-b", elementType: "Button", style: {}, text: "B" },
  {
    label: "parent",
    elementType: "box",
    style: { display: "block", width: 400 },
    children: [0, 1],
  },
];

let capture: BatchCapture;

function parseBatchNode(value: unknown, nodeIndex: number): BatchNode {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`buildTreeBatch node ${nodeIndex} is not an object`);
  }

  const record = value as { style?: unknown; children?: unknown };
  if (
    record.style === null ||
    typeof record.style !== "object" ||
    Array.isArray(record.style)
  ) {
    throw new Error(`buildTreeBatch node ${nodeIndex} has no style record`);
  }
  if (
    !Array.isArray(record.children) ||
    !record.children.every((child) => Number.isInteger(child))
  ) {
    throw new Error(`buildTreeBatch node ${nodeIndex} has invalid children`);
  }

  return {
    style: record.style as Record<string, unknown>,
    children: record.children as number[],
  };
}

function parseBatchCall(json: string, callNumber: number): BatchCall {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    throw new Error(`buildTreeBatch call ${callNumber} is not a batch array`);
  }

  return {
    callNumber,
    json,
    nodes: parsed.map((node, nodeIndex) => parseBatchNode(node, nodeIndex)),
  };
}

function captureBuildTreeBatch(): BatchCapture {
  const jsonSpy = vi.spyOn(CompositionEngineLayout.prototype, "buildTreeBatch");
  const binarySpy = vi.spyOn(
    CompositionEngineLayout.prototype,
    "buildTreeBatchBinary",
  );

  try {
    pipelineLeg(NODES, 400, -1);

    if (binarySpy.mock.calls.length > 0) {
      console.log("[ADR-923 G0 binary calls]", binarySpy.mock.calls);
      throw new Error(
        `buildTreeBatchBinary unexpectedly called ${binarySpy.mock.calls.length} time(s)`,
      );
    }

    const calls = jsonSpy.mock.calls.map(([json], index) =>
      parseBatchCall(json, index + 1),
    );
    if (calls.length === 0) {
      throw new Error("buildTreeBatch was not called by pipelineLeg");
    }

    const threeNodeCalls = calls.filter((call) => call.nodes.length === 3);
    const selected =
      threeNodeCalls[threeNodeCalls.length - 1] ?? calls[calls.length - 1];
    const parentIndex = selected.nodes.findIndex(
      (node) => node.children.length === 2,
    );
    if (parentIndex === -1) {
      throw new Error("captured batch has no two-child parent node");
    }

    const [buttonAIndex, buttonBIndex] = selected.nodes[parentIndex].children;
    if (
      selected.nodes[buttonAIndex] === undefined ||
      selected.nodes[buttonBIndex] === undefined
    ) {
      throw new Error("captured parent children do not identify both Buttons");
    }

    return {
      calls,
      selected,
      parentIndex,
      buttonAIndex,
      buttonBIndex,
    };
  } finally {
    jsonSpy.mockRestore();
    binarySpy.mockRestore();
  }
}

function buttonDisplay(): unknown {
  return capture.selected.nodes[capture.buttonAIndex].style.display;
}

function parentDisplay(): unknown {
  return capture.selected.nodes[capture.parentIndex].style.display;
}

function logRawCapture(): void {
  console.log("[ADR-923 G0 raw]", capture.selected.json);
  console.log("[ADR-923 G0 capture]", {
    callCount: capture.calls.length,
    selectedCall: capture.selected.callNumber,
    selectedNodeCount: capture.selected.nodes.length,
    parentIndex: capture.parentIndex,
    buttonAIndex: capture.buttonAIndex,
    buttonBIndex: capture.buttonBIndex,
  });
}

beforeAll(async () => {
  await initCompositionEngineWasm();
  capture = captureBuildTreeBatch();

  const { server } = await import("vitest/browser");
  await server.commands.writeFile(
    "tests/parity/.artifacts/adr-923-g0-capture.json",
    capture.selected.json,
  );
});

describe("ADR-923 G0 — catalog Button wasm 경계 display", () => {
  it.fails("(a)/(b) 현재 경계값은 C′ 계약과 다르다", () => {
    logRawCapture();
    console.log("[ADR-923 G0 (a)]", buttonDisplay());
    expect.soft(buttonDisplay()).toBe("inline-flex");

    logRawCapture();
    console.log("[ADR-923 G0 (b)]", parentDisplay());
    expect.soft(parentDisplay()).toBe("block");
  });

  it("(c) Button subtree는 flex solver 입력을 받는다", () => {
    logRawCapture();
    console.log("[ADR-923 G0 (c)]", buttonDisplay());
    expect(["flex", "inline-flex"]).toContain(buttonDisplay());
  });
});
