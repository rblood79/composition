/**
 * LayoutPresetSelector - 레이아웃 프리셋 선택 컴포넌트
 *
 * Phase 6: Layout 프리셋 시스템 메인 컴포넌트
 *
 * 기능:
 * 1. 카테고리별 프리셋 그리드 표시
 * 2. SVG 미리보기 썸네일
 * 3. 기존 Slot 감지 시 확인 다이얼로그
 * 4. 프리셋 적용 (History 단일 엔트리)
 */

import { memo, useCallback, useMemo, useState } from "react";
import {
  Columns2,
  Layout,
  LayoutDashboard,
  LayoutGrid,
  List,
  Rows3,
} from "lucide-react";
import { Button } from "@composition/shared/components";
import { PresetPreview } from "./PresetPreview";
import { ExistingSlotDialog } from "./ExistingSlotDialog";
import { usePresetApply } from "./usePresetApply";
import { derivePreviewAreas } from "./derivePreviewAreas";
import {
  LAYOUT_PRESETS,
  PRESET_CATEGORIES,
  PRESET_ORDER,
} from "./presetDefinitions";
import type { PresetApplyMode, PreviewArea } from "./types";
import { useStore } from "../../../../stores";
import "./styles.css";
import { iconEditProps } from "../../../../../utils/ui/uiConstants";

interface LayoutPresetSelectorProps {
  /** Layout ID */
  layoutId: string;
  /** Body Element ID */
  bodyElementId: string;
}

/**
 * 아이콘 이름 → 컴포넌트 조회 (ADR-168 P-5).
 *
 * 카테고리별 매핑이 아니라 **이름 조회 맵**이다. 어느 카테고리가 어느 아이콘을 쓰는지는
 * `PRESET_CATEGORIES[x].icon` 문자열이 단독으로 정한다 — 카테고리를 추가할 때 손댈 곳이
 * 메타 한 곳으로 줄고, 두 목록이 어긋날 자리가 없어진다.
 */
const ICON_BY_NAME: Record<string, typeof Layout> = {
  Layout,
  Columns2,
  LayoutGrid,
  LayoutDashboard,
  List,
  Rows3,
};

export const LayoutPresetSelector = memo(function LayoutPresetSelector({
  layoutId,
  bodyElementId,
}: LayoutPresetSelectorProps) {
  // 선택된 프리셋 상태
  const [selectedPresetKey, setSelectedPresetKey] = useState<string | null>(
    null,
  );
  // 다이얼로그 열림 상태
  const [dialogOpen, setDialogOpen] = useState(false);

  // 썸네일 기준 breakpoint — 헤더의 캔버스 breakpoint 토글을 그대로 따른다 (ADR-168 P-7 정정).
  //
  // 패널 안에 별도 세그먼트를 뒀다가 제거했다: 헤더에 이미 같은 개념의 컨트롤이 있어 중복이고,
  // 두 컨트롤이 어긋나면 "썸네일은 mobile, 캔버스는 desktop" 같은 상태가 만들어진다.
  // 컨트롤은 하나, 의미도 하나다.
  const activeBreakpoint = useStore((s) => s.activeBreakpoint);

  // 프리셋 적용 훅
  const { existingSlots, currentPresetKey, applyPreset, isApplying } =
    usePresetApply({
      layoutId,
      bodyElementId,
    });

  // 카테고리별 프리셋 그룹화.
  //
  // 초기값을 `PRESET_CATEGORIES` 에서 만든다 (ADR-168 P-4). 하드코딩이던 시절엔 메타에만
  // 있는 신규 카테고리의 프리셋이 들어오면 `groups[category]` 가 undefined 라 `.push` 에서
  // TypeError 로 패널 전체가 죽었다. 이제 카테고리 추가는 메타 한 곳으로 끝난다.
  const presetsByCategory = useMemo(() => {
    const groups: Record<string, string[]> = Object.fromEntries(
      Object.keys(PRESET_CATEGORIES).map((category) => [category, []]),
    );

    PRESET_ORDER.forEach((key) => {
      const preset = LAYOUT_PRESETS[key];
      if (!preset) return;
      // 메타에 없는 카테고리도 흘려보내지 않는다 — 프리셋이 조용히 사라지느니 드러나야 한다
      (groups[preset.category] ??= []).push(key);
    });

    return groups;
  }, []);

  // 썸네일 사각형은 breakpoint 가 바뀔 때만 다시 파생한다. 프리셋 10개 × 파생을 매 렌더마다
  // 돌리면 `PresetPreview` 의 `memo` 도 무력해진다 (areas 배열 identity 가 매번 새로 생김).
  const areasByPreset = useMemo(() => {
    const derived: Record<string, PreviewArea[]> = {};
    PRESET_ORDER.forEach((key) => {
      const preset = LAYOUT_PRESETS[key];
      if (preset) derived[key] = derivePreviewAreas(preset, activeBreakpoint);
    });
    return derived;
  }, [activeBreakpoint]);

  // 프리셋 클릭 핸들러
  const handlePresetClick = useCallback(
    (presetKey: string) => {
      // ⭐ 동일한 프리셋이 이미 적용되어 있으면 무시
      if (currentPresetKey === presetKey) {
        console.log(`[Preset] "${presetKey}" is already applied, skipping`);
        return;
      }

      setSelectedPresetKey(presetKey);

      // 기존 Slot이 있으면 다이얼로그 표시
      if (existingSlots.length > 0) {
        setDialogOpen(true);
      } else {
        // 기존 Slot이 없으면 바로 적용
        applyPreset(presetKey, "replace");
      }
    },
    [existingSlots.length, currentPresetKey, applyPreset],
  );

  // 다이얼로그 확인 핸들러
  const handleDialogConfirm = useCallback(
    (mode: PresetApplyMode) => {
      if (selectedPresetKey && mode !== "cancel") {
        applyPreset(selectedPresetKey, mode);
      }
      setDialogOpen(false);
      setSelectedPresetKey(null);
    },
    [selectedPresetKey, applyPreset],
  );

  // 다이얼로그 닫기 핸들러
  const handleDialogClose = useCallback(() => {
    setDialogOpen(false);
    setSelectedPresetKey(null);
  }, []);

  return (
    <>
      {Object.entries(PRESET_CATEGORIES).map(([categoryKey, meta]) => {
        const presetKeys = presetsByCategory[categoryKey];
        if (!presetKeys || presetKeys.length === 0) return null;

        const CategoryIcon = ICON_BY_NAME[meta.icon] ?? Layout;

        return (
          <div key={categoryKey} className="list-subgroup">
            <div className="list-subgroup-header">
              <CategoryIcon
                size={iconEditProps.size}
                className="list-subgroup-icon"
              />
              <span className="list-subgroup-title">{meta.label}</span>
            </div>

            <div className="list-group" role="list">
              {presetKeys.map((presetKey) => {
                const preset = LAYOUT_PRESETS[presetKey];
                if (!preset) return null;

                const isSelected = selectedPresetKey === presetKey;
                const isApplied = currentPresetKey === presetKey;

                return (
                  <Button
                    key={presetKey}
                    variant="secondary"
                    className={`list-item preset-card ${isSelected ? "selected" : ""} ${isApplied ? "applied" : ""}`}
                    onPress={() => handlePresetClick(presetKey)}
                    isDisabled={isApplying}
                  >
                    <PresetPreview
                      areas={areasByPreset[presetKey] ?? []}
                      width={80}
                      height={60}
                    />
                    <span className="list-item-name">{preset.name}</span>
                    {isApplied && (
                      <span className="list-item-badge applied">적용됨</span>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 기존 Slot 처리 다이얼로그 */}
      <ExistingSlotDialog
        isOpen={dialogOpen}
        existingSlots={existingSlots}
        presetName={
          selectedPresetKey ? LAYOUT_PRESETS[selectedPresetKey]?.name || "" : ""
        }
        onConfirm={handleDialogConfirm}
        onClose={handleDialogClose}
      />
    </>
  );
});

export default LayoutPresetSelector;
