/**
 * ADR-213 Phase 5 — `DATA_AGENT_COMMANDS` adapter parity (ADR-196 G1 어법).
 *
 * 1. 정적 대조 — adapter 파일이 import 하는 심볼 = 사람 경로 handler 가 부르는 심볼
 *    (`openTableEditor` · `openApiEditor` · `executeApiEndpoint` · `dispatchDataProposal` —
 *    importPaste 의 op 조립은 AI-2 와 같은 `buildPasteProposal`).
 * 2. spy — 각 adapter 가 그 심볼을 정확히 1회, handler 와 같은 인자로 부른다.
 * 3. importPaste — proposal 은 `origin:"agent"` · host 그대로 · create_collection (스키마는
 *    `detectColumns` 추론) 또는 insert_rows (기존 collection) · dispatcher 결과 → outcome 매핑.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolTranslate } from "../../types/integrations/ai.types";

const dispatch = vi.fn();
vi.mock("../ai/data/dataProposalDispatcher", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../ai/data/dataProposalDispatcher")>();
  return {
    ...original,
    dispatchDataProposal: (...args: unknown[]) => dispatch(...args),
  };
});

import { useDataStore } from "../../builder/stores/data";
import { useDataTableEditorStore } from "../../builder/panels/datatable/stores/dataTableEditorStore";
import { DATA_AGENT_COMMANDS, type DataAgentCommandInput } from "./dataAgentCommands";

const t: ToolTranslate = (key, params) =>
  params ? `${key}:${JSON.stringify(params)}` : key;

const input = (): DataAgentCommandInput => ({
  read: {
    projectLoaded: true,
    collections: [{ id: "c1", name: "Users" }],
    endpoints: [{ id: "e1", name: "getUsers", method: "GET" }],
  },
  host: "chrome-mcp",
  t,
});

describe("DATA_AGENT_COMMANDS — 정적 대조", () => {
  it("adapter 파일은 handler 심볼만 import 한다 (dataTableEditorStore · data store · pasteProposal · dispatcher)", async () => {
    const source = await readFile(
      resolve(__dirname, "dataAgentCommands.ts"),
      "utf-8",
    );
    const modules = [...source.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    expect(modules).toEqual(
      expect.arrayContaining([
        "../../builder/stores/data",
        "../../builder/panels/datatable/stores/dataTableEditorStore",
        "../ai/data/pasteProposal",
        "../ai/data/dataProposalDispatcher",
      ]),
    );
    // 적용기 · 패널 컴포넌트 · 다른 store 의 같은 이름 함수는 import 금지
    expect(modules.some((m) => m.includes("stores/utils/dataChange"))).toBe(
      false,
    );
    expect(modules.some((m) => m.includes("DataTablePanel"))).toBe(false);
    expect(modules.some((m) => m.includes("ApiEndpointEditor"))).toBe(false);
  });
});

describe("DATA_AGENT_COMMANDS — 호출 심볼 · 인자", () => {
  const openTableEditor = vi.fn();
  const openApiEditor = vi.fn();
  const executeApiEndpoint = vi.fn(async () => [{ id: 1 }]);

  beforeEach(() => {
    vi.clearAllMocks();
    useDataTableEditorStore.setState({ openTableEditor, openApiEditor } as never);
    useDataStore.setState({ executeApiEndpoint } as never);
  });

  it("data.openTable → openTableEditor(collection.id) — 이름으로 찾아도 id 를 넘긴다", async () => {
    const r = await DATA_AGENT_COMMANDS["data.openTable"](
      { name: "users" },
      input(),
    );
    expect(r).toEqual({ ok: true });
    expect(openTableEditor).toHaveBeenCalledTimes(1);
    expect(openTableEditor).toHaveBeenCalledWith("c1");
  });

  it("data.openEndpoint → openApiEditor(id, tab) — 모르는 tab 은 undefined", async () => {
    await DATA_AGENT_COMMANDS["data.openEndpoint"](
      { endpointId: "e1", tab: "response" },
      input(),
    );
    expect(openApiEditor).toHaveBeenCalledWith("e1", "response");
    await DATA_AGENT_COMMANDS["data.openEndpoint"](
      { name: "getUsers", tab: "nope" },
      input(),
    );
    expect(openApiEditor).toHaveBeenLastCalledWith("e1", undefined);
  });

  it("data.runEndpoint → executeApiEndpoint(id) 1회 (handleTest 와 같은 심볼) · 실패는 throw 그대로", async () => {
    const r = await DATA_AGENT_COMMANDS["data.runEndpoint"](
      { name: "getUsers" },
      input(),
    );
    expect(r).toEqual({ ok: true });
    expect(executeApiEndpoint).toHaveBeenCalledWith("e1");
    executeApiEndpoint.mockRejectedValueOnce(new Error("HTTP 401"));
    await expect(
      DATA_AGENT_COMMANDS["data.runEndpoint"]({ endpointId: "e1" }, input()),
    ).rejects.toThrow("HTTP 401");
  });

  it("대상이 없으면 심볼 호출 0 · error outcome", async () => {
    const r = await DATA_AGENT_COMMANDS["data.openTable"](
      { name: "Ghost" },
      input(),
    );
    expect(r).toEqual({
      ok: false,
      status: "error",
      reason: "collection-not-found",
    });
    expect(openTableEditor).not.toHaveBeenCalled();
  });
});

describe("data.importPaste — dispatcher 경유 (applyDataChange 직접 호출 0)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("새 테이블: create_collection (detectColumns 스키마 · 행 전부 · source manual) · origin agent · host 그대로", async () => {
    dispatch.mockResolvedValueOnce({
      status: "applied",
      historyId: 7,
      opsCount: 1,
    });
    const r = await DATA_AGENT_COMMANDS["data.importPaste"](
      {
        text: "name\tage\nAna\t30\nBo\t41",
        name: "People",
      },
      input(),
    );
    expect(r).toEqual({ ok: true, historyIndex: 7 });
    expect(dispatch).toHaveBeenCalledTimes(1);
    const [proposal, translate] = dispatch.mock.calls[0] as [
      Record<string, unknown>,
      unknown,
    ];
    expect(translate).toBe(t);
    expect(proposal).toMatchObject({
      origin: "agent",
      host: "chrome-mcp",
      label: 'aiDataProposal.importPasteLabel:{"count":2,"format":"table"}',
    });
    expect(proposal.ops).toEqual([
      {
        op: "create_collection",
        name: "People",
        schema: [
          { key: "name", type: "string", label: "Name", required: false },
          { key: "age", type: "number", label: "Age", required: false },
        ],
        rows: [
          { name: "Ana", age: 30 },
          { name: "Bo", age: 41 },
        ],
        source: "manual",
      },
    ]);
  });

  it("기존 collection: insert_rows · 거부 → declined · invalid → error · 파싱 실패 → dispatcher 0", async () => {
    dispatch.mockResolvedValueOnce({ status: "rejected", opsCount: 1 });
    const declined = await DATA_AGENT_COMMANDS["data.importPaste"](
      { text: '[{"name":"Cy"}]', collectionId: "c1" },
      input(),
    );
    expect(declined).toEqual({
      ok: false,
      status: "declined",
      reason: "user-declined",
    });
    expect((dispatch.mock.calls[0][0] as { ops: unknown }).ops).toEqual([
      { op: "insert_rows", collectionId: "c1", rows: [{ name: "Cy" }] },
    ]);

    dispatch.mockResolvedValueOnce({ status: "invalid", errors: ["bad"] });
    expect(
      await DATA_AGENT_COMMANDS["data.importPaste"](
        { text: '[{"a":1}]', name: "X" },
        input(),
      ),
    ).toEqual({ ok: false, status: "error", reason: "bad" });

    dispatch.mockClear();
    expect(
      await DATA_AGENT_COMMANDS["data.importPaste"](
        { text: "hello", name: "X" },
        input(),
      ),
    ).toEqual({ ok: false, status: "error", reason: "paste-not-tabular" });
    expect(dispatch).not.toHaveBeenCalled();
  });
});
