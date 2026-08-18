/**
 * SettingsPanel - 설정 관리 패널
 *
 * PanelProps 인터페이스를 구현하여 패널 시스템과 통합
 * Builder 설정, 테마 등 시스템 설정 제공
 *
 * @updated 2025-12-29 - Save Mode, Preview & Overlay, Element Visualization 섹션 제거
 *   (WebGL 캔버스 전환 및 로컬 저장 방식으로 변경됨에 따라 불필요해짐)
 * @updated 2026-02-11 - Page Layout 설정 추가 (가로/세로/지그재그 페이지 배치, BuilderHeader에서 이동)
 * @updated 2026-03-05 - ADR-021 Phase D: Supabase 테마 선택 UI 제거 (Tint System으로 대체)
 */

import { LayoutGrid, ZoomIn, Moon, Sun, Settings } from "lucide-react";
import { ACTION_ICONS } from "../../config/actionIcons";
import { iconProps } from "../../../utils/ui/uiConstants";
import { useStore } from "../../stores";
import type { PageLayoutDirection } from "../../stores/canvasSettings";
import { useUiStore } from "../../../stores/uiStore";
import {
  PropertySwitch,
  PropertySelect,
  PropertySection,
  PanelHeader,
} from "../../components";
import { useThemeMessenger } from "@/builder/hooks";

function SettingsContent() {
  const { sendDarkMode } = useThemeMessenger();

  // Grid & Guides 설정
  const snapToObjects = useStore((state) => state.snapToObjects);
  const setSnapToObjects = useStore((state) => state.setSnapToObjects);

  const showRulers = useStore((state) => state.showRulers);
  const setShowRulers = useStore((state) => state.setShowRulers);

  // Page Layout 설정
  const pageLayoutDirection = useStore((state) => state.pageLayoutDirection);
  const setPageLayoutDirection = useStore(
    (state) => state.setPageLayoutDirection,
  );

  // UI 설정 (글로벌 uiStore에서 가져옴)
  const themeMode = useUiStore((state) => state.themeMode);
  const setThemeMode = useUiStore((state) => state.setThemeMode);

  const uiScale = useUiStore((state) => state.uiScale);
  const setUiScale = useUiStore((state) => state.setUiScale);

  // Theme Mode에 따른 아이콘 결정
  const getThemeModeIcon = () => {
    if (themeMode === "dark") return Moon;
    if (themeMode === "light") return Sun;
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    return prefersDark ? Moon : Sun;
  };

  const themeModeOptions = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "auto", label: "Auto (System)" },
  ];

  const uiScaleOptions = [
    { value: "80", label: "Small" },
    { value: "100", label: "Default" },
    { value: "120", label: "Large" },
  ];

  const pageLayoutOptions = [
    { value: "horizontal", label: "Horizontal" },
    { value: "vertical", label: "Vertical" },
    { value: "zigzag", label: "Zigzag" },
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

  return (
    <div className="panel settings-panel">
      <PanelHeader icon={<Settings size={iconProps.size} />} title="Settings" />

      <div className="panel-settings">
        {/* Rulers & Guides Section */}
        <PropertySection title="Rulers & Guides">
          {/* ADR-181 — 눈금자는 뷰포트 chrome (문서 데이터 아님).
              가이드 표시는 이 토글과 독립, 조작만 ON 을 요구한다 (C10). */}
          <PropertySwitch
            label="Show Rulers"
            isSelected={showRulers}
            onChange={setShowRulers}
            icon={ACTION_ICONS.toggleRulers}
          />

          {/* ADR-179 — 페이지 간 가장자리·중앙 흡착 + 정렬선. 수동 가이드도
              흡착 후보로 참여한다 (`usePageDrag` 의 `guideLines`). */}
          <PropertySwitch
            label="Snap to Objects"
            isSelected={snapToObjects}
            onChange={setSnapToObjects}
            icon={ACTION_ICONS.toggleSnap}
          />

          <PropertySelect
            label="Page Layout"
            value={pageLayoutDirection}
            onChange={(value) =>
              setPageLayoutDirection(value as PageLayoutDirection)
            }
            options={pageLayoutOptions}
            icon={LayoutGrid}
          />
        </PropertySection>

        {/* Theme Settings Section */}
        <PropertySection title="Theme & Appearance">
          <PropertySelect
            label="Theme Mode"
            value={themeMode}
            onChange={handleThemeModeChange}
            options={themeModeOptions}
            icon={getThemeModeIcon()}
          />

          <PropertySelect
            label="UI Scale"
            value={String(uiScale)}
            onChange={handleUiScaleChange}
            options={uiScaleOptions}
            icon={ZoomIn}
          />
        </PropertySection>
      </div>
    </div>
  );
}

// 비활성 gating 은 PanelContainer 의 <Activity mode="hidden"> 이 담당 (ADR-155)
export function SettingsPanel() {
  return <SettingsContent />;
}
