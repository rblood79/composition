/**
 * DATA_AGENT_COMMANDS — `data.*` agent 명령의 store-level adapter (ADR-213 Phase 5, AX-4).
 *
 * ADR-196 `AGENT_COMMANDS` 와 같은 어법 — 패널 handler 가 부르는 **바로 그 심볼** 을 같은
 * 인자로 부른다 (`dataAgentCommands.test.ts` 가 import 심볼 · 호출 인자를 대조):
 *
 * | 명령                | 사람 경로 handler                                  | 호출 심볼                                   |
 * | ------------------- | -------------------------------------------------- | ------------------------------------------- |
 * | `data.openTable`    | `DataTablePanel.handleEditingChange`               | `useDataTableEditorStore.openTableEditor`   |
 * | `data.openEndpoint` | `ApiEndpointList.handleEdit` / `handleExecute`     | `useDataTableEditorStore.openApiEditor`     |
 * | `data.runEndpoint`  | `ApiEndpointEditor.handleTest`                     | `useDataStore.executeApiEndpoint`           |
 * | `data.importPaste`  | AI-2 `understand_paste` 와 같은 `buildPasteProposal`    | `dispatchDataProposal` (create/insert_rows · cURL 은 define_endpoint) |
 *
 * - 값 export 는 `DATA_AGENT_COMMANDS` 하나 — executor 의 allowlist → precondition → confirm
 *   게이트 밖에서 부를 수 없다 (ADR-196 정적 게이트 조항 5, `dataCommandMeta.static.test.ts`).
 * - `importPaste` 는 데이터 쓰기 — AI/agent 쓰기의 유일한 진입점 `dispatchDataProposal` 을
 *   지난다 (승인 diff · `origin:"agent"` stamp · History 1 · provenance 1). 여기서
 *   `applyDataChange` 를 직접 부르지 않는다 (`dataProposalDispatcher.static.test.ts`).
 */
import { useDataStore } from "../../builder/stores/data";
import { useDataTableEditorStore } from "../../builder/panels/datatable/stores/dataTableEditorStore";
import type { ApiEditorTab } from "../../builder/panels/datatable/types/editorTypes";
import { buildPasteProposal } from "../ai/data/pasteProposal";
import {
  resolveDataRef,
  type DataAgentCommandId,
  type DataAgentReadModel,
  type DataCommandArgs,
} from "../../builder/config/dataCommandMeta";
import type { AgentHost } from "../../builder/stores/agentCommandLog";
import type { ToolTranslate } from "../../types/integrations/ai.types";
import { dispatchDataProposal } from "../ai/data/dataProposalDispatcher";

export interface DataAgentCommandInput {
  read: DataAgentReadModel;
  host: AgentHost;
  /** dispatcher 의 승인 요약 문구 — executor 가 조립 */
  t: ToolTranslate;
}

/** adapter 결과 — `declined`/`error` 는 executor 가 같은 status 로 기록·반환한다. */
export type DataAgentCommandOutcome =
  | { ok: true; historyIndex?: number }
  | { ok: false; status: "declined" | "error"; reason: string };

export type DataAgentCommandAdapter = (
  args: DataCommandArgs,
  input: DataAgentCommandInput,
) => Promise<DataAgentCommandOutcome>;

const OK: DataAgentCommandOutcome = { ok: true };
const error = (reason: string): DataAgentCommandOutcome => ({
  ok: false,
  status: "error",
  reason,
});

const API_EDITOR_TABS: readonly ApiEditorTab[] = [
  "params",
  "headers",
  "body",
  "auth",
  "response",
];

function collectionOf(args: DataCommandArgs, read: DataAgentReadModel) {
  return resolveDataRef(read.collections, args, "collectionId");
}
function endpointOf(args: DataCommandArgs, read: DataAgentReadModel) {
  return resolveDataRef(read.endpoints, args, "endpointId");
}

export const DATA_AGENT_COMMANDS: Readonly<
  Record<DataAgentCommandId, DataAgentCommandAdapter>
> = {
  "data.openTable": async (args, { read }) => {
    const collection = collectionOf(args, read);
    if (!collection) return error("collection-not-found");
    useDataTableEditorStore.getState().openTableEditor(collection.id);
    return OK;
  },

  "data.openEndpoint": async (args, { read }) => {
    const endpoint = endpointOf(args, read);
    if (!endpoint) return error("endpoint-not-found");
    const tab = API_EDITOR_TABS.find((candidate) => candidate === args.tab);
    useDataTableEditorStore.getState().openApiEditor(endpoint.id, tab);
    return OK;
  },

  "data.runEndpoint": async (args, { read }) => {
    const endpoint = endpointOf(args, read);
    if (!endpoint) return error("endpoint-not-found");
    // 실패 (HTTP 오류 · 네트워크) 는 throw — executor 가 `error` 로 기록한다. 실행 스냅샷은
    // 성공·실패 모두 `apiRuns` 에 남아 `explain_request_failure` 가 읽는다.
    await useDataStore.getState().executeApiEndpoint(endpoint.id);
    return OK;
  },

  "data.importPaste": async (args, { read, host, t }) => {
    const text = typeof args.text === "string" ? args.text : "";
    const built = buildPasteProposal(text, {
      name: typeof args.name === "string" ? args.name : undefined,
      collectionId:
        typeof args.collectionId === "string" && args.collectionId
          ? args.collectionId
          : undefined,
      collections: read.collections,
    });
    if (built.kind === "error") return error(built.reason);
    const label =
      built.kind === "endpoint"
        ? t("aiDataProposal.importCurlLabel", { name: built.draft.name })
        : t("aiDataProposal.importPasteLabel", {
            count: built.rows.length,
            format: built.format,
          });

    const result = await dispatchDataProposal(
      { ops: built.ops, label, host, origin: "agent" },
      t,
    );
    switch (result.status) {
      case "applied":
        return result.historyId === undefined
          ? OK
          : { ok: true, historyIndex: result.historyId };
      case "rejected":
        return { ok: false, status: "declined", reason: "user-declined" };
      case "invalid":
        return error(result.errors.join("; "));
    }
  },
};
