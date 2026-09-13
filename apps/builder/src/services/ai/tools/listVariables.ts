/**
 * list_variables Tool — 프로젝트 · 페이지 · 요소 변수 정의 + 소유자 (ADR-214 후속, ADR-213 읽기
 * tool 4 와 같은 계약).
 *
 * 입력은 `getProjectVariableDefinitions` (data store, project 소유자) + `collectDocumentVariables`
 * (canonical `state` — 페이지 · 요소). `format: "concise"` (기본) 는 id · name · type · owner ·
 * usedBy, `"detailed"` 는 defaultValue · persist · source (암묵 상태) · usages 를 더한다.
 * **정의만** 싣는다 — 런타임 값 (preview 상태) 은 없다. 쓰기 0 (변수 정의는 `HUMAN_ONLY_DATA_OPS`).
 */
import {
  collectDocumentVariables,
  collectVariableUsages,
  findCanonicalNodeById,
  resolveAncestorChainIds,
  type CompositionDocument,
  type VariableDef,
  type VariableUsage,
} from "@composition/shared";
import type {
  ToolExecutionResult,
  ToolExecutor,
} from "../../../types/integrations/ai.types";
import { getActiveCanonicalDocument } from "../../../builder/stores/canonical/canonicalElementsBridge";
import { getProjectVariableDefinitions } from "../../../builder/stores/data";
import { readFormat } from "./listCollections";

export type VariableOwnerSummary =
  | { kind: "project" }
  | { kind: "page"; pageId: string; pageTitle: string }
  | { kind: "element"; elementId: string; elementType: string; pageId: string | null };

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

function detailOf(
  def: VariableDef,
  owner: VariableOwnerSummary,
  usages: VariableUsage[],
): VariableDetail {
  return {
    id: def.id,
    name: def.name,
    type: def.type,
    owner,
    usedBy: usages.length,
    ...(def.defaultValue !== undefined ? { defaultValue: def.defaultValue } : {}),
    ...(def.persist !== undefined ? { persist: def.persist } : {}),
    ...(def.source ? { source: { prop: def.source.prop } } : {}),
    usages,
  };
}

/** 프로젝트 정의 먼저, 그 다음 문서 색인 순서 (페이지 → 그 페이지의 요소). 순수 함수. */
export function collectVariableDetails(
  doc: CompositionDocument | null,
  projectDefs: readonly VariableDef[],
): VariableDetail[] {
  const rules = doc?.events;
  const usagesOf = (id: string) =>
    collectVariableUsages(doc, rules, id, projectDefs);
  const out: VariableDetail[] = projectDefs.map((def) =>
    detailOf(def, { kind: "project" }, usagesOf(def.id)),
  );
  if (!doc) return out;
  for (const { def, owner } of collectDocumentVariables(doc)) {
    if (owner.kind === "page") {
      const node = findCanonicalNodeById(doc, owner.pageId);
      out.push(
        detailOf(
          def,
          { kind: "page", pageId: owner.pageId, pageTitle: node?.name ?? owner.pageId },
          usagesOf(def.id),
        ),
      );
    } else if (owner.kind === "element") {
      const node = findCanonicalNodeById(doc, owner.elementId);
      const chain = resolveAncestorChainIds(doc, owner.elementId);
      out.push(
        detailOf(
          def,
          {
            kind: "element",
            elementId: owner.elementId,
            elementType: node?.type ?? owner.elementId,
            pageId: chain[chain.length - 1] ?? null,
          },
          usagesOf(def.id),
        ),
      );
    }
  }
  return out;
}

export function summarizeVariables(
  doc: CompositionDocument | null,
  projectDefs: readonly VariableDef[],
): VariableSummary[] {
  return collectVariableDetails(doc, projectDefs).map(
    ({ id, name, type, owner, usedBy }) => ({ id, name, type, owner, usedBy }),
  );
}

export const listVariablesTool: ToolExecutor = {
  name: "list_variables",

  async execute(args): Promise<ToolExecutionResult> {
    try {
      const doc = getActiveCanonicalDocument();
      const projectDefs = getProjectVariableDefinitions();
      const data =
        readFormat(args) === "detailed"
          ? collectVariableDetails(doc, projectDefs)
          : summarizeVariables(doc, projectDefs);
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};
