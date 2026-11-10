/**
 * Section - 모든 패널의 섹션 래퍼 컴포넌트
 *
 * 좌우 모든 패널에서 반복되는 section 구조를 통합 관리:
 * .section > .section-header + .section-content
 *
 * 기능:
 * - Collapse/Expand (persist 옵션)
 * - Reset 버튼 (onReset)
 * - Lazy Children (열릴 때만 렌더)
 * - 자유 액션 슬롯 (actions)
 * - Badge (count 등)
 * - React.memo + 커스텀 비교
 *
 * 접근성 (2026-11-10): RAC `Disclosure` 와 같은 계약을 속성으로 직접 적는다 — 머리글 heading 안의
 * trigger 버튼 (caret + 제목 + badge 전체가 누르는 영역) 이 `aria-expanded` · `aria-controls` 를,
 * 내용 영역이 `role="group"` · `aria-labelledby` (= 버튼, 이름은 제목) 를 갖는다. RAC 컴포넌트를 쓰지
 * 않는 이유는 비용 — `DisclosurePanel` 은 닫혀도 내용을 DOM 에 두지만 이 Section 은 닫힌 구획의
 * 내용을 렌더하지 않는다 (Design · Navigator 패널). 수동 ARIA 는 빌더 chrome 예외
 * (`.claude/rules/ssot-hierarchy.md` §1 D1). 닫혀 있을 때는 내용 영역이 없으므로 `aria-controls` 를 뺀다.
 */

import React, { memo, useId } from "react";
import { ChevronRight } from "lucide-react";
import { ACTION_ICONS } from "../../config/actionIcons";

const ResetIcon = ACTION_ICONS.reset;
import { iconProps } from "../../../utils/ui/uiConstants";
import { ActionIconButton } from "../ui/ActionIconButton";
import {
  isSectionCollapsedInState,
  useSectionCollapse,
} from "./useSectionCollapse";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../i18n";
import { Button } from "react-aria-components/Button";

type LazyChildren = React.ReactNode | (() => React.ReactNode);

export interface SectionProps {
  /** 섹션 제목 */
  title: string;
  /** 섹션 내용 (함수로 전달 시 lazy 평가) */
  children: LazyChildren;
  /** 섹션 ID (collapse 상태 persist 키) */
  id?: string;
  /** 초기 펼침 상태 (기본 true) */
  defaultExpanded?: boolean;
  /** Reset 버튼 핸들러 (undefined면 버튼 숨김) */
  onReset?: () => void;
  /** 헤더 우측 커스텀 액션 슬롯 */
  actions?: React.ReactNode;
  /** 제목 옆 badge (count 등) */
  badge?: React.ReactNode;
  /** collapse 토글 표시 여부 (기본 true) */
  collapsible?: boolean;
  /** 추가 CSS 클래스 */
  className?: string;
}

export const Section = memo(
  function Section({
    title,
    children,
    id,
    defaultExpanded = true,
    onReset,
    actions,
    badge,
    collapsible = true,
    className,
  }: SectionProps) {
    const i18n = useOptionalI18n();
    const displayTitle = i18n
      ? translateKey(i18n.t, semanticLabelKeys[title] ?? title, title)
      : title;
    const resetLabel = i18n
      ? translateKey(
          i18n.t,
          semanticLabelKeys["Reset section"] ?? "Reset section",
          "Reset section",
        )
      : "Reset section";
    const triggerId = useId();
    const panelId = useId();
    // 이 섹션의 collapsed 여부만 구독 (primitive boolean → 다른 섹션 toggle에 무반응)
    const persistedCollapsed = useSectionCollapse((s) =>
      id ? isSectionCollapsedInState(s, id) : false,
    );
    const toggleSection = useSectionCollapse((s) => s.toggleSection);

    const [localExpanded, setLocalExpanded] = React.useState(defaultExpanded);

    const hasPersistedState = id !== undefined;
    const isExpanded = collapsible
      ? hasPersistedState
        ? !persistedCollapsed
        : localExpanded
      : true;

    const handleToggle = () => {
      if (hasPersistedState && id) {
        toggleSection(id);
      } else {
        setLocalExpanded(!localExpanded);
      }
    };

    return (
      <div
        className={className ? `section ${className}` : "section"}
        data-section-id={id}
      >
        <div className="section-header">
          {/* 접힘 caret 은 제목 왼쪽 (▸ 접힘 / ▾ 펼침) — 접힌 절이 한 줄로 남아 목차가
              읽힌다 (panel-ui 01, 2026-09-14). 누르는 영역은 caret 만이 아니라 제목까지 (Disclosure). */}
          <h3 className="section-heading">
            {collapsible ? (
              <Button
                id={triggerId}
                className="section-trigger"
                onPress={handleToggle}
                aria-expanded={isExpanded}
                aria-controls={isExpanded ? panelId : undefined}
              >
                <span className="section-caret" aria-hidden="true">
                  <ChevronRight
                    color={iconProps.color}
                    strokeWidth={iconProps.strokeWidth}
                    size={iconProps.size}
                    style={{
                      transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                    }}
                  />
                </span>
                <span className="section-title">
                  {displayTitle}
                  {badge}
                </span>
              </Button>
            ) : (
              <span id={triggerId} className="section-title">
                {displayTitle}
                {badge}
              </span>
            )}
          </h3>
          <div className="section-actions">
            {/* Reset button — 절 헤더 액션의 기준 어법 (투명 32 아이콘 버튼). `actions` 로 오는
                버튼도 같은 ActionIconButton 을 쓴다 (2026-09-15 사용자 판정 — Fill 「+」 · Spacing
                펼침이 raised SwatchIconButton 이라 달랐다) */}
            {onReset && (
              <ActionIconButton
                onPress={onReset}
                aria-label={resetLabel}
                tooltip={resetLabel}
              >
                <ResetIcon
                  color={iconProps.color}
                  strokeWidth={iconProps.strokeWidth}
                  size={iconProps.size}
                />
              </ActionIconButton>
            )}

            {/* Custom actions */}
            {actions}
          </div>
        </div>
        {/* Lazy Children - 열릴 때만 children 평가 */}
        {isExpanded && (
          <div
            className="section-content"
            id={panelId}
            role="group"
            aria-labelledby={triggerId}
          >
            {typeof children === "function" ? children() : children}
          </div>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.title === nextProps.title &&
      prevProps.id === nextProps.id &&
      prevProps.defaultExpanded === nextProps.defaultExpanded &&
      prevProps.children === nextProps.children &&
      prevProps.collapsible === nextProps.collapsible &&
      prevProps.badge === nextProps.badge &&
      prevProps.actions === nextProps.actions &&
      prevProps.className === nextProps.className &&
      // 참조 비교 — 유무만 보면 같은 children 으로 다시 그릴 때 새 onReset 이 버려져 Reset 이
      //   옛 클로저 (이전 선택 · 값) 를 실행했다 (Section.test.tsx).
      prevProps.onReset === nextProps.onReset
    );
  },
);
