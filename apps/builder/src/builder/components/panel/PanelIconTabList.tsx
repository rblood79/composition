/**
 * PanelIconTabList — 패널 아이콘 탭 줄 (선택된 탭에만 라벨). Navigator · Design 이 같이 쓴다 (2026-11-10).
 *
 * 탭마다 아이콘을 두고 **선택된 탭만** 아이콘 옆에 이름을 단다. 탭 폭은 내용 (아이콘 + 라벨) 이 정한다 —
 * 남는 폭으로 늘이지 않는다 (탭 수에 따라 두 패널의 선택 탭 폭이 달라졌다). 나머지는 아이콘 폭만
 * 쓰고, 이름은 `aria-label` 로 남는다 (화면 읽기 · hover 설명). 패널 최소 폭 233px 에서도 선택 탭 라벨이
 * 잘리지 않는다 (ADR-252 실측 — Design 탭 5 개).
 *
 * Why 이 형태인가 (최소 폭 제약):
 * - 라벨을 전부 달면 탭 줄이 폭을 다 먹어 머리글 액션을 밀어내고, 좁은 폭에서 라벨이 「Com…」 로 잘린다.
 * - 전부 아이콘만 두면 관용 아이콘이 없는 탭 (Layout · Style) 이 읽히지 않는다.
 * - 선택된 탭만 라벨 → 지금 위치는 항상 글자로 읽힌다.
 * 종전 Navigator 는 폭 320 이상이면 모든 탭에 라벨을 달아 (container query) 두 패널의 탭이 달랐다.
 *
 * `marked` 탭은 선택되지 않았을 때 아이콘 우상단 dot 으로 표시한다 (Design 의 수정된 스타일 그룹).
 * 구조 class 는 `panelTabs.static.test.ts` 의 정본 조합 (`.panel-tablist` > `.panel-tab` +
 * `.panel-tab-label`) 이고, 아이콘 탭 모양은 `panel-system.css` §아이콘 탭이 소유한다.
 */

import type { Key } from "react-stately";
import { Tab, TabList } from "react-aria-components/Tabs";
import type { LucideIcon } from "lucide-react";
import { iconProps } from "../../../utils/ui/uiConstants";

export interface PanelIconTab<K extends Key> {
  id: K;
  label: string;
  Icon: LucideIcon;
  /** hover 설명 — `라벨 — 설명` 으로 보인다 */
  hint?: string;
  /** 선택되지 않았을 때 dot 표시 (예: 수정된 값이 있는 그룹) */
  marked?: boolean;
}

interface PanelIconTabListProps<K extends Key> {
  tabs: readonly PanelIconTab<K>[];
  "aria-label": string;
}

export function PanelIconTabList<K extends Key>({
  tabs,
  "aria-label": ariaLabel,
}: PanelIconTabListProps<K>) {
  return (
    <TabList className="panel-tablist" aria-label={ariaLabel}>
      {tabs.map(({ id, label, Icon, hint, marked }) => (
        <Tab
          key={id}
          id={id}
          className="panel-tab panel-icon-tab"
          aria-label={label}
        >
          {({ isSelected }) => (
            /* RAC `Tab` 은 `title` 을 받지 않으므로 안쪽 요소가 진다 */
            <span
              className="panel-icon-tab-inner"
              title={hint ? `${label} — ${hint}` : label}
            >
              {/* 선택 상태에 따라 색이 바뀌어야 하므로 아이콘 색은 CSS(currentColor)가 준다. */}
              <Icon
                color="currentColor"
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
              {isSelected ? (
                <span className="panel-tab-label">{label}</span>
              ) : (
                marked && (
                  <span className="panel-icon-tab-dot" aria-hidden="true" />
                )
              )}
            </span>
          )}
        </Tab>
      ))}
    </TabList>
  );
}
