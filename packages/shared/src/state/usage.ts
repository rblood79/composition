/**
 * ADR-214 Phase 5 — 변수 사용처 집계 (Properties 상태 절의 삭제 확인 · Data 탭 인덱스의
 * "사용처 N" 배지가 같은 함수를 읽는다).
 *
 * 사용처 두 종류:
 * - `template` — 노드 string prop 의 `{{ name }}` 참조. 이름은 가시성 사슬로 해석하므로
 *   **그 노드에서 이 정의가 보일 때만** 센다 (다른 페이지의 같은 이름 · 사슬 밖 노드는 제외).
 *   같은 노드의 prop 여러 개는 항목 1 (props 에 나열).
 * - `setState` — 규칙 `action.variableId` 가 이 정의를 가리키는 것 (id 축이라 가시성 무관).
 *
 * 문서 순회는 `resolveVisibleVariables` 와 같은 색인 (`visitDocumentNodes`) — descendants 자식 포함.
 */
import type { CompositionDocument } from "../types/composition-document.types";
import type { InteractionRule } from "../interactions/interactionRule.types";
import { collectPropsStateRefs } from "./stateDependencies";
import type { VariableDef } from "./variable.types";
import { resolveVisibleVariables, visitDocumentNodes } from "./visibility";

export type VariableUsage =
  | { kind: "template"; nodeId: string; props: string[] }
  | { kind: "setState"; ruleId: string; elementId: string; trigger: string };

function propsReferencing(
  props: Record<string, unknown> | undefined,
  name: string,
): string[] {
  if (!props) return [];
  const out: string[] = [];
  for (const [key, value] of Object.entries(props)) {
    if (collectPropsStateRefs({ [key]: value }).includes(name)) out.push(key);
  }
  return out;
}

export function collectVariableUsages(
  doc: CompositionDocument | null | undefined,
  rules: readonly InteractionRule[] | undefined,
  variableId: string,
  projectVariables: readonly VariableDef[],
): VariableUsage[] {
  const out: VariableUsage[] = [];
  const projectDef = projectVariables.find((def) => def.id === variableId);
  let name: string | null = projectDef?.name ?? null;
  if (doc) {
    if (name === null) {
      visitDocumentNodes(doc, (node) => {
        if (name !== null) return;
        const found = (node.state ?? []).find((def) => def.id === variableId);
        if (found) name = found.name;
      });
    }
    if (name !== null) {
      const target = name;
      visitDocumentNodes(doc, (node) => {
        const props = propsReferencing(
          node.props as Record<string, unknown> | undefined,
          target,
        );
        if (props.length === 0) return;
        const visible = resolveVisibleVariables(
          doc,
          { kind: "element", elementId: node.id },
          projectVariables,
        );
        const resolved = visible.find((entry) => entry.def.name === target);
        if (resolved?.def.id !== variableId) return;
        out.push({ kind: "template", nodeId: node.id, props });
      });
    }
  }
  for (const rule of rules ?? []) {
    if (rule.action.kind === "setState" && rule.action.variableId === variableId)
      out.push({
        kind: "setState",
        ruleId: rule.id,
        elementId: rule.elementId,
        trigger: rule.trigger,
      });
  }
  return out;
}
