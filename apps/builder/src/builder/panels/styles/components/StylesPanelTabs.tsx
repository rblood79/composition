/**
 * StylesPanelTabs — 스타일 패널 뷰 탭 (선택된 탭에만 라벨)
 *
 * 그룹 4개(Layout / Style / Text / Screen) + Modified 를 한 줄에 두고, **선택된 탭만** 아이콘
 * 옆에 이름을 달아 남는 폭을 가져간다. 나머지는 아이콘 폭(20px)만 쓴다.
 *
 * Why 이 형태인가 (233px 최소 폭 제약):
 * - 라벨을 전부 달면 탭 줄이 폭을 다 먹어 복사/붙여넣기를 밀어내고, 거기서 요소 이름과 자리를 다툰다.
 * - 전부 아이콘만 두면 Layout · Style 은 관용 아이콘이 없어 읽히지 않는다.
 * - 선택된 탭만 라벨 → 지금 위치는 항상 글자로 읽히고, 패널을 넓히면 라벨 자리도 같이 넓어진다.
 *
 * Modified 가 여기 함께 있는 이유는 styleGroups.ts `StyleViewId` 주석 참조 — 같은 영역을
 * 배타적으로 차지하는 뷰라 컨트롤이 하나여야 한다.
 *
 * 수정된 값이 있는데 선택되지 않은 **그룹**은 아이콘 우상단 dot 으로 표시한다. Modified 탭에는
 * dot 을 찍지 않는다 — 그 값은 그룹 dot 들의 OR 라 정의상 중복이고, 5개가 전부 점을 달면 신호가
 * 묽어진다. dot 판정은 섹션 reset 버튼과 같은 dirty 소스를 쓴다(styleGroups.ts).
 */

import { Frame, Paintbrush, PencilRuler, Smartphone, Type } from "lucide-react";
import { Tab, TabList } from "react-aria-components";
import { iconProps } from "../../../../utils/ui/uiConstants";
import type { StyleGroupId, StyleViewId } from "../constants/styleGroups";
import { isStyleGroupId, STYLE_VIEW_IDS } from "../constants/styleGroups";

const VIEW_META: Record<
  StyleViewId,
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
  modified: {
    label: "Modified",
    hint: "기본값과 다른 속성만",
    Icon: PencilRuler,
  },
};

interface StylesPanelTabsProps {
  /** 기본값과 다른 값을 가진 그룹 — 선택되지 않은 탭에 dot 을 띄운다. */
  dirtyGroups: ReadonlySet<StyleGroupId>;
  /** Modified 탭 tooltip 에 개수를 실어 준다 (탭 라벨에는 숫자를 쓰지 않는다). */
  modifiedCount: number;
}

export function StylesPanelTabs({
  dirtyGroups,
  modifiedCount,
}: StylesPanelTabsProps) {
  return (
    <TabList className="styles-panel-tablist" aria-label="스타일 뷰">
      {STYLE_VIEW_IDS.map((id) => {
        const { label, hint, Icon } = VIEW_META[id];
        const isGroup = isStyleGroupId(id);
        const title =
          isGroup || modifiedCount === 0
            ? `${label} — ${hint}`
            : `${label} — ${hint} ${modifiedCount}개`;
        return (
          <Tab
            key={id}
            id={id}
            className="styles-panel-tab"
            aria-label={
              isGroup || modifiedCount === 0
                ? label
                : `${label} (${modifiedCount})`
            }
          >
            {({ isSelected }) => (
              /* 아이콘만 보이는 탭이 무엇을 담는지는 hover 로 읽는다. RAC `Tab` 은
                 DOM 이벤트만 통과시키고 `title` 은 받지 않으므로 안쪽 요소가 진다. */
              <span className="styles-panel-tab-inner" title={title}>
                {/* 선택 상태에 따라 색이 바뀌어야 하므로 아이콘 색은 CSS(currentColor)가 준다. */}
                <Icon
                  color="currentColor"
                  size={iconProps.size}
                  strokeWidth={iconProps.strokeWidth}
                />
                {isSelected ? (
                  <span className="styles-panel-tab-label">{label}</span>
                ) : (
                  isGroup &&
                  dirtyGroups.has(id) && (
                    <span className="styles-panel-tab-dot" aria-hidden="true" />
                  )
                )}
              </span>
            )}
          </Tab>
        );
      })}
    </TabList>
  );
}
