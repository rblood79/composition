/**
 * ADR-158 Phase 2 — Interactions 패널 (구 EventsPanel 대체).
 *
 * 규칙 1개 = 한 줄: `When(RAC callback) → Do(앱 액션 | 대상 capability)`.
 * 조건 / 타이밍 / 템플릿 / 추천 엔진 / 액션 25종은 전부 은퇴했다 (ADR-158 §Decision).
 *
 * 읽기·쓰기 모두 canonical `events` root collection 직행 (`useInteractionRules`) —
 * 구 패널의 legacy projection 비의존.
 *
 * 구조는 ADR-163 패널 표준을 따른다: `.panel > PanelHeader + .panel-contents >
 * Section > .section-content`. 비활성 gating 은 PanelContainer 의
 * `<Activity mode="hidden">` 담당 (ADR-155).
 */
import { useCallback, useState } from "react";
import { Plus, SquareMousePointer } from "lucide-react";
import { resolveTriggers } from "@composition/shared";

import { EmptyState, PanelHeader, Section } from "../../components";
import { useDebouncedSelectedElementData } from "../../stores";
import { RuleRow } from "./RuleRow";
import { useInteractionRules } from "./useInteractionRules";
import "./InteractionsPanel.css";

export function InteractionsPanel() {
  const selectedElement = useDebouncedSelectedElementData();

  if (!selectedElement) {
    return (
      <div className="panel interactions-panel">
        <PanelHeader title="Interactions" icon={<SquareMousePointer size={14} />} />
        <div className="panel-contents">
          <EmptyState message="요소를 선택하세요" />
        </div>
      </div>
    );
  }

  return (
    <InteractionsPanelContent
      key={selectedElement.id}
      elementId={selectedElement.id}
      componentType={selectedElement.type}
    />
  );
}

interface InteractionsPanelContentProps {
  elementId: string;
  componentType: string;
}

function InteractionsPanelContent({
  elementId,
  componentType,
}: InteractionsPanelContentProps) {
  const { rules, addRule, updateRule, removeRule } =
    useInteractionRules(elementId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const triggers = resolveTriggers(componentType);
  const canTrigger = triggers.length > 0;

  const handleAdd = useCallback(() => {
    if (!canTrigger) return;
    addRule(triggers[0]);
    // 새 규칙은 바로 펼쳐서 편집 — id 는 addRule 내부 생성이라 다음 렌더에서 잡는다
    setExpandedId(null);
  }, [addRule, canTrigger, triggers]);

  return (
    <div className="panel interactions-panel">
      <PanelHeader title="Interactions" icon={<SquareMousePointer size={14} />} />
      <div className="panel-contents">
        <Section
          title="규칙"
          id="interactions-rules"
          badge={rules.length > 0 ? String(rules.length) : undefined}
        >
          {!canTrigger ? (
            <EmptyState
              message={`${componentType} 은 트리거를 제공하지 않습니다`}
            />
          ) : (
            <>
              {rules.length === 0 && (
                <p className="interactions-empty">
                  아직 규칙이 없습니다. 규칙을 추가해 이 요소의 동작을
                  정의하세요.
                </p>
              )}

              {rules.map((rule) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  componentType={componentType}
                  expanded={expandedId === rule.id}
                  onToggle={() =>
                    setExpandedId((cur) => (cur === rule.id ? null : rule.id))
                  }
                  onChange={(patch) => updateRule(rule.id, patch)}
                  onRemove={() => {
                    if (expandedId === rule.id) setExpandedId(null);
                    removeRule(rule.id);
                  }}
                />
              ))}

              <button
                type="button"
                className="interactions-add"
                onClick={handleAdd}
              >
                <Plus size={14} />
                규칙 추가
              </button>
            </>
          )}
        </Section>
      </div>
    </div>
  );
}
