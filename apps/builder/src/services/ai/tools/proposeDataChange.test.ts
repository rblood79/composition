/**
 * ADR-213 Phase 4 — `propose_data_change` (G2 정적 부분).
 *
 * - 스키마는 `modelFacingDataChangeJsonSchema` 파생 (definitions.ts 에 손으로 쓴 두 번째 스키마 없음)
 * - origin 입력 · 사람 전용 op (delete_*) · 빈 ops → invalid, 승인 요청 0
 * - 승인 → dispatcher 1회 (origin:"ai" · host:"ai-panel") · 거부 → 실패 안내
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  HUMAN_ONLY_DATA_OPS,
  modelFacingDataChangeJsonSchema,
} from "@composition/shared";
import type { ToolTranslate } from "../../../types/integrations/ai.types";

const dispatch = vi.fn();
vi.mock("../data/dataProposalDispatcher", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../data/dataProposalDispatcher")>();
  return {
    ...original,
    dispatchDataProposal: (...args: unknown[]) => dispatch(...args),
  };
});

import { toolDefinitions } from "./definitions";
import { proposeDataChangeTool } from "./proposeDataChange";

const t: ToolTranslate = (key, params) =>
  params ? `${key}:${JSON.stringify(params)}` : key;

describe("propose_data_change 정의", () => {
  it("parameters 가 dataChange.ts 파생과 동일 (origin 없음 · 사람 전용 op 없음 · restore 없음)", () => {
    const def = toolDefinitions.find(
      (d) => d.function.name === "propose_data_change",
    )!;
    expect(def).toBeDefined();
    expect(def.function.parameters).toEqual(modelFacingDataChangeJsonSchema());
    const serialized = JSON.stringify(def.function.parameters);
    expect(serialized).not.toContain('"origin"');
    expect(serialized).not.toContain('"restore"');
    for (const op of HUMAN_ONLY_DATA_OPS) {
      expect(serialized).not.toContain(`"${op}"`);
    }
    expect(serialized).toContain('"define_endpoint"');
    expect(serialized).toContain('"bind_element"');
  });
});

describe("propose_data_change 실행", () => {
  beforeEach(() => vi.clearAllMocks());

  it("빈 ops · origin 동봉은 dispatcher 호출 0", async () => {
    expect(await proposeDataChangeTool.execute({ ops: [] }, t)).toEqual({
      success: false,
      error: "aiToolError.proposalOpsRequired",
    });
    expect(
      await proposeDataChangeTool.execute(
        {
          ops: [{ op: "bind_element", elementId: "e1", collectionId: "c1" }],
          origin: "user",
        },
        t,
      ),
    ).toEqual({ success: false, error: "aiToolError.proposalOriginForbidden" });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("승인 → dispatcher 1회 (origin ai · host ai-panel · label) → applied + historyId", async () => {
    dispatch.mockResolvedValueOnce({
      status: "applied",
      historyId: 4,
      opsCount: 2,
    });
    const ops = [
      {
        op: "define_endpoint",
        endpoint: {
          id: "ep1",
          name: "x",
          method: "GET",
          baseUrl: "https://h",
          path: "/p",
        },
      },
      { op: "bind_element", elementId: "e1", collectionId: "c1" },
    ];
    const result = await proposeDataChangeTool.execute(
      { ops, label: "  fix auth  " },
      t,
    );
    expect(result).toEqual({
      success: true,
      data: { status: "applied", opsCount: 2, historyId: 4 },
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toEqual({
      ops,
      label: "fix auth",
      host: "ai-panel",
      origin: "ai",
    });
  });

  it("op 하나를 최상위에 펼쳐 보내면 (ops 없이) 한 개짜리 제안으로 읽는다 — live qwen3 형태", async () => {
    dispatch.mockResolvedValueOnce({
      status: "applied",
      historyId: 1,
      opsCount: 1,
    });
    const result = await proposeDataChangeTool.execute(
      {
        op: "define_endpoint",
        endpoint: {
          id: "ep1",
          name: "x",
          method: "GET",
          baseUrl: "https://h",
          path: "/p",
        },
        label: "flat",
      },
      t,
    );
    expect(result.success).toBe(true);
    expect(dispatch.mock.calls[0][0]).toMatchObject({
      ops: [{ op: "define_endpoint", endpoint: { id: "ep1" } }],
      label: "flat",
    });
    expect(dispatch.mock.calls[0][0].ops[0]).not.toHaveProperty("label");
  });

  it("거부 · invalid 는 실패 안내 (직접 적용 경로 없음)", async () => {
    dispatch.mockResolvedValueOnce({ status: "rejected", opsCount: 1 });
    expect(
      await proposeDataChangeTool.execute(
        { ops: [{ op: "bind_element", elementId: "e1", collectionId: "c1" }] },
        t,
      ),
    ).toEqual({ success: false, error: "aiDataProposal.rejected" });
    dispatch.mockResolvedValueOnce({
      status: "invalid",
      errors: ["ops.0: delete_collection 는 사람 UI 전용입니다"],
    });
    const invalid = await proposeDataChangeTool.execute(
      { ops: [{ op: "delete_collection", collectionId: "c1" }] },
      t,
    );
    expect(invalid.success).toBe(false);
    expect(invalid.error).toContain("delete_collection");
  });
});
