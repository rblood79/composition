/**
 * StylesPanelTabs — 스타일 패널 그룹 탭 (선택된 탭에만 라벨)
 *
 * 4개 그룹(Layout / Style / Text / Screen)을 한 줄에 두고, **선택된 탭만** 아이콘 옆에 이름을
 * 달아 남는 폭을 가져간다. 나머지 3개는 아이콘 폭만 쓴다.
 *
 * Why 이 형태인가 (233px 최소 폭 제약):
 * - 라벨 4개를 전부 달면 탭 줄이 폭을 다 먹어 복사/붙여넣기 액션을 타이틀 줄로 밀어내야 하고,
 *   거기서 요소 이름과 자리를 다툰다.
 * - 전부 아이콘만 두면 액션과 한 줄에 들어가지만 Layout · Style 은 관용 아이콘이 없어 읽히지 않는다.
 * - 선택된 탭만 라벨 → 지금 위치는 항상 글자로 읽히고, 액션도 같은 줄에 남는다. 패널을 넓히면
 *   (233→640px) 선택 탭이 남는 폭을 먹어 라벨 자리도 같이 넓어진다.
 *
 * 수정된 값이 있는데 선택되지 않은 그룹은 아이콘 우상단 dot 으로 표시한다 — 탭이 섹션을 가리는
 * 대가를 상쇄하는 장치라 생략하면 "숨겨진 그룹의 수정"이 보이지 않는다.
 * dot 판정은 섹션 reset 버튼과 같은 dirty 소스를 쓴다(styleGroups.ts).
 */

import { Frame, Paintbrush, Smartphone, Type } from "lucide-react";
import { Tab, TabList } from "react-aria-components";
import { iconProps } from "../../../../utils/ui/uiConstants";
import type { StyleGroupId } from "../constants/styleGroups";
import { STYLE_GROUP_IDS } from "../constants/styleGroups";

const GROUP_META: Record<
  StyleGroupId,
  { label: string; hint: string; Icon: typeof Frame }
> = {
  layout: { label: "Layout", hint: "Transform · Layout", Icon: Frame },
  style: { label: "Style", hint: "Appearance", Icon: Paintbrush },
  text: { label: "Text", hint: "Typography", Icon: Type },
  screen: {
    label: "Screen",
    hint: "Responsive · Visibility",
    Icon: Smartphone,
  },
};

interface StylesPanelTabsProps {
  /** 기본값과 다른 값을 가진 그룹 — 선택되지 않은 탭에 dot 을 띄운다. */
  dirtyGroups: ReadonlySet<StyleGroupId>;
}

export function StylesPanelTabs({ dirtyGroups }: StylesPanelTabsProps) {
  return (
    <TabList className="styles-panel-tablist" aria-label="스타일 그룹">
      {STYLE_GROUP_IDS.map((id) => {
        const { label, hint, Icon } = GROUP_META[id];
        return (
          <Tab
            key={id}
            id={id}
            className="styles-panel-tab"
            aria-label={label}
            title={`${label} — ${hint}`}
          >
            {({ isSelected }) => (
              <>
                {/* 선택 상태에 따라 색이 바뀌어야 하므로 아이콘 색은 CSS(currentColor)가 준다. */}
                <Icon
                  color="currentColor"
                  size={iconProps.size}
                  strokeWidth={iconProps.strokeWidth}
                />
                {isSelected ? (
                  <span className="styles-panel-tab-label">{label}</span>
                ) : (
                  dirtyGroups.has(id) && (
                    <span className="styles-panel-tab-dot" aria-hidden="true" />
                  )
                )}
              </>
            )}
          </Tab>
        );
      })}
    </TabList>
  );
}
