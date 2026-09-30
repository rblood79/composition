/**
 * ADR-214 Phase 4 — Do = "상태 설정" 의 인자 3개: 변수 (가시성 사슬을 프로젝트 / 이 페이지 /
 * 이 컴포넌트와 조상 그룹으로) · 동작 (set / toggle / increment / reset — 타입에 맞는 것만) ·
 * 값 (타입별: boolean 은 토글이라 값 없음 · number 는 숫자 · string 은 텍스트 · increment 는 증분).
 * ActionPicker 아트보드 정본.
 */
import { memo, useMemo } from "react";
import {
  SET_STATE_OPS,
  type SetStateAction,
  type SetStateOp,
  type VisibleVariable,
} from "@composition/shared";

import { PropertyInput } from "../../components/property/PropertyInput";
import { PropertySelect } from "../../components/property/PropertySelect";
import { useVisibleVariables } from "../properties/hooks/useVisibleVariables";
import { useI18n } from "@/i18n";

interface StateActionFieldsProps {
  /** 트리거 요소 (가시성 기준) */
  elementId: string;
  action: SetStateAction;
  onChange: (action: SetStateAction) => void;
}

const OP_LABEL_KEYS: Record<SetStateOp, string> = {
  set: "interactions.stateOpSet",
  toggle: "interactions.stateOpToggle",
  increment: "interactions.stateOpIncrement",
  reset: "interactions.stateOpReset",
};

/** 변수 선택지 — 구 store (`VisibleVariable`) 와 catalog 문서가 같은 모양으로 넘긴다 */
export interface StateVariableOption {
  id: string;
  name: string;
  type: VisibleVariable["def"]["type"];
  /** 그룹 라벨 카탈로그 키 (프로젝트 / 페이지 / 요소) */
  groupLabelKey: string;
}

/** 편집 중인 setState 인자 — 구 `SetStateAction` 과 catalog action 이 공유하는 부분 */
export interface StateActionValue {
  variableId: string;
  op: SetStateOp;
  value?: unknown;
}

/** 타입별 허용 op — 런타임 store 의 검증과 같은 표 */
function opsForType(type: VisibleVariable["def"]["type"] | null): SetStateOp[] {
  if (type === "boolean") return ["toggle", "set", "reset"];
  if (type === "number") return ["increment", "set", "reset"];
  return ["set", "reset"];
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

interface StateActionFieldsViewProps {
  /** 가까운 소유자가 앞 (요소 → 조상 → 페이지 → 프로젝트) */
  variables: readonly StateVariableOption[];
  action: StateActionValue;
  onChange: (action: StateActionValue) => void;
  /** "변수 없음" 선택지 — 완성된 규칙만 저장하는 문서 (catalog) 는 끈다 */
  allowUnset?: boolean;
}

export const StateActionFieldsView = memo(function StateActionFieldsView({
  variables,
  action,
  onChange,
  allowUnset = true,
}: StateActionFieldsViewProps) {
  const { t } = useI18n();
  const selected = variables.find((entry) => entry.id === action.variableId);
  const type = selected?.type ?? null;

  const variableOptions = useMemo(() => {
    const options: { value: string; label: string }[] = allowUnset
      ? [{ value: "", label: t("interactions.stateVariableUnset") }]
      : [];
    // 그룹 라벨을 접두로
    for (const entry of variables) {
      options.push({
        value: entry.id,
        label: `${t(entry.groupLabelKey)} · ${entry.name}`,
      });
    }
    return options;
  }, [variables, allowUnset, t]);

  const ops = opsForType(type);
  const opOptions = ops.map((op) => ({ value: op, label: t(OP_LABEL_KEYS[op]) }));
  const needsValue = action.op === "set" || action.op === "increment";
  const valueLabel =
    action.op === "increment" ? t("interactions.stateStep") : t("interactions.stateValue");

  return (
    <>
      <PropertySelect
        label={t("interactions.stateVariable")}
        value={action.variableId}
        onChange={(variableId) => {
          const next = variables.find((entry) => entry.id === variableId);
          const allowed = opsForType(next?.type ?? null);
          onChange({
            variableId,
            op: allowed.includes(action.op) ? action.op : allowed[0],
            value: undefined,
          });
        }}
        options={variableOptions}
      />
      <PropertySelect
        label={t("interactions.stateOp")}
        value={ops.includes(action.op) ? action.op : ops[0]}
        onChange={(op) =>
          onChange({ ...action, op: op as SetStateOp, value: undefined })
        }
        options={opOptions}
      />
      {needsValue && type !== "boolean" && (
        <PropertyInput
          label={valueLabel}
          type={type === "number" ? "number" : "text"}
          value={
            action.value === undefined || action.value === null
              ? ""
              : typeof action.value === "object"
                ? JSON.stringify(action.value)
                : (action.value as string | number)
          }
          onChange={(next) => {
            if (type === "number") {
              const parsed = Number(next);
              onChange({ ...action, value: Number.isFinite(parsed) ? parsed : undefined });
              return;
            }
            if (type === "object" || type === "array") {
              try {
                onChange({ ...action, value: JSON.parse(next) });
              } catch {
                onChange({ ...action, value: next });
              }
              return;
            }
            onChange({ ...action, value: next });
          }}
        />
      )}
      {needsValue && type === "boolean" && (
        <PropertySelect
          label={valueLabel}
          value={action.value === true ? "true" : "false"}
          onChange={(next) => onChange({ ...action, value: next === "true" })}
          options={[
            { value: "true", label: "true" },
            { value: "false", label: "false" },
          ]}
        />
      )}
    </>
  );
});

/** SET_STATE_OPS 참조 유지 — 타입 표와 런타임 표가 갈리면 컴파일이 알린다 */
export const STATE_OPS: readonly SetStateOp[] = SET_STATE_OPS;
