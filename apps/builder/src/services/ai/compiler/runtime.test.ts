import { beforeEach, describe, expect, it, vi } from "vitest";
const harness = vi.hoisted(() => ({
  execute: vi.fn(async () => ({
    success: true,
    data: { elementId: "created" },
  })),
  resolve: vi.fn(),
  identity: "page:selection",
}));
vi.mock("./builderHost", () => ({
  readCompilerState: () => ({
    identity: harness.identity,
    manifest: {
      components: [
        {
          type: "Button",
          label: "Button",
          placeable: true,
          creationMode: "leaf",
          props: [],
        },
      ],
      commands: [],
    },
    context: {
      parentId: "body",
      selectedId: null,
      nodes: [{ id: "body", type: "body" }],
    },
  }),
}));
vi.mock("../tools", () => ({
  createToolRegistry: () =>
    new Map([["create_element", { execute: harness.execute }]]),
}));
vi.mock("../providers/agentProfiles", () => ({
  resolveProvider: harness.resolve,
}));
import {
  clearCompilerMetrics,
  getCompilerMetrics,
  runCompilerRequest,
} from "./runtime";
import type { ToolTranslate } from "../../../types/integrations/ai.types";
const t: ToolTranslate = (key) => key;
const program = {
  version: 1,
  source: "llm",
  operations: [
    { op: "create_element", args: { type: "Button", parentId: "body" } },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  clearCompilerMetrics();
  harness.identity = "page:selection";
});
describe("ADR-202 runtime routing", () => {
  it("direct는 provider를 조회조차 하지 않고 기존 executor 1회만 호출한다", async () => {
    const result = await runCompilerRequest(
      "버튼 생성해",
      t,
      new AbortController().signal,
    );
    expect(result.result?.success).toBe(true);
    expect(harness.resolve).not.toHaveBeenCalled();
    expect(harness.execute).toHaveBeenCalledExactlyOnceWith(
      { type: "Button", parentId: "body" },
      t,
    );
    expect(getCompilerMetrics()).toMatchObject([
      { route: "direct", providerCalls: 0, toolExecutions: 1 },
    ]);
  });
  it("one-shot은 provider 1회, 같은 IR 검증 뒤 기존 executor를 쓴다", async () => {
    const completeWithTools = vi.fn(async function* () {
      yield { type: "text-delta", delta: JSON.stringify(program) };
      yield { type: "stop", reason: "end" };
    });
    harness.resolve.mockReturnValue({ id: "anthropic", completeWithTools });
    const result = await runCompilerRequest(
      "간단한 컨트롤을 만들어",
      t,
      new AbortController().signal,
    );
    expect(result.result?.success).toBe(true);
    expect(completeWithTools).toHaveBeenCalledTimes(1);
    expect(harness.execute).toHaveBeenCalledTimes(1);
    expect(completeWithTools.mock.calls[0]).toBeDefined();
  });
  it.each([
    "malformed",
    "extra",
    "version",
    "context",
    "truncated",
    "tool-call",
    "source",
    "empty",
  ])("%s 응답은 실행 0이며 Agent로 재시도하지 않는다", async (failure) => {
    const completeWithTools = vi.fn(async function* () {
      if (failure === "context") harness.identity = "another-page";
      if (failure === "tool-call")
        yield {
          type: "tool-call",
          call: { id: "a", name: "create_element", arguments: "{}" },
        };
      const raw =
        failure === "extra"
          ? { ...program, unexpected: true }
          : failure === "version"
            ? { ...program, version: 2 }
            : failure === "source"
              ? { ...program, source: "compiler" }
              : failure === "empty"
                ? { ...program, operations: [] }
                : program;
      yield {
        type: "text-delta",
        delta: failure === "malformed" ? "not json" : JSON.stringify(raw),
      };
      yield {
        type: "stop",
        reason: failure === "truncated" ? "max-tokens" : "end",
      };
    });
    harness.resolve.mockReturnValue({ id: "anthropic", completeWithTools });
    const result = await runCompilerRequest(
      "간단한 컨트롤을 만들어",
      t,
      new AbortController().signal,
    );
    expect(result.handled).toBe(true);
    expect(result.result?.success).toBe(false);
    expect(harness.execute).not.toHaveBeenCalled();
    expect(completeWithTools).toHaveBeenCalledTimes(1);
  });
  it("취소된 direct 요청은 실행하지 않는다", async () => {
    const abort = new AbortController();
    abort.abort();
    await runCompilerRequest("버튼 생성해", t, abort.signal);
    expect(harness.execute).not.toHaveBeenCalled();
  });
  it("미검증 OpenAI-compatible one-shot은 기존 Agent fallback을 유지한다", async () => {
    const completeWithTools = vi.fn();
    harness.resolve.mockReturnValue({
      id: "openai-compatible",
      completeWithTools,
    });
    const result = await runCompilerRequest(
      "새로운 영역 만들어",
      t,
      new AbortController().signal,
    );
    expect(result).toMatchObject({ handled: false, route: "legacy" });
    expect(completeWithTools).not.toHaveBeenCalled();
    expect(harness.execute).not.toHaveBeenCalled();
  });
});

describe("표시된 로컬 작업의 실행", () => {
  it("자연어 라벨을 다시 해석하지 않고 같은 validator/executor로 실행한다", async () => {
    const proposal = {
      identity: harness.identity,
      program: { ...program, source: "compiler" as const },
    };
    const result = await runCompilerRequest(
      "확인 버튼 작업",
      t,
      new AbortController().signal,
      proposal as never,
    );
    expect(result.result?.success).toBe(true);
    expect(harness.execute).toHaveBeenCalledTimes(1);
    expect(harness.resolve).not.toHaveBeenCalled();
  });
  it("추천 이후 선택이 바뀌면 실행도 모델 호출도 하지 않는다", async () => {
    const result = await runCompilerRequest(
      "확인 버튼 작업",
      t,
      new AbortController().signal,
      {
        identity: "old-selection",
        program: { ...program, source: "compiler" },
      } as never,
    );
    expect(result.result).toMatchObject({
      success: false,
      error: "context-changed",
    });
    expect(harness.execute).not.toHaveBeenCalled();
    expect(harness.resolve).not.toHaveBeenCalled();
  });
  it("로컬 proposal도 추가 operation이나 잘못된 source를 우회시키지 못한다", async () => {
    for (const invalid of [
      {
        ...program,
        source: "compiler",
        operations: [...program.operations, ...program.operations],
      },
      program,
    ]) {
      const result = await runCompilerRequest(
        "작업",
        t,
        new AbortController().signal,
        { identity: harness.identity, program: invalid } as never,
      );
      expect(result.result?.success).toBe(false);
    }
    expect(harness.execute).not.toHaveBeenCalled();
  });
});
