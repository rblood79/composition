/**
 * ADR-213 Phase 2 (G4 정적 부분) — `bind_collection` 은 compatibility alias 다.
 *
 * - 정상 입력 → `bind_element` 1 op · legacy static → `create_collection` + `bind_element`
 * - legacy api → 안내 오류 (proposal 0)
 * - 실행은 dispatcher 하나를 지난다 — 거부면 문서 무변경 · 승인이면 origin:"ai"
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DataTable } from "../../../types/builder/data.types";
import type { ToolTranslate } from "../../../types/integrations/ai.types";

const dispatch = vi.fn();
vi.mock("../data/dataProposalDispatcher", () => ({
  dispatchDataProposal: (...args: unknown[]) => dispatch(...args),
}));

const collections: DataTable[] = [
  {
    id: "users",
    name: "Users",
    project_id: "p1",
    schema: [{ id: "f_name", key: "name", type: "string" }],
    mockData: [{ name: "a" }],
    useMockData: true,
  },
];
vi.mock("../data/dataToolReadModel", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../data/dataToolReadModel")>();
  return {
    ...original,
    getDataToolReadModel: () => ({
      collections,
      apiEndpoints: [],
      usage: new Map(),
      lastErrors: new Map(),
      runs: new Map(),
    }),
  };
});

vi.mock("./canonicalToolReadModel", () => ({
  getAiToolReadModel: () => ({
    elements: [],
    elementsById: new Map([["lb1", { id: "lb1", type: "ListBox" }]]),
    childrenByParent: new Map(),
    state: { selectedElementId: "lb1" },
  }),
}));

import {
  bindCollectionTool,
  normalizeBindCollectionArgs,
} from "./bindCollection";

const t: ToolTranslate = (key, params) =>
  params ? `${key}:${JSON.stringify(params)}` : key;

describe("normalizeBindCollectionArgs", () => {
  const ctx = { elementId: "lb1", collections, t };

  it("collectionId / collectionName → bind_element (fieldMap 은 value/icon 만)", () => {
    expect(
      normalizeBindCollectionArgs(
        { collectionId: "users", fieldMap: { value: "f_name", label: "x" } },
        ctx,
      ),
    ).toEqual({
      collectionName: "Users",
      ops: [
        {
          op: "bind_element",
          elementId: "lb1",
          collectionId: "users",
          fieldMap: { value: "f_name" },
        },
      ],
    });
    expect(
      normalizeBindCollectionArgs({ collectionName: "Users" }, ctx),
    ).toMatchObject({
      ops: [{ op: "bind_element", collectionId: "users" }],
    });
  });

  it("legacy static → create_collection(스키마 추론 · 행) + bind_element 한 묶음", () => {
    const out = normalizeBindCollectionArgs(
      {
        source: "static",
        config: {
          data: [
            { id: 1, name: "AI 항목 1", done: false },
            { id: 2, name: "AI 항목 2", done: true },
          ],
        },
      },
      ctx,
    );
    expect("ops" in out).toBe(true);
    const ops = (out as { ops: Array<Record<string, unknown>> }).ops;
    expect(ops.map((o) => o.op)).toEqual(["create_collection", "bind_element"]);
    expect(ops[0]).toMatchObject({
      source: "manual",
      rows: [
        { id: 1, name: "AI 항목 1", done: false },
        { id: 2, name: "AI 항목 2", done: true },
      ],
    });
    expect(
      (ops[0].schema as Array<{ key: string; type: string }>).map(
        (f) => `${f.key}:${f.type}`,
      ),
    ).toEqual(["id:number", "name:string", "done:boolean"]);
    expect(ops[1].collectionId).toBe(ops[0].id);
  });

  it("legacy api 는 안내 오류 · 없는 collection 은 복구 안내", () => {
    expect(
      normalizeBindCollectionArgs({ source: "api", config: {} }, ctx),
    ).toEqual({
      error: "aiToolError.bindLegacySourceUnsupported",
    });
    expect(
      (
        normalizeBindCollectionArgs({ collectionId: "nope" }, ctx) as {
          error: string;
        }
      ).error,
    ).toContain("aiToolError.collectionNotFound");
    expect(normalizeBindCollectionArgs({}, ctx)).toEqual({
      error: "aiToolError.collectionRefRequired",
    });
  });
});

describe("bind_collection → dispatcher", () => {
  beforeEach(() => vi.clearAllMocks());

  it("승인되면 success + historyId, dispatcher 에 origin:ai · host:ai-panel 로 1회", async () => {
    dispatch.mockResolvedValueOnce({
      status: "applied",
      historyId: 3,
      opsCount: 1,
    });
    const result = await bindCollectionTool.execute(
      { elementId: "selected", collectionId: "users" },
      t,
    );
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      elementId: "lb1",
      collection: "Users",
      ops: ["bind_element"],
      historyId: 3,
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toMatchObject({
      origin: "ai",
      host: "ai-panel",
      ops: [{ op: "bind_element", elementId: "lb1", collectionId: "users" }],
    });
  });

  it("거부되면 실패 + 안내, 직접 적용 경로 없음", async () => {
    dispatch.mockResolvedValueOnce({ status: "rejected", opsCount: 1 });
    const result = await bindCollectionTool.execute(
      { elementId: "lb1", collectionName: "Users" },
      t,
    );
    expect(result).toEqual({
      success: false,
      error: "aiDataProposal.rejected",
    });
  });

  it("정규화 실패 (legacy api) 는 dispatcher 호출 0", async () => {
    const result = await bindCollectionTool.execute(
      {
        elementId: "lb1",
        source: "api",
        config: { baseUrl: "x", endpoint: "y" },
      },
      t,
    );
    expect(result.success).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
