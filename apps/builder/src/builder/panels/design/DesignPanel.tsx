/**
 * DesignPanel — Properties · Styles 를 한 패널의 탭으로 (ADR-252)
 *
 * 탭 `Property | Layout | Style | Text | Screen`. Property = 컴포넌트 설정 본문
 * (`CatalogPropertiesPanel.tsx`), 나머지 넷 = Styles 그룹 (`StylesPanel.tsx`). 종전 Styles 의
 * Modified 뷰는 사용자 2026-10-04 판정으로 뺐다 (그룹 dot · 섹션 reset 이 같은 역할). 본문은 옮기기만
 * 했다 — 탭마다 종전 패널의 규칙 (다중 선택 대상 · sub-part 안내 · 빈 선택) 을 그대로 쓴다. 탭 줄은
 * 선택 상태와 무관하게 늘 보이고, 안내는 탭 본문만 바꾼다.
 *
 * 패널 id 는 `properties` 그대로다 (레이아웃 저장 키 — panel-structure.md §2). 탭 상태는
 * `designPanelView.ts` 의 세션 store.
 *
 * 단축키 (⌘⌥C / ⌘⌥V · ⌥⇧S / ⌥⇧E) 는 **활성 탭 쪽 등록부만 마운트**한다 (배타적 등록) — dispatcher 가
 * 같은 scope 의 첫 매치에서 멈추므로 두 쌍을 함께 등록하고 `canRun` 으로 가를 수 없다. 명령
 * registry 도 같은 등록으로 채워져 메뉴 · 팔레트에서 비활성 탭의 명령은 실행 불가로 보인다.
 */

import { memo, useCallback } from "react";
import { PaintRoller } from "lucide-react";
import { Tabs, TabPanel } from "react-aria-components/Tabs";
import { useI18n } from "../../../i18n";
import { iconProps } from "../../../utils/ui/uiConstants";
import { CatalogWorkspaceGate } from "../../catalogRuntime/react";
import { PanelHeader } from "../../components/panel/PanelHeader";
import { panelContents } from "../../components/panel/panelContentsUtils";
import {
  CatalogPropertiesBody,
  CatalogPropertiesHeaderActions,
  useCatalogPropertiesSelection,
} from "../properties/catalog/CatalogPropertiesPanel";
import { CatalogStylesHostProvider } from "../styles/catalog/CatalogStylesPanel";
import { CatalogStyleClipboardShortcuts } from "../styles/catalog/CatalogStyleClipboardShortcuts";
import { StylesPanelTabs } from "../styles/components/StylesPanelTabs";
import {
  StylesHeaderActions,
  StylesTabBody,
  StylesTabShortcuts,
  useStylesDirtyGroups,
} from "../styles/StylesPanel";
import type { StyleGroupId } from "../styles/constants/styleGroups";
import {
  DESIGN_VIEW_IDS,
  isStyleView,
  useDesignPanelView,
  type DesignViewId,
} from "./designPanelView";

// 비활성 gating 은 PanelWorkspace 의 <Activity mode="hidden"> 이 담당 (ADR-922)
export function DesignPanel() {
  return (
    <CatalogWorkspaceGate>
      <CatalogStylesHostProvider>
        <DesignPanelView />
      </CatalogStylesHostProvider>
    </CatalogWorkspaceGate>
  );
}

/** 패널 본체 — workspace · Styles host 는 바깥이 공급한다 (테스트 fixture 도 같은 자리). */
export function DesignPanelView() {
  const { t } = useI18n();
  const view = useDesignPanelView((s) => s.view);
  const setView = useDesignPanelView((s) => s.setView);
  const selection = useCatalogPropertiesSelection();
  const styleView = isStyleView(view);

  const handleViewChange = useCallback(
    (key: React.Key) => setView(key as DesignViewId),
    [setView],
  );

  return (
    <div className="panel">
      <PanelHeader
        icon={
          <PaintRoller
            color={iconProps.color}
            size={iconProps.size}
            strokeWidth={iconProps.strokeWidth}
          />
        }
        title={selection.title ?? t("panels.properties")}
        panelId="properties"
        actions={
          styleView ? (
            <StylesHeaderActions />
          ) : (
            <CatalogPropertiesHeaderActions selection={selection} />
          )
        }
      />
      {/* 활성 탭 쪽 단축키만 등록한다 (Property 쪽 ⌘⌥C/V 는 헤더 액션이 등록). */}
      {styleView && (
        <>
          <CatalogStyleClipboardShortcuts />
          <StylesTabShortcuts />
        </>
      )}

      <Tabs
        className="panel-tabs"
        selectedKey={view}
        onSelectionChange={handleViewChange}
      >
        <div className="panel-header panel-tabrow">
          <DesignPanelTabList styleView={styleView} />
        </div>

        {DESIGN_VIEW_IDS.map((id) => (
          <TabPanel
            key={id}
            id={id}
            className={panelContents(
              isStyleView(id)
                ? "styles-panel-groups"
                : "design-property-contents",
            )}
          >
            {isStyleView(id) ? (
              <StylesTabBody view={id} />
            ) : (
              <CatalogPropertiesBody selection={selection} />
            )}
          </TabPanel>
        ))}
      </Tabs>
    </div>
  );
}

/**
 * 탭 줄 — 스타일 그룹 dot 은 **스타일 탭이 활성일 때만** 구독한다. Property 탭에서는 dot 없이
 * 그린다: 구독하면 선택이 바뀔 때마다 스타일 dirty 계산 · 탭 재렌더가 Property 탭 비용에 더해진다
 * (ADR-252 G4 — 통합 전 「Properties 만 열림」 의 선택 변경 카운트를 넘었다: DOM 속성 변경
 * 243 → 307 · i18n 호출 +926). 통합 전에도 dot 은 Styles 패널 안에서만 보였다.
 */
const NO_DIRTY_GROUPS: ReadonlySet<StyleGroupId> = new Set();

const DesignPanelTabList = memo(function DesignPanelTabList({
  styleView,
}: {
  styleView: boolean;
}) {
  return styleView ? (
    <MarkedStylesPanelTabs />
  ) : (
    <StylesPanelTabs dirtyGroups={NO_DIRTY_GROUPS} />
  );
});

function MarkedStylesPanelTabs() {
  return <StylesPanelTabs dirtyGroups={useStylesDirtyGroups()} />;
}
