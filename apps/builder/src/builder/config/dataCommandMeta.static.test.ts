/**
 * ADR-213 Phase 5 — `data.*` 명령 표의 정적 게이트 (ADR-196 `commandMeta.static.test.ts` 와 같은 조항).
 *
 * - 표 = 정확히 4 (openTable · openEndpoint · runEndpoint · importPaste) 이고 단축키 allowlist
 *   (`COMMAND_META`, HC2 상한 40) 와 겹치지 않는다.
 * - 조항 1 adapter 1:1 · 조항 2 되돌릴 수 없는 변경은 confirm · 조항 6 dispatcher 기록은 document 만.
 * - 조항 5 adapter 파일은 `DATA_AGENT_COMMANDS` 만 값으로 export (executor 밖 우회 경로 0).
 * - precondition: 프로젝트 로드 · 대상 id/이름 존재 · importPaste 필수 인자.
 * - runEndpoint 승인은 method 로 판정 — GET 은 묻지 않고 그 밖은 묻는다.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { COMMAND_META } from "./commandMeta";
import {
  DATA_AGENT_COMMAND_IDS,
  DATA_COMMAND_META,
  isDataAgentCommandId,
  validateDataCommandMeta,
  type DataAgentReadModel,
} from "./dataCommandMeta";
import { DATA_AGENT_COMMANDS } from "../../services/agent/dataAgentCommands";

const read: DataAgentReadModel = {
  projectLoaded: true,
  collections: [{ id: "c1", name: "Users" }],
  endpoints: [
    { id: "e1", name: "getUsers", method: "GET" },
    { id: "e2", name: "createUser", method: "POST" },
  ],
};

describe("DATA_COMMAND_META — 정적 게이트", () => {
  it("표는 정확히 4 · 단축키 allowlist 와 겹치지 않는다 · adapter 1:1", () => {
    expect([...DATA_AGENT_COMMAND_IDS]).toEqual([
      "data.openTable",
      "data.openEndpoint",
      "data.runEndpoint",
      "data.importPaste",
    ]);
    for (const id of DATA_AGENT_COMMAND_IDS) {
      expect(id in COMMAND_META).toBe(false);
      expect(isDataAgentCommandId(id)).toBe(true);
    }
    expect(isDataAgentCommandId("zoomIn")).toBe(false);
    expect(
      validateDataCommandMeta(
        DATA_COMMAND_META,
        new Set(Object.keys(DATA_AGENT_COMMANDS)),
      ),
    ).toEqual([]);
  });

  it("조항 민감도 — adapter 를 빼면 RED · document 를 irreversible + confirm:false 로 두면 RED", () => {
    const ids = new Set(Object.keys(DATA_AGENT_COMMANDS));
    ids.delete("data.openTable");
    expect(validateDataCommandMeta(DATA_COMMAND_META, ids)).toEqual([
      { rule: 1, id: "data.openTable", message: "meta 는 있지만 adapter 없음" },
    ]);
    const broken = {
      ...DATA_COMMAND_META,
      "data.importPaste": {
        ...DATA_COMMAND_META["data.importPaste"],
        undo: "irreversible" as const,
      },
    };
    expect(
      validateDataCommandMeta(broken, new Set(Object.keys(DATA_AGENT_COMMANDS)))
        .map((v) => v.rule),
    ).toEqual([2]);
  });

  it("조항 5 — adapter 파일은 DATA_AGENT_COMMANDS 만 값으로 export 한다", async () => {
    const source = await readFile(
      resolve(__dirname, "../../services/agent/dataAgentCommands.ts"),
      "utf-8",
    );
    const valueExports = [
      ...source.matchAll(
        /^export (?:const|function|let|class|async function) (\w+)/gm,
      ),
    ].map((m) => m[1]);
    expect(valueExports).toEqual(["DATA_AGENT_COMMANDS"]);
    expect(source).not.toMatch(/^export \{/m);
    expect(source).not.toMatch(/^export default/m);
    // 데이터 쓰기는 dispatcher 로만 — 적용기 직접 호출 0
    expect(source).not.toContain("applyDataChange(");
    expect(source).toContain("dispatchDataProposal(");
  });

  it("precondition — 프로젝트 미로드 · 참조 없음 · 대상 없음 · importPaste 필수 인자", () => {
    const m = DATA_COMMAND_META;
    expect(
      m["data.openTable"].precondition({ ...read, projectLoaded: false }, {
        name: "Users",
      }),
    ).toEqual({ ok: false, reason: "no-project" });
    expect(m["data.openTable"].precondition(read, {})).toEqual({
      ok: false,
      reason: "collection-ref-required",
    });
    expect(m["data.openTable"].precondition(read, { name: "Ghost" })).toEqual({
      ok: false,
      reason: "collection-not-found",
    });
    expect(m["data.openTable"].precondition(read, { name: "users" })).toEqual({
      ok: true,
    });
    expect(
      m["data.openEndpoint"].precondition(read, { endpointId: "getUsers" }),
    ).toEqual({ ok: true });
    expect(m["data.runEndpoint"].precondition(read, { name: "nope" })).toEqual(
      { ok: false, reason: "endpoint-not-found" },
    );
    expect(m["data.importPaste"].precondition(read, { name: "T" })).toEqual({
      ok: false,
      reason: "text-required",
    });
    expect(m["data.importPaste"].precondition(read, { text: "[]" })).toEqual({
      ok: false,
      reason: "name-required",
    });
    expect(
      m["data.importPaste"].precondition(read, {
        text: "[]",
        collectionId: "ghost",
      }),
    ).toEqual({ ok: false, reason: "collection-not-found" });
    expect(
      m["data.importPaste"].precondition(read, { text: "[]", name: "T" }),
    ).toEqual({ ok: true });
  });

  it("runEndpoint 승인은 method 로 — GET 은 묻지 않고 POST 는 묻는다", () => {
    const confirm = DATA_COMMAND_META["data.runEndpoint"].confirm;
    expect(typeof confirm).toBe("function");
    if (typeof confirm !== "function") return;
    expect(confirm(read, { name: "getUsers" })).toBe(false);
    expect(confirm(read, { endpointId: "e2" })).toBe(true);
    // importPaste 는 executor 게이트 0 — dispatcher 가 diff 로 묻는다
    expect(DATA_COMMAND_META["data.importPaste"]).toMatchObject({
      confirm: false,
      provenance: "dispatcher",
      mutation: "document",
      undo: "history",
    });
  });
});
