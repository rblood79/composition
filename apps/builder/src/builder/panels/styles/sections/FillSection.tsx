/**
 * FillSection — Style 탭 Fill 절 (레이어 목록)
 *
 * 절 헤더 「+」 로 레이어 추가, 본문은 레이어 행 (`FillLayerRow`) 목록 — 첫 레이어도 같은
 * 행이다 (종전 Appearance 절의 Background fieldset 큰 swatch + 아래 추가 행 두 어법을
 * 하나로, panel-ui 02, 2026-09-14). fills 가 비어 있으면 backgroundColor 기반 가상
 * 레이어를 한 행 그리고, 색을 커밋하는 순간 실제 fill 로 승격한다 (`ensureColorFill`).
 *
 * 첫 레이어만 ADR-187 presentation 경로 (연속 preview) 를 쓴다 — 나머지는 commit-only.
 * 순서는 @dnd-kit/sortable 드래그.
 */

import { memo, useCallback, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PropertySection } from "../../../components";
import { ActionIconButton } from "../../../components/ui";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { useFillValues } from "../hooks/useFillValues";
import { useFillActions } from "../hooks/useFillActions";
import type {
  FillItem,
  ColorFillItem,
} from "../../../../types/builder/fill.types";
import { FillType } from "../../../../types/builder/fill.types";
import {
  FillLayerRow,
  type FillLayerRowPopoverOverrides,
} from "../components/FillLayerRow";
import {
  createVirtualColorFill,
  resolveFillSeedColor,
} from "../utils/fillPresentation";
import { useAppearanceValues } from "../hooks/useAppearanceValues";
import { useStore as useComposedStore } from "../../../stores";
import {
  getSyntheticDescendantLookup,
  isSyntheticDescendantId,
} from "../../../stores/canonical/syntheticDescendantLookup";
import { useResetStyles, useHasDirtyStyles } from "../hooks/useResetStyles";
import { FILL_PROPS } from "./styleSectionProps";

import "./FillSection.css";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { useSemanticLabel } from "../../../../i18n";

/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const AddIcon = ACTION_ICONS.add;

/** Sortable 래퍼 - 각 FillLayerRow를 sortable로 만듦 */
function SortableFillRow({
  fill,
  onToggle,
  onUpdate,
  onRemove,
  onTypeChange,
  popover,
}: {
  fill: FillItem;
  onToggle: (id: string) => void;
  onUpdate: (id: string, updates: Partial<FillItem>) => void;
  onRemove: (id: string) => void;
  onTypeChange: (fillId: string, newType: FillType) => void;
  popover?: FillLayerRowPopoverOverrides;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: fill.id,
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <FillLayerRow
        fill={fill}
        onToggle={onToggle}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onTypeChange={onTypeChange}
        popover={popover}
      />
    </div>
  );
}

/**
 * 내부 컨텐츠 - 섹션이 열릴 때만 마운트
 */
const FillSectionContent = memo(function FillSectionContent() {
  const { fills } = useFillValues();
  const selectedId = useComposedStore((s) => s.selectedElementId);
  const styleValues = useAppearanceValues(selectedId);
  const {
    addFill,
    ensureColorFill,
    removeFill,
    reorderFill,
    toggleFill,
    updateFill,
    isFirstFillPresentationOwned,
    previewFirstFillColorPresentation,
    commitFirstFillColorPresentation,
    previewFirstFillPaintPresentation,
    commitFirstFillPaintPresentation,
    cancelFirstFillColorPresentation,
    changeFillType,
  } = useFillActions();

  const firstFill = fills[0] ?? null;

  // fills가 없을 때 표시할 기본 색상: 현재 요소의 backgroundColor 또는 #FFFFFF
  // computedStyle이 color(srgb ...) 형식을 반환할 수 있으므로 정규화 필요
  const virtualFill: ColorFillItem = createVirtualColorFill(
    styleValues?.backgroundColor,
  );

  const presentationOwnsColor =
    firstFill?.type === FillType.Color
      ? isFirstFillPresentationOwned(firstFill.id, firstFill)
      : !firstFill
        ? isFirstFillPresentationOwned(virtualFill.id, virtualFill)
        : false;
  const presentationOwnsGradientStops =
    (firstFill?.type === FillType.LinearGradient ||
      firstFill?.type === FillType.RadialGradient ||
      firstFill?.type === FillType.AngularGradient) &&
    isFirstFillPresentationOwned(firstFill.id);
  // color 경로와 같이 legacy backgroundColor 가상 fill 을 fallback 으로 — 없으면 pilot null 이라
  //   opacity scrub 이 commit-only 였다 (드래그 중 캔버스 무반응, 2026-09-14 live).
  const paintFallbackFill =
    firstFill?.type === FillType.Color ? firstFill : undefined;
  const presentationOwnsPaint = firstFill
    ? isFirstFillPresentationOwned(firstFill.id, paintFallbackFill)
    : false;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const fromIndex = fills.findIndex((f) => f.id === active.id);
      const toIndex = fills.findIndex((f) => f.id === over.id);
      if (fromIndex !== -1 && toIndex !== -1) {
        reorderFill(fromIndex, toIndex);
      }
    },
    [fills, reorderFill],
  );

  // 첫 레이어 popover 콜백: fills가 없으면 fill 생성과 동시에 색상 적용, 있으면 기존 fill 업데이트.
  // 가상 fill 승격은 pointer terminal의 ensureColorFill(create-or-update) 한 번으로
  // 제한한다. raw input 중에는 canonical/history/persist write를 만들지 않는다.
  const handleColorChange = useCallback(
    (color: string) => {
      if (firstFill && firstFill.type === FillType.Color) {
        if (previewFirstFillColorPresentation(firstFill.id, color, firstFill)) {
          return;
        }
        // Unsupported fill targets remain commit-only by design.
      } else if (!firstFill) {
        if (
          previewFirstFillColorPresentation(virtualFill.id, color, virtualFill)
        ) {
          return;
        }
      }
    },
    [firstFill, virtualFill, previewFirstFillColorPresentation],
  );

  const handleColorChangeEnd = useCallback(
    (color: string) => {
      if (firstFill && firstFill.type === FillType.Color) {
        if (commitFirstFillColorPresentation(firstFill.id, color, firstFill)) {
          return;
        }
        updateFill(firstFill.id, { color } as Partial<ColorFillItem>);
      } else if (!firstFill) {
        if (
          commitFirstFillColorPresentation(virtualFill.id, color, virtualFill)
        ) {
          return;
        }
        // 가상 fill은 pointer terminal에서 정확히 한 번 실제 fill로 승격한다.
        ensureColorFill(color);
      }
    },
    [
      firstFill,
      virtualFill,
      commitFirstFillColorPresentation,
      updateFill,
      ensureColorFill,
    ],
  );

  const handleColorPresentationCancel = useCallback(
    (reason: "pointer-cancel" | "escape") => {
      cancelFirstFillColorPresentation(reason);
    },
    [cancelFirstFillColorPresentation],
  );

  const handleFillUpdate = useCallback(
    (updates: Partial<FillItem>) => {
      if (
        firstFill &&
        presentationOwnsGradientStops &&
        previewFirstFillPaintPresentation(firstFill.id, updates)
      ) {
        return;
      }
      // Unsupported gradient/mesh targets remain commit-only by design.
    },
    [
      firstFill,
      presentationOwnsGradientStops,
      previewFirstFillPaintPresentation,
    ],
  );

  const handleFillUpdateEnd = useCallback(
    (updates: Partial<FillItem>) => {
      if (
        firstFill &&
        presentationOwnsGradientStops &&
        commitFirstFillPaintPresentation(firstFill.id, updates)
      ) {
        return;
      }
      if (firstFill) updateFill(firstFill.id, updates);
    },
    [
      firstFill,
      presentationOwnsGradientStops,
      commitFirstFillPaintPresentation,
      updateFill,
    ],
  );

  const handleFillOpacityChange = useCallback(
    (opacity: number) => {
      if (
        firstFill &&
        presentationOwnsPaint &&
        previewFirstFillPaintPresentation(
          firstFill.id,
          { opacity },
          paintFallbackFill,
        )
      ) {
        return;
      }
      // Unsupported paint targets remain commit-only by design.
    },
    [
      firstFill,
      paintFallbackFill,
      presentationOwnsPaint,
      previewFirstFillPaintPresentation,
    ],
  );

  const handleFillOpacityChangeEnd = useCallback(
    (opacity: number) => {
      if (
        firstFill &&
        presentationOwnsPaint &&
        commitFirstFillPaintPresentation(
          firstFill.id,
          { opacity },
          paintFallbackFill,
        )
      ) {
        return;
      }
      if (firstFill) updateFill(firstFill.id, { opacity });
    },
    [
      firstFill,
      paintFallbackFill,
      presentationOwnsPaint,
      commitFirstFillPaintPresentation,
      updateFill,
    ],
  );

  const handleTypeChange = useCallback(
    (newType: FillType) => {
      if (firstFill) {
        changeFillType(firstFill.id, newType);
      } else {
        // 가상 fill 상태에서 타입 변경 → 해당 타입으로 fill 생성
        addFill(newType);
      }
    },
    [firstFill, changeFillType, addFill],
  );

  const firstRowPopover = useMemo<FillLayerRowPopoverOverrides>(
    () => ({
      presentationOwnsColorFrameScheduling:
        presentationOwnsColor || presentationOwnsGradientStops,
      onColorPresentationCancel: handleColorPresentationCancel,
      onColorChange: handleColorChange,
      onColorChangeEnd: handleColorChangeEnd,
      onOpacityChange: handleFillOpacityChange,
      onOpacityChangeEnd: handleFillOpacityChangeEnd,
      onUpdate: handleFillUpdate,
      onUpdateEnd: handleFillUpdateEnd,
      onTypeChange: handleTypeChange,
    }),
    [
      presentationOwnsColor,
      presentationOwnsGradientStops,
      handleColorPresentationCancel,
      handleColorChange,
      handleColorChangeEnd,
      handleFillOpacityChange,
      handleFillOpacityChangeEnd,
      handleFillUpdate,
      handleFillUpdateEnd,
      handleTypeChange,
    ],
  );

  const fillIds = fills.map((f) => f.id);

  if (!firstFill) {
    return (
      <div className="fill-section-content">
        <FillLayerRow
          fill={virtualFill}
          isVirtual
          onToggle={toggleFill}
          onUpdate={updateFill}
          onRemove={removeFill}
          onTypeChange={changeFillType}
          popover={firstRowPopover}
        />
      </div>
    );
  }

  return (
    <div className="fill-section-content">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={fillIds} strategy={verticalListSortingStrategy}>
          {fills.map((fill, index) => (
            <SortableFillRow
              key={fill.id}
              fill={fill}
              onToggle={toggleFill}
              onUpdate={updateFill}
              onRemove={removeFill}
              onTypeChange={changeFillType}
              popover={index === 0 ? firstRowPopover : undefined}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
});

/**
 * FillSection — 절 래퍼 (헤더 「+」 · reset)
 */
export const FillSection = memo(function FillSection() {
  const localize = useSemanticLabel();
  const { fills } = useFillValues();
  const { addFill } = useFillActions();
  const selectedId = useComposedStore((s) => s.selectedElementId);
  const styleValues = useAppearanceValues(selectedId);
  const resetStyles = useResetStyles();
  const hasDirtyStyle = useHasDirtyStyles(FILL_PROPS);
  const hasDirty = hasDirtyStyle || fills.length > 0;

  const placeholderColorHex8 = resolveFillSeedColor(
    styleValues?.backgroundColor,
  );

  const handleAdd = useCallback(() => {
    const hasColor = fills.some((f) => f.type === FillType.Color);
    if (hasColor) {
      addFill(FillType.LinearGradient);
    } else {
      addFill(FillType.Color, placeholderColorHex8);
    }
  }, [fills, addFill, placeholderColorHex8]);

  const handleReset = useCallback(() => {
    resetStyles(FILL_PROPS);
    // fills(배경 canonical SSOT)는 style reset 대상이 아니므로 별도로 비운다. 단, 비어있으면
    //   호출 자체가 스퍼리어스 history entry/mutation 을 만들므로 non-empty 일 때만 실행(M2a).
    //   instance 안 synthetic 자식은 맵에 없어 해석 노드로 읽고, `null` 로 patch override 를 지운다
    //   (origin fills 복귀 — 빈 배열이면 "fill 없음" 을 override 로 굳힌다).
    const state = useComposedStore.getState();
    const el = selectedId
      ? (state.elementsMap.get(selectedId) ??
        getSyntheticDescendantLookup(selectedId)?.node)
      : undefined;
    const currentFills = (el as { fills?: unknown[] } | undefined)?.fills;
    if (Array.isArray(currentFills) && currentFills.length > 0) {
      state.updateSelectedFills(
        selectedId && isSyntheticDescendantId(selectedId) ? null : [],
      );
    }
  }, [resetStyles, selectedId]);

  const actions = useMemo(
    () => (
      // 절 헤더 액션은 reset 과 같은 투명 아이콘 버튼 (2026-09-15 사용자 판정 — SwatchIconButton
      //   의 raised 상자 28 은 본문 필드 열용)
      <ActionIconButton onPress={handleAdd} aria-label={localize("Add fill")}>
        <AddIcon
          color={iconProps.color}
          size={iconProps.size}
          strokeWidth={iconProps.strokeWidth}
        />
      </ActionIconButton>
    ),
    [handleAdd, localize],
  );

  return (
    <PropertySection
      id="fill"
      title="Fill"
      actions={actions}
      onReset={hasDirty ? handleReset : undefined}
    >
      <FillSectionContent />
    </PropertySection>
  );
});
