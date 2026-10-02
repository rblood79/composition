/**
 * ADR-214 Phase 4 — Do = "상태 설정" 의 인자 3개: 변수 (가시성 사슬을 프로젝트 / 이 페이지 /
 * 이 컴포넌트와 조상 그룹으로) · 동작 (set / toggle / increment / reset — 타입에 맞는 것만) ·
 * 값 (타입별: boolean 은 토글이라 값 없음 · number 는 숫자 · string 은 텍스트 · increment 는 증분).
 * ActionPicker 아트보드 정본.
 */
import { memo, useMemo } from "react";
import type { SetStateAction, VisibleVariable } from "@composition/shared";
import { useVisibleVariables } from "../properties/hooks/useVisibleVariables";
import { StateActionFieldsView } from "./StateActionFields";

/**
 * ADR-248 4e-7: the old element store's part of `StateActionFields.tsx` (moved out so the catalog Builder's
 * import graph does not reach the old store). Goes with the old store.
 */
interface StateActionFieldsProps {
  /** 트리거 요소 (가시성 기준) */
  elementId: string;
  action: SetStateAction;
  onChange: (action: SetStateAction) => void;
}

function groupLabelKey(owner: VisibleVariable["owner"]): string {
  if (owner.kind === "project") return "interactions.stateVariableGroupProject";
  if (owner.kind === "page") return "interactions.stateVariableGroupPage";
  return "interactions.stateVariableGroupElement";
}

export const StateActionFields = memo(function StateActionFields({
  elementId,
  action,
  onChange,
}: StateActionFieldsProps) {
  const visible = useVisibleVariables(elementId);
  const variables = useMemo(
    () =>
      visible.map((entry) => ({
        id: entry.def.id,
        name: entry.def.name,
        type: entry.def.type,
        groupLabelKey: groupLabelKey(entry.owner),
      })),
    [visible],
  );
  return (
    <StateActionFieldsView
      variables={variables}
      action={action}
      onChange={(next) => onChange({ ...action, ...next })}
    />
  );
});
