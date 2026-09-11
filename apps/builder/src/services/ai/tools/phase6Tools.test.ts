/**
 * ADR-213 Phase 6 — 사람이 부르는 AI 3종 (G5 정적 부분).
 *
 * - AI-1 `create_table_from_description`: 정의 parameters = `TableSpecSchema` 파생 · spec 오류/이름
 *   충돌은 dispatcher 0 · 행은 코드가 만들고 (스키마 밖 컬럼 0 · enum 정합 · FK 는 기존 행) 승인
 *   경로 1회 (origin ai · create_collection 1) · 거부 → 수정 안내
 * - AI-2 `understand_paste`: 규칙 파서 → rows/endpoint proposal · 실패 → parsed:false + guidance
 *   (적용 0) · cURL 결과는 header **키만** + URL redactor
 * - AI-4: `readOpenDataEditor` → `buildTurnContext` 자동 첨부 (값 없음 · endpoint URL redacted)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDataStore } from "../../../builder/stores/data";
import { useDataTableEditorStore } from "../../../builder/panels/datatable/stores/dataTableEditorStore";
import type { ApiEndpoint, DataTable } from "../../../types/builder/data.types";
import type { ToolTranslate } from "../../../types/integrations/ai.types";
import { localizedStrings } from "@/i18n/translations";

const dispatch = vi.fn();
vi.mock("../data/dataProposalDispatcher", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../data/dataProposalDispatcher")>();
  return {
    ...original,
    dispatchDataProposal: (...args: unknown[]) => dispatch(...args),
  };
});
vi.mock("./canonicalToolReadModel", () => ({
  getAiToolReadModel: () => ({
    elements: [
      {
        id: "e1",
        props: { dataBinding: { source: "dataTable", collectionId: "users" } },
      },
    ],
    elementsById: new Map(),
    childrenByParent: new Map(),
    state: {},
  }),
}));

import { toolDefinitions } from "./definitions";
import { createTableFromDescriptionTool } from "./createTableFromDescription";
import { understandPasteTool } from "./understandPaste";
import { tableSpecJsonSchema } from "../data/tableSpec";
import { readOpenDataEditor } from "../data/dataToolReadModel";
import { buildBuilderContext } from "../builderContext";
import { buildTurnContext } from "../systemPrompt";

const t: ToolTranslate = (key, params) => {
  const message = localizedStrings["ko-KR"][key];
  if (typeof message === "function") return message(params);
  return message ?? key;
};

const CANARY = "sk-CANARY-p6";

function users(): DataTable {
  return {
    id: "users",
    name: "Users",
    project_id: "p1",
    schema: [
      { id: "f_id", key: "id", type: "string" },
      { id: "f_name", key: "name", type: "string" },
    ],
    mockData: [
      { id: "u1", name: "Ana Kim" },
      { id: "u2", name: "Bo Lee" },
    ],
    useMockData: true,
    created_at: "",
    updated_at: "",
  } as DataTable;
}
function endpoint(): ApiEndpoint {
  return {
    id: "ep1",
    name: "getUsers",
    project_id: "p1",
    method: "GET",
    baseUrl: "https://api.example.com",
    path: "/users",
    headers: [{ key: "X-API-Key", value: CANARY, enabled: true }],
    queryParams: [{ key: "token", value: CANARY, type: "string", required: false }],
    bodyType: "none",
    responseMapping: { dataPath: "" },
    executionMode: "client",
    timeout: 30000,
    retryCount: 0,
    created_at: "",
    updated_at: "",
  } as ApiEndpoint;
}

beforeEach(() => {
  vi.clearAllMocks();
  useDataStore.setState({
    collections: new Map([["users", users()]]),
    apiEndpoints: new Map([["ep1", endpoint()]]),
    apiRuns: new Map(),
    errors: new Map(),
  } as never);
  useDataTableEditorStore.setState({ mode: null } as never);
});

describe("create_table_from_description (AI-1)", () => {
  it("정의 parameters 는 TableSpecSchema 파생 그대로 (손으로 쓴 두 번째 스키마 0)", () => {
    const def = toolDefinitions.find(
      (d) => d.function.name === "create_table_from_description",
    )!;
    expect(def.function.parameters).toEqual(tableSpecJsonSchema());
    expect(
      toolDefinitions.find((d) => d.function.name === "understand_paste")!
        .function.parameters,
    ).toMatchObject({ required: ["text"] });
  });

  it("spec 오류 · 같은 이름 → dispatcher 0 · 오류 문구", async () => {
    const bad = await createTableFromDescriptionTool.execute(
      { name: "X", fields: [{ key: "bad key", type: "string" }] },
      t,
    );
    expect(bad.success).toBe(false);
    expect(bad.error).toContain("fields.0.key");
    const dup = await createTableFromDescriptionTool.execute(
      { name: "users", fields: [{ key: "a", type: "string" }] },
      t,
    );
    expect(dup).toEqual({
      success: false,
      error: t("aiToolError.collectionNameExists", { name: "users" }),
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("행은 코드가 만든다 — create_collection 1 · origin ai · 스키마 키만 · enum 정합 · FK 는 Users 행", async () => {
    dispatch.mockResolvedValueOnce({ status: "applied", historyId: 9, opsCount: 1 });
    const r = await createTableFromDescriptionTool.execute(
      {
        name: "Blog Posts",
        fields: [
          { key: "id", type: "string", required: true },
          { key: "title", type: "string", required: true },
          { key: "body", type: "string" },
          { key: "author", type: "string", generate: { kind: "reference", collection: "Users", field: "name" } },
          { key: "publishedAt", type: "date" },
          { key: "status", type: "string", generate: { kind: "enum", values: ["draft", "published"] } },
        ],
      },
      t,
    );
    expect(dispatch).toHaveBeenCalledTimes(1);
    const [proposal] = dispatch.mock.calls[0] as [
      { ops: { op: string; name: string; schema: unknown[]; rows: Record<string, unknown>[] }[]; origin: string; host: string; label: string },
    ];
    expect(proposal).toMatchObject({ origin: "ai", host: "ai-panel" });
    expect(proposal.label).toContain("Blog Posts");
    expect(proposal.ops).toHaveLength(1);
    const op = proposal.ops[0];
    expect(op.op).toBe("create_collection");
    expect(op.schema).toHaveLength(6);
    expect(op.rows).toHaveLength(5);
    for (const row of op.rows) {
      expect(Object.keys(row).sort()).toEqual(
        ["author", "body", "id", "publishedAt", "status", "title"].sort(),
      );
      expect(["draft", "published"]).toContain(row.status);
      expect(["Ana Kim", "Bo Lee"]).toContain(row.author);
    }
    expect(r).toMatchObject({
      success: true,
      data: { status: "applied", name: "Blog Posts", fieldCount: 6, rowCount: 5, historyId: 9 },
    });
  });

  it("거부 → 실패 + 수정 안내 (모델이 규칙을 고쳐 다시 부른다)", async () => {
    dispatch.mockResolvedValueOnce({ status: "rejected", opsCount: 1 });
    const r = await createTableFromDescriptionTool.execute(
      { name: "T", fields: [{ key: "a", type: "string" }] },
      t,
    );
    expect(r).toEqual({
      success: false,
      error: t("aiDataProposal.createTableRejected"),
    });
  });
});

describe("understand_paste (AI-2)", () => {
  it("표 텍스트 → create_collection (스키마 추론) · 미리보기 3행", async () => {
    dispatch.mockResolvedValueOnce({ status: "applied", historyId: 3, opsCount: 1 });
    const r = await understandPasteTool.execute(
      { text: "name\tage\nAna\t30\nBo\t41\nCy\t5\nDi\t7", name: "People" },
      t,
    );
    const [proposal] = dispatch.mock.calls[0] as [{ ops: unknown[]; origin: string }];
    expect(proposal).toMatchObject({ origin: "ai" });
    expect(proposal.ops).toEqual([
      expect.objectContaining({
        op: "create_collection",
        name: "People",
        schema: [
          expect.objectContaining({ key: "name", type: "string" }),
          expect.objectContaining({ key: "age", type: "number" }),
        ],
      }),
    ]);
    expect(r).toMatchObject({
      success: true,
      data: { parsed: true, kind: "rows", format: "table", rowCount: 4, target: null },
    });
    expect((r.data as { preview: unknown[] }).preview).toHaveLength(3);
  });

  it("collectionId → insert_rows · JSON 객체 (관례 키)", async () => {
    dispatch.mockResolvedValueOnce({ status: "applied", opsCount: 1 });
    await understandPasteTool.execute(
      { text: '{"results":[{"id":"u3","name":"Cy"}]}', collectionId: "users" },
      t,
    );
    expect((dispatch.mock.calls[0][0] as { ops: unknown[] }).ops).toEqual([
      { op: "insert_rows", collectionId: "users", rows: [{ id: "u3", name: "Cy" }] },
    ]);
  });

  it("cURL → define_endpoint · 결과는 header 키만 + URL redacted (canary 원문 0)", async () => {
    dispatch.mockResolvedValueOnce({ status: "applied", historyId: 4, opsCount: 1 });
    const r = await understandPasteTool.execute(
      {
        text: `curl 'https://api.example.com/v2/items?api_key=${CANARY}' -H 'Authorization: Bearer ${CANARY}'`,
      },
      t,
    );
    const [proposal] = dispatch.mock.calls[0] as [{ ops: { op: string; endpoint: { headers: { value: string }[] } }[] }];
    expect(proposal.ops[0].op).toBe("define_endpoint");
    // 승인 다이얼로그 (로컬) 로 가는 op 에는 원문이 있어야 실제 요청이 된다
    expect(proposal.ops[0].endpoint.headers[0].value).toBe(`Bearer ${CANARY}`);
    // provider 로 가는 tool 결과에는 원문 0
    expect(JSON.stringify(r)).not.toContain(CANARY);
    expect(r).toMatchObject({
      success: true,
      data: {
        parsed: true,
        kind: "endpoint",
        endpoint: {
          name: "api.example.com_v2_items",
          method: "GET",
          headerKeys: ["Authorization"],
          queryKeys: ["api_key"],
        },
      },
    });
  });

  it("규칙 파서 실패 → parsed:false + guidance, 적용 0 · name 없음 → 오류", async () => {
    const r = await understandPasteTool.execute(
      { text: "회원 목록: 김철수(30), 이영희(25)", name: "Members" },
      t,
    );
    expect(r).toMatchObject({
      success: true,
      data: { parsed: false, reason: "paste-no-rows", guidance: t("aiPrompt.pasteFallbackGuidance") },
    });
    const noName = await understandPasteTool.execute({ text: '[{"a":1}]' }, t);
    expect(noName).toEqual({ success: false, error: t("aiToolError.pasteNameRequired") });
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("열린 편집기 자동 첨부 (AI-4)", () => {
  it("닫힘 → null · 테이블 → 필드 (id/key/type) · 사용처 · 행 수", () => {
    expect(readOpenDataEditor()).toBeNull();
    useDataTableEditorStore.setState({ mode: { type: "table-edit", tableId: "users" } } as never);
    expect(readOpenDataEditor()).toEqual({
      kind: "table",
      id: "users",
      name: "Users",
      fields: [
        { id: "f_id", key: "id", type: "string" },
        { id: "f_name", key: "name", type: "string" },
      ],
      fieldsOmitted: 0,
      rowCount: 2,
      usedBy: 1,
    });
  });

  it("endpoint → URL 은 redactor · 헤더 키만 · 턴 컨텍스트에 실린다 (canary 0)", () => {
    useDataTableEditorStore.setState({ mode: { type: "api-edit", endpointId: "ep1" } } as never);
    const open = readOpenDataEditor();
    expect(open).toMatchObject({ kind: "endpoint", id: "ep1", name: "getUsers", method: "GET", headerKeys: ["X-API-Key"] });
    expect(JSON.stringify(open)).not.toContain(CANARY);
    const context = buildBuilderContext({
      elements: [],
      elementsById: new Map(),
      state: { currentPageId: "p" },
      collections: [],
    });
    expect(context.openDataEditor).toEqual(open);
    const turn = buildTurnContext(context, t);
    expect(turn).toContain(t("aiPrompt.openEditorHeading"));
    expect(turn).toContain("getUsers (id ep1)");
    expect(turn).not.toContain(CANARY);
    // 테이블일 때는 필드 · 안내
    useDataTableEditorStore.setState({ mode: { type: "table-edit", tableId: "users" } } as never);
    const turn2 = buildTurnContext(
      buildBuilderContext({ elements: [], elementsById: new Map(), state: {}, collections: [] }),
      t,
    );
    expect(turn2).toContain("id:string (#f_id), name:string (#f_name)");
    expect(turn2).toContain(t("aiPrompt.openEditorTableGuide"));
    // 명시 null 이면 첨부 0
    const none = buildBuilderContext({ elements: [], elementsById: new Map(), state: {}, collections: [], openDataEditor: null });
    expect(none.openDataEditor).toBeUndefined();
  });
});
