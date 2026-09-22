/**
 * SettingsPanel - 설정 관리 패널
 *
 * PanelProps 인터페이스를 구현하여 패널 시스템과 통합
 * Builder 설정, 테마 등 시스템 설정 제공
 *
 * @updated 2025-12-29 - Save Mode, Preview & Overlay, Element Visualization 섹션 제거
 *   (WebGL 캔버스 전환 및 로컬 저장 방식으로 변경됨에 따라 불필요해짐)
 * @updated 2026-02-11 - Page Layout 설정 추가 (자동/가로/세로 페이지 배치, BuilderHeader에서 이동)
 * @updated 2026-03-05 - ADR-021 Phase D: 저장 테마 선택 UI 제거 (Tint System으로 대체)
 */

import { useCallback } from "react";
import { Settings } from "lucide-react";
import { ACTION_ICONS } from "../../config/actionIcons";
import { iconProps } from "../../../utils/ui/uiConstants";
import { useStore } from "../../stores";
import {
  normalizePageLayoutDirection,
  type PageLayoutDirection,
} from "../../stores/canvasSettings";
import { useUiStore } from "../../../stores/uiStore";
import {
  PropertySwitch,
  PropertyUnitInput,
  PropertySection,
  PropertySizeToggle,
  PanelHeader,
  PanelContents,
} from "../../components";
import { useThemeMessenger } from "@/builder/hooks";
import { LanguageSwitcher } from "@/i18n";
import { useI18n } from "@/i18n";
import { alignPagesToScreen } from "../../workspace/canvas/viewport/pageLayoutActions";
import { useCanonicalDocumentStore } from "../../stores/canonical/canonicalDocumentStore";
import { resolvePageLayout } from "../../workspace/canvas/scene/pagePlacement";

function SettingsContent() {
  const { sendDarkMode } = useThemeMessenger();
  const { t } = useI18n();

  // Grid & Guides 설정
  const snapToObjects = useStore((state) => state.snapToObjects);
  const setSnapToObjects = useStore((state) => state.setSnapToObjects);

  const showRulers = useStore((state) => state.showRulers);
  const actionBarHidden = useStore((state) => state.actionBar.hidden);
  const setActionBarHidden = useStore((state) => state.setActionBarHidden);
  const setShowRulers = useStore((state) => state.setShowRulers);

  // Page Layout 설정
  const pageLayoutDirection = useStore((state) => state.pageLayoutDirection);
  const setPageLayoutDirection = useStore(
    (state) => state.setPageLayoutDirection,
  );
  const pageGap = useStore((state) => state.pageGap);
  const setPageGap = useStore((state) => state.setPageGap);

  // ADR-232 — 파생 모드에서는 Page layout · gap · 열 수가 **문서 데이터** 다
  //   (localStorage 에서 승격). 미이관 문서는 현행 store/localStorage 그대로.
  const activeBreakpoint = useStore((state) => state.activeBreakpoint);
  const documentPageLayout = useCanonicalDocumentStore((state) => {
    const projectId = state.currentProjectId;
    return projectId ? state.documents.get(projectId)?.pageLayout : undefined;
  });
  const isDerivedPlacement = documentPageLayout?.placementModel === "derived";
  const resolvedPageLayout = resolvePageLayout(
    documentPageLayout,
    activeBreakpoint,
  );
  const effectiveDirection = isDerivedPlacement
    ? resolvedPageLayout.direction
    : normalizePageLayoutDirection(pageLayoutDirection);
  const effectiveGap = isDerivedPlacement ? resolvedPageLayout.gap : pageGap;
  const effectiveColumns = resolvedPageLayout.columns;
  const tierOverrideAvailable =
    isDerivedPlacement && activeBreakpoint !== "desktop";
  const hasTierOverride =
    tierOverrideAvailable &&
    (documentPageLayout?.responsive?.columns?.[activeBreakpoint] !==
      undefined ||
      documentPageLayout?.responsive?.gap?.[activeBreakpoint] !== undefined);

  /** 열 수·간격 쓰기 — tier 토글 ON 이면 활성 tier override, 아니면 base. */
  const writeLayoutValue = useCallback(
    (key: "gap" | "columns", value: number) => {
      const store = useCanonicalDocumentStore.getState();
      if (tierOverrideAvailable && hasTierOverride) {
        store.setPageLayout({
          responsive: {
            ...(documentPageLayout?.responsive ?? {}),
            [key]: {
              ...(documentPageLayout?.responsive?.[key] ?? {}),
              [activeBreakpoint]: value,
            },
          },
        });
        return;
      }
      store.setPageLayout({ [key]: value });
    },
    [
      activeBreakpoint,
      documentPageLayout?.responsive,
      hasTierOverride,
      tierOverrideAvailable,
    ],
  );

  const handleTierOverrideChange = useCallback(
    (selected: boolean) => {
      const store = useCanonicalDocumentStore.getState();
      const responsive = { ...(documentPageLayout?.responsive ?? {}) };
      if (selected) {
        // 켜는 순간 현재 유효값을 그 tier 에 고정한다 (토글 자체가 값을 바꾸지 않는다).
        responsive.columns = {
          ...(responsive.columns ?? {}),
          [activeBreakpoint]: resolvedPageLayout.columns,
        };
        responsive.gap = {
          ...(responsive.gap ?? {}),
          [activeBreakpoint]: resolvedPageLayout.gap,
        };
      } else {
        for (const key of ["columns", "gap"] as const) {
          const entry = { ...(responsive[key] ?? {}) };
          delete entry[activeBreakpoint];
          if (Object.keys(entry).length === 0) delete responsive[key];
          else responsive[key] = entry;
        }
      }
      store.setPageLayout({ responsive });
    },
    [
      activeBreakpoint,
      documentPageLayout?.responsive,
      resolvedPageLayout.columns,
      resolvedPageLayout.gap,
    ],
  );

  // UI 설정 (글로벌 uiStore에서 가져옴)
  const themeMode = useUiStore((state) => state.themeMode);
  const setThemeMode = useUiStore((state) => state.setThemeMode);

  const uiScale = useUiStore((state) => state.uiScale);
  const setUiScale = useUiStore((state) => state.setUiScale);

  const themeModeOptions = [
    { id: "light", label: t("settings.themeModeLight") },
    { id: "dark", label: t("settings.themeModeDark") },
    { id: "auto", label: t("settings.themeModeAuto") },
  ];

  const uiScaleOptions = [
    { id: "80", label: "S" },
    { id: "100", label: "M" },
    { id: "120", label: "L" },
  ];

  const pageLayoutOptions = [
    { id: "auto", label: t("settings.pageLayoutAuto") },
    { id: "horizontal", label: t("settings.pageLayoutHorizontal") },
    { id: "vertical", label: t("settings.pageLayoutVertical") },
  ];

  const handleThemeModeChange = (value: string) => {
    const mode = value as "light" | "dark" | "auto";
    setThemeMode(mode);

    const isDark =
      mode === "dark" ||
      (mode === "auto" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    sendDarkMode(isDark);
  };

  const handleUiScaleChange = (value: string) => {
    const scale = parseInt(value) as 80 | 100 | 120;
    setUiScale(scale);
  };

  const handlePageLayoutChange = (value: string) => {
    if (isDerivedPlacement) {
      // direction 은 breakpoint 공통 (`gridAutoFlow` 가 responsive eligible 이 아니다 — F11).
      useCanonicalDocumentStore.getState().setPageLayout({
        direction: normalizePageLayoutDirection(
          value as PageLayoutDirection,
        ) as "auto" | "vertical" | "horizontal",
      });
      return;
    }
    setPageLayoutDirection(value as PageLayoutDirection);
    alignPagesToScreen();
  };

  const handlePageGapChange = (value: string) => {
    const nextGap = Number.parseFloat(value);
    if (!Number.isFinite(nextGap) || nextGap < 0) return;
    if (isDerivedPlacement) {
      writeLayoutValue("gap", nextGap);
      return;
    }
    setPageGap(nextGap);
    alignPagesToScreen();
  };

  const handlePageColumnsChange = (value: string) => {
    const next = Number.parseInt(value, 10);
    if (!Number.isFinite(next) || next < 1) return;
    writeLayoutValue("columns", next);
  };

  return (
    <div className="panel settings-panel">
      <PanelHeader
        icon={<Settings size={iconProps.size} />}
        title={t("settings.title")}
        panelId="settings"
      />

      <PanelContents>
        {/* Canvas 절 (종전 Rulers & Guides — panel-ui 20) */}
        <PropertySection title={t("settings.rulersAndGuides")}>
          {/* r3 두 열 — Rulers | Action bar · Snap | Page gap (panel-ui 20, 2026-09-14) */}
          <div className="fieldset-row settings-row">
            {/* ADR-181 — 눈금자는 뷰포트 chrome (문서 데이터 아님).
                가이드 표시는 이 토글과 독립, 조작만 ON 을 요구한다 (C10). */}
            <PropertySwitch
              label={t("settings.showRulers")}
              isSelected={showRulers}
              onChange={setShowRulers}
              icon={ACTION_ICONS.toggleRulers}
            />

            {/* ADR-192 — 선택 액션 바. Hide 는 바의 옵션 메뉴에서, 재표시는
                여기서만 (Photoshop `Window > Contextual Task Bar` 대응). */}
            <PropertySwitch
              label={t("settings.showActionBar")}
              isSelected={!actionBarHidden}
              onChange={(selected: boolean) => setActionBarHidden(!selected)}
              icon={ACTION_ICONS.toggleRulers}
            />
          </div>

          <div className="fieldset-row settings-row">
            {/* ADR-179 — 페이지 간 가장자리·중앙 흡착 + 정렬선. 수동 가이드도
                흡착 후보로 참여한다 (`usePageDrag` 의 `guideLines`). */}
            <PropertySwitch
              label={t("settings.snapToObjects")}
              isSelected={snapToObjects}
              onChange={setSnapToObjects}
              icon={ACTION_ICONS.toggleSnap}
            />

            {/* 「80 PX」 — 아이콘 prefix · S/M/L preset ▾ 대신 단위 suffix + stepper (panel-ui 20 — 대조 B11) */}
            <PropertyUnitInput
              label={t("settings.pageGap")}
              value={`${effectiveGap}px`}
              min={0}
              max={2000}
              onChange={handlePageGapChange}
              units={["px"]}
              unitSuffix
              allowKeywords={false}
            />
          </div>

          {/* ADR-232 — 컨테이너 폭은 뷰포트가 아니라 **열 수** 다 (대안 D 기각). */}
          {isDerivedPlacement && effectiveDirection === "auto" && (
            <div className="fieldset-row settings-row">
              <PropertyUnitInput
                label={t("settings.pageColumns")}
                value={String(effectiveColumns)}
                min={1}
                max={24}
                onChange={handlePageColumnsChange}
                units={[""]}
                unitSuffix
                allowKeywords={false}
              />
              {tierOverrideAvailable && (
                <PropertySwitch
                  label={t("settings.pageLayoutTierOverride")}
                  isSelected={hasTierOverride}
                  onChange={handleTierOverrideChange}
                  icon={ACTION_ICONS.toggleRulers}
                />
              )}
            </div>
          )}

          <PropertySizeToggle
            label={t("settings.pageLayout")}
            value={effectiveDirection}
            onChange={handlePageLayoutChange}
            options={pageLayoutOptions}
            className="settings-page-layout-toggle"
          />
        </PropertySection>

        {/* Appearance 절 (종전 Theme & Appearance) */}
        <PropertySection title={t("settings.themeAppearance")}>
          <PropertySizeToggle
            label={t("settings.themeMode")}
            value={themeMode}
            onChange={handleThemeModeChange}
            options={themeModeOptions}
            className="settings-theme-mode-toggle"
          />

          <PropertySizeToggle
            label={t("settings.uiScale")}
            value={String(uiScale)}
            onChange={handleUiScaleChange}
            options={uiScaleOptions}
            className="settings-ui-scale-toggle"
          />

          {/* Language 는 별도 절이 아니라 Appearance 의 한 필드 (절 3 → 2) */}
          <LanguageSwitcher />
        </PropertySection>
      </PanelContents>
    </div>
  );
}

// 비활성 gating 은 PanelWorkspace 의 <Activity mode="hidden"> 이 담당 (ADR-922)
export function SettingsPanel() {
  return <SettingsContent />;
}
