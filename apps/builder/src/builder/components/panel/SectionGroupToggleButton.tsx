/**
 * SectionGroupToggleButton - 패널 헤더의 "모든 섹션 접기/펼치기" 토글
 *
 * 그룹이 전부 접혀 있으면 펼침 아이콘·라벨, 아니면 접기 아이콘·라벨을 보인다.
 * 판정·동작은 `useSectionGroupToggle` (useSectionCollapse store) 이 단일 원천이라
 * Components / Navigator 헤더와 Styles 의 ⌥S 단축키가 같은 규칙을 공유한다.
 */

import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { iconProps } from "../../../utils/ui/uiConstants";
import { ActionIconButton } from "../ui/ActionIconButton";
import { useSectionGroupToggle } from "../../panels/styles/hooks/useSectionCollapse";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../i18n";

export interface SectionGroupToggleButtonProps {
  /** 이 버튼이 다루는 Section id 집합 (Section `id` prop 과 같은 값) */
  sectionIds: readonly string[];
  /** 그룹이 화면에 없을 때 (예: 다른 탭) 비활성 */
  isDisabled?: boolean;
  className?: string;
}

const COLLAPSE_LABEL = "Collapse all sections";
const EXPAND_LABEL = "Expand all sections";

export function SectionGroupToggleButton({
  sectionIds,
  isDisabled,
  className,
}: SectionGroupToggleButtonProps) {
  const { allCollapsed, toggle } = useSectionGroupToggle(sectionIds);
  const i18n = useOptionalI18n();
  const fallback = allCollapsed ? EXPAND_LABEL : COLLAPSE_LABEL;
  const label = i18n
    ? translateKey(i18n.t, semanticLabelKeys[fallback] ?? fallback, fallback)
    : fallback;
  const Icon = allCollapsed ? ChevronsUpDown : ChevronsDownUp;

  return (
    <ActionIconButton
      aria-label={label}
      tooltip={label}
      isDisabled={isDisabled}
      onPress={toggle}
      className={className}
      data-section-group-collapsed={allCollapsed ? "true" : "false"}
    >
      <Icon
        color={iconProps.color}
        strokeWidth={iconProps.strokeWidth}
        size={iconProps.size}
      />
    </ActionIconButton>
  );
}
