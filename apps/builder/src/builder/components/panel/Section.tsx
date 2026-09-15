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
 */

import React, { memo } from "react";
import { ChevronRight } from "lucide-react";
import { ACTION_ICONS } from "../../config/actionIcons";

const ResetIcon = ACTION_ICONS.reset;
import { iconProps } from "../../../utils/ui/uiConstants";
import { ActionIconButton } from "../ui/ActionIconButton";
import {
  isSectionCollapsedInState,
  useSectionCollapse,
} from "../../panels/styles/hooks/useSectionCollapse";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../i18n";

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
    const collapseLabel = i18n
      ? translateKey(
          i18n.t,
          semanticLabelKeys["Collapse section"] ?? "Collapse section",
          "Collapse section",
        )
      : "Collapse section";
    const expandLabel = i18n
      ? translateKey(
          i18n.t,
          semanticLabelKeys["Expand section"] ?? "Expand section",
          "Expand section",
        )
      : "Expand section";
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
              읽힌다 (panel-ui 01, 2026-09-14). 종전 우측 ∧ 는 접힘·펼침 무게가 같았다. */}
          {collapsible && (
            <button
              className="iconButton section-caret"
              type="button"
              onClick={handleToggle}
              aria-label={isExpanded ? collapseLabel : expandLabel}
              aria-expanded={isExpanded}
            >
              <ChevronRight
                color={iconProps.color}
                strokeWidth={iconProps.strokeWidth}
                size={iconProps.size}
                style={{
                  transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                }}
              />
            </button>
          )}
          <div className="section-title">
            {displayTitle}
            {badge}
          </div>
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
          <div className="section-content">
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
      !!prevProps.onReset === !!nextProps.onReset
    );
  },
);
