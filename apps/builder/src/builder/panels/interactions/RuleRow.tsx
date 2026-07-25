/**
 * ADR-158 Phase 2 — 규칙 한 줄 + 인라인 펼침 편집.
 *
 * 접힘: `누를 때 → 열기 @ Modal #login` 한 줄 요약.
 * 펼침: 필드 3개 이내 (When / Do / 대상·인자). 조건·타이밍·고급 섹션 없음 —
 * 그 어휘 자체가 ADR-158 에서 은퇴했다.
 */
import { memo, useCallback, useMemo } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import {
  APP_ACTIONS,
  resolveCapabilities,
  type InteractionAction,
  type InteractionRule,
} from "@composition/shared";

import { useStore } from "../../stores";
import { ActionPicker } from "./ActionPicker";
import { CapabilityPicker } from "./CapabilityPicker";
import { ParamField } from "./ParamField";
import { TargetPicker } from "./TargetPicker";
import { TriggerPicker } from "./TriggerPicker";
import { TRIGGER_LABELS } from "./labels";
import type { ActionChoice } from "./types";

interface RuleRowProps {
  rule: InteractionRule;
  componentType: string;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<Omit<InteractionRule, "id">>) => void;
  onRemove: () => void;
}

/** 선택 갈래별 기본 action — 갈래를 바꾸면 그 갈래의 빈 형태로 재시작한다 */
function emptyAction(choice: ActionChoice): InteractionAction {
  if (choice === "navigate") return { kind: "navigate", params: { path: "" } };
  if (choice === "toast") return { kind: "toast", params: { message: "" } };
  return { kind: "capability", targetId: "", capability: "hide" };
}

export const RuleRow = memo(function RuleRow({
  rule,
  componentType,
  expanded,
  onToggle,
  onChange,
  onRemove,
}: RuleRowProps) {
  const getPageElements = useStore((state) => state.getPageElements);
  const currentPageId = useStore((state) => state.currentPageId);

  /** capability 대상 요소 — type 은 CapabilityPicker, label 은 요약줄에 쓰인다 */
  const target = useMemo(() => {
    if (rule.action.kind !== "capability" || !currentPageId) return undefined;
    const targetId = rule.action.targetId;
    if (!targetId) return undefined;
    return getPageElements(currentPageId).find((el) => el.id === targetId);
  }, [rule.action, currentPageId, getPageElements]);

  const targetType = target?.type ?? "";

  const targetLabel = target
    ? target.customId
      ? `${target.type} #${target.customId}`
      : target.type
    : "대상 미지정";

  const summary = useMemo(() => {
    const when = TRIGGER_LABELS[rule.trigger] ?? rule.trigger;
    if (rule.action.kind === "navigate") {
      const path = rule.action.params.path;
      return `${when} → 페이지 이동${path ? ` (${path})` : ""}`;
    }
    if (rule.action.kind === "toast") {
      const msg = rule.action.params.message;
      return `${when} → 토스트${msg ? ` "${msg}"` : ""}`;
    }
    const caps = resolveCapabilities(targetType);
    const capLabel =
      caps[rule.action.capability]?.label ?? rule.action.capability;
    return `${when} → ${capLabel} @ ${targetLabel}`;
  }, [rule.trigger, rule.action, targetType, targetLabel]);

  const choice: ActionChoice = rule.action.kind;

  const handleChoice = useCallback(
    (next: ActionChoice) => {
      if (next === choice) return;
      onChange({ action: emptyAction(next) });
    },
    [choice, onChange],
  );

  // JSX 안에서 `rule.action` 를 다시 읽으면 union 이 재확장돼 spread 갱신이
  // 타입 오류가 된다 — 좁혀진 형태를 지역 상수로 고정해 쓴다.
  const capAction = rule.action.kind === "capability" ? rule.action : null;

  const capabilityDef = capAction
    ? resolveCapabilities(targetType)[capAction.capability]
    : undefined;

  const appParam =
    rule.action.kind === "navigate"
      ? APP_ACTIONS.navigate.param
      : rule.action.kind === "toast"
        ? APP_ACTIONS.toast.param
        : undefined;

  const appParamValue =
    rule.action.kind === "navigate"
      ? rule.action.params.path
      : rule.action.kind === "toast"
        ? rule.action.params.message
        : undefined;

  return (
    <div className="interaction-rule" data-expanded={expanded || undefined}>
      <div className="interaction-rule-summary">
        <button
          type="button"
          className="interaction-rule-toggle"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="interaction-rule-text">{summary}</span>
        </button>
        <button
          type="button"
          className="interaction-rule-remove"
          onClick={onRemove}
          aria-label="규칙 삭제"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {expanded && (
        <fieldset className="properties-aria interaction-rule-editor">
          <legend className="fieldset-legend">규칙 편집</legend>

          <TriggerPicker
            componentType={componentType}
            value={rule.trigger}
            onChange={(trigger) => onChange({ trigger })}
          />

          <ActionPicker value={choice} onChange={handleChoice} />

          {capAction && (
            <>
              <TargetPicker
                value={capAction.targetId}
                excludeId={rule.elementId}
                onChange={(targetId) =>
                  onChange({ action: { ...capAction, targetId } })
                }
              />
              <CapabilityPicker
                targetType={targetType}
                value={capAction.capability}
                onChange={(capability) =>
                  onChange({ action: { ...capAction, capability } })
                }
              />
              {capabilityDef?.param && (
                <ParamField
                  param={capabilityDef.param}
                  value={capAction.params?.value}
                  onChange={(value) =>
                    onChange({ action: { ...capAction, params: { value } } })
                  }
                />
              )}
            </>
          )}

          {appParam && (
            <ParamField
              param={appParam}
              value={appParamValue}
              onChange={(value) => {
                if (rule.action.kind === "navigate") {
                  onChange({
                    action: {
                      kind: "navigate",
                      params: { path: String(value) },
                    },
                  });
                } else if (rule.action.kind === "toast") {
                  onChange({
                    action: {
                      kind: "toast",
                      params: { message: String(value) },
                    },
                  });
                }
              }}
            />
          )}
        </fieldset>
      )}
    </div>
  );
});
