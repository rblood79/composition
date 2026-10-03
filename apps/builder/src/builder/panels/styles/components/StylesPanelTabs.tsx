/**
 * StylesPanelTabs — Design 패널 뷰 탭 (선택된 탭에만 라벨)
 *
 * Property (컴포넌트 설정 — ADR-252) + 그룹 4개(Layout / Style / Text / Screen) 를 한 줄에 두고,
 * **선택된 탭만** 아이콘 옆에 이름을 달아 남는 폭을 가져간다. 나머지는 아이콘 폭만 쓴다.
 * 탭 5개라 패널 최소 폭 233px 에서도 선택 탭 라벨이 잘리지 않는다 (ADR-252 실측 — 6탭이던 때는
 * en 「Property」 47px 가 262px 에서야 들어갔다. 6번째 Modified 탭은 사용자 2026-10-04 판정으로 뺐다).
 *
 * Why 이 형태인가 (최소 폭 제약):
 * - 라벨을 전부 달면 탭 줄이 폭을 다 먹어 복사/붙여넣기를 밀어내고, 거기서 요소 이름과 자리를 다툰다.
 * - 전부 아이콘만 두면 Layout · Style 은 관용 아이콘이 없어 읽히지 않는다.
 * - 선택된 탭만 라벨 → 지금 위치는 항상 글자로 읽히고, 패널을 넓히면 라벨 자리도 같이 넓어진다.
 *
 * 수정된 값이 있는데 선택되지 않은 **스타일 그룹**은 아이콘 우상단 dot 으로 표시한다. dot 판정은
 * 섹션 reset 버튼과 같은 dirty 소스를 쓴다(styleGroups.ts). Property 탭에는 dot 이 없다.
 */

import { Frame, Paintbrush, Settings2, Smartphone, Type } from "lucide-react";
import { Tab, TabList } from "react-aria-components/Tabs";
import { iconProps } from "../../../../utils/ui/uiConstants";
import type { StyleGroupId } from "../constants/styleGroups";
import {
  DESIGN_VIEW_IDS,
  isStyleView,
  type DesignViewId,
} from "../../design/designPanelView";
import { useI18n } from "../../../../i18n";

interface StylesPanelTabsProps {
  /** 기본값과 다른 값을 가진 그룹 — 선택되지 않은 탭에 dot 을 띄운다. */
  dirtyGroups: ReadonlySet<StyleGroupId>;
}

export function StylesPanelTabs({ dirtyGroups }: StylesPanelTabsProps) {
  const { t } = useI18n();
  const viewMeta: Record<
    DesignViewId,
    { label: string; hint: string; Icon: typeof Frame }
  > = {
    property: {
      label: t("styles.property"),
      hint: t("styles.propertyHint"),
      Icon: Settings2,
    },
    layout: {
      label: t("styles.layout"),
      hint: t("styles.layoutHint"),
      Icon: Frame,
    },
    style: {
      label: t("styles.style"),
      hint: t("styles.styleHint"),
      Icon: Paintbrush,
    },
    text: {
      label: t("styles.text"),
      hint: t("styles.textHint"),
      Icon: Type,
    },
    screen: {
      label: t("styles.screen"),
      hint: t("styles.screenHint"),
      Icon: Smartphone,
    },
  };

  return (
    <TabList className="panel-tablist" aria-label={t("styles.view")}>
      {DESIGN_VIEW_IDS.map((id) => {
        const { label, hint, Icon } = viewMeta[id];
        return (
          <Tab
            key={id}
            id={id}
            className="panel-tab styles-panel-tab"
            aria-label={label}
          >
            {({ isSelected }) => (
              /* 아이콘만 보이는 탭이 무엇을 담는지는 hover 로 읽는다. RAC `Tab` 은
                 DOM 이벤트만 통과시키고 `title` 은 받지 않으므로 안쪽 요소가 진다. */
              <span
                className="styles-panel-tab-inner"
                title={`${label} — ${hint}`}
              >
                {/* 선택 상태에 따라 색이 바뀌어야 하므로 아이콘 색은 CSS(currentColor)가 준다. */}
                <Icon
                  color="currentColor"
                  size={iconProps.size}
                  strokeWidth={iconProps.strokeWidth}
                />
                {isSelected ? (
                  <span className="panel-tab-label styles-panel-tab-label">
                    {label}
                  </span>
                ) : (
                  isStyleView(id) &&
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
