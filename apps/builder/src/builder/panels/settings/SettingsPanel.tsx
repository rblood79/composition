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

import { Settings } from "lucide-react";
import { ACTION_ICONS } from "../../config/actionIcons";
import { iconProps } from "../../../utils/ui/uiConstants";
import { useBuilderUiStore } from "../../stores/builderUiStore";
import {
  normalizePageLayoutDirection,
  type PageLayoutDirection,
} from "../../stores/canvasSettings";
import { useUiStore } from "../../../stores/uiStore";
import { PropertySwitch } from "../../components/property/PropertySwitch";
import { PropertyUnitInput } from "../../components/property/PropertyUnitInput";
import { Section as PropertySection } from "../../components/panel/Section";
import { PropertySizeToggle } from "../../components/property/PropertySizeToggle";
import { PanelHeader } from "../../components/panel/PanelHeader";
import { PanelContents } from "../../components/panel/PanelContents";
import { useThemeMessenger } from "../../hooks/useThemeMessenger";
import { LanguageSwitcher } from "@/i18n";
import { useI18n } from "@/i18n";
import { useCatalogPageLayout } from "./useCatalogPageLayout";
import { useCatalogToastPlacement } from "./useCatalogToastPlacement";
import type { CatalogToastPlacement } from "../../../../../../packages/shared/src/catalog/document/types";

function SettingsContent() {
  const { sendDarkMode } = useThemeMessenger();
  const { t } = useI18n();

  // Grid & Guides 설정
  const snapToObjects = useBuilderUiStore((state) => state.snapToObjects);
  const setSnapToObjects = useBuilderUiStore((state) => state.setSnapToObjects);

  const showRulers = useBuilderUiStore((state) => state.showRulers);
  const actionBarHidden = useBuilderUiStore((state) => state.actionBar.hidden);
  const setActionBarHidden = useBuilderUiStore(
    (state) => state.setActionBarHidden,
  );
  const setShowRulers = useBuilderUiStore((state) => state.setShowRulers);

  // ADR-248 4e — the open project's page grid is its catalog `pageLayout` declaration (the old
  // store / canonical document page layout went with the old Builder, 4e-7).
  const catalogLayout = useCatalogPageLayout();
  const layoutView = catalogLayout?.view;
  const effectiveDirection = layoutView?.direction ?? "horizontal";
  // auto 는 값 칸에 키워드로 싣는다 — 실제 열 수는 뷰포트에서 나오므로 여기 숫자를 쓰지 않는다.
  const columnsFieldValue = layoutView ? String(layoutView.columns) : "";

  // S2 ToastContainer placement — the open project's app (Preview · Publish) toast region. S2's
  // one value (`top` · `top end` · `bottom` · `bottom end`) is two fields here, as S2's Toast reads
  // it (`placement` + `align`) — four labels do not fit one row of the panel.
  const toastPlacement = useCatalogToastPlacement();
  const toastVertical = toastPlacement?.value.startsWith("top")
    ? "top"
    : "bottom";
  const toastAlign = toastPlacement?.value.endsWith("end") ? "end" : "center";
  const changeToast = (vertical: string, align: string) =>
    toastPlacement?.change(
      (align === "end"
        ? `${vertical} end`
        : vertical) as CatalogToastPlacement,
    );
  const toastPlacementOptions = [
    { id: "top", label: t("settings.toastPlacementTop") },
    { id: "bottom", label: t("settings.toastPlacementBottom") },
  ];
  const toastAlignOptions = [
    { id: "center", label: t("settings.toastAlignCenter") },
    { id: "end", label: t("settings.toastAlignEnd") },
  ];

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
    catalogLayout?.change({
      kind: "direction",
      direction: normalizePageLayoutDirection(value as PageLayoutDirection) as
        "auto" | "vertical" | "horizontal",
    });
  };

  const handlePageGapChange = (value: string) => {
    const nextGap = Number.parseFloat(value);
    if (!Number.isFinite(nextGap) || nextGap < 0) return;
    catalogLayout?.change({ kind: "gap", gap: nextGap });
  };

  const handlePageColumnsChange = (value: string) => {
    // ADR-232 후속 (2026-09-23) — "auto" = 보이는 캔버스 폭에 들어가는 만큼.
    if (value.trim().toLowerCase() === "auto") {
      catalogLayout?.change({ kind: "columns", columns: "auto" });
      return;
    }
    const next = Number.parseInt(value, 10);
    if (!Number.isFinite(next) || next < 1) return;
    catalogLayout?.change({ kind: "columns", columns: next });
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
              value={`${layoutView?.gap ?? 0}px`}
              min={0}
              max={2000}
              onChange={handlePageGapChange}
              units={["px"]}
              unitSuffix
              allowKeywords={false}
            />
          </div>

          {/* ADR-232 — 컨테이너 폭은 뷰포트가 아니라 **열 수** 다 (대안 D 기각). */}
          {layoutView && effectiveDirection === "auto" && (
            <div className="fieldset-row settings-row">
              <PropertyUnitInput
                label={t("settings.pageColumns")}
                value={columnsFieldValue}
                min={1}
                max={24}
                onChange={handlePageColumnsChange}
                // "auto" 는 단위 목록의 항목이자 타이핑으로도 받는 키워드다 (2026-09-23).
                units={["", "auto"]}
                unitSuffix
                allowKeywords
              />
              {layoutView.tierOverrideAvailable && (
                <PropertySwitch
                  label={t("settings.pageLayoutTierOverride")}
                  isSelected={layoutView.hasTierOverride}
                  onChange={(selected: boolean) =>
                    catalogLayout?.change({
                      kind: "tierOverride",
                      enabled: selected,
                    })
                  }
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

        {/* App 절 — the project's app (S2 ToastContainer placement) */}
        {toastPlacement && (
          <PropertySection title={t("settings.app")}>
            <div className="fieldset-row settings-row">
              <PropertySizeToggle
                label={t("settings.toastPlacement")}
                value={toastVertical}
                onChange={(value: string) => changeToast(value, toastAlign)}
                options={toastPlacementOptions}
                className="settings-toast-placement-toggle"
              />
              <PropertySizeToggle
                label={t("settings.toastAlign")}
                value={toastAlign}
                onChange={(value: string) => changeToast(toastVertical, value)}
                options={toastAlignOptions}
                className="settings-toast-align-toggle"
              />
            </div>
          </PropertySection>
        )}

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
