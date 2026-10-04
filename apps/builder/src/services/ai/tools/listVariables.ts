/**
 * list_variables Tool — 프로젝트 · 페이지 · 요소 변수 정의 + 소유자 (ADR-214 후속, ADR-213 읽기
 * tool 4 와 같은 계약).
 *
 * 입력은 `getProjectVariableDefinitions` (data store, project 소유자) + `collectDocumentVariables`
 * (canonical `state` — 페이지 · 요소). `format: "concise"` (기본) 는 id · name · type · owner ·
 * usedBy, `"detailed"` 는 defaultValue · persist · source (암묵 상태) · usages 를 더한다.
 * **정의만** 싣는다 — 런타임 값 (preview 상태) 은 없다. 쓰기 0 (변수 정의는 `HUMAN_ONLY_DATA_OPS`).
 */
import type { VariableUsage } from "@composition/shared";
import type {
  ToolExecutionResult,
  ToolExecutor,
} from "../../../types/integrations/ai.types";
import { getProjectVariableDefinitions } from "../../../builder/stores/data";
import { readFormat } from "./listCollections";
import { getAiReadHost } from "../aiReadHost";

export type VariableOwnerSummary =
  | { kind: "project" }
  | { kind: "page"; pageId: string; pageTitle: string }
  | {
      kind: "element";
      elementId: string;
      elementType: string;
      pageId: string | null;
    };

export interface VariableSummary {
  id: string;
  name: string;
  type: string;
  owner: VariableOwnerSummary;
  usedBy: number;
}

export interface VariableDetail extends VariableSummary {
  defaultValue?: unknown;
  persist?: boolean;
  source?: { prop: string };
  usages: VariableUsage[];
}

export const listVariablesTool: ToolExecutor = {
  name: "list_variables",

  async execute(args): Promise<ToolExecutionResult> {
    try {
      const projectDefs = getProjectVariableDefinitions();
      // ADR-248 4e-5: the open Builder's page / element variables (use counts) — 4e-7: only the
      // read host (the old document's detailed usages are the old store host's).
      const all = getAiReadHost()?.variables(projectDefs) ?? [];
      return {
        success: true,
        data:
          readFormat(args) === "detailed"
            ? all
            : all.map(({ id, name, type, owner, usedBy }) => ({
                id,
                name,
                type,
                owner,
                usedBy,
              })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};
