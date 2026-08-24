/**
 * FillSection (UI: "Background") - Background 레이어 편집 섹션
 *
 * Phase 2: Color + Gradient 다중 레이어
 * - PropertySection 래퍼 + 내부 Content 분리
 * - Zustand 구독 (useFillValues)
 * - @dnd-kit/sortable 드래그 순서 변경
 * - memo 최적화
 */

import { memo, useCallback } from "react";
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
import { DialogTrigger, Button as AriaButton } from "react-aria-components";
import { ColorSwatch } from "@composition/shared/components/ColorSwatch";
import { Popover } from "@composition/shared/components/Popover";
import { PropertySection } from "../../../components";
import { SwatchIconButton } from "../../../components/ui";
import { iconProps, iconSmall } from "../../../../utils/ui/uiConstants";
import { useFillValues } from "../hooks/useFillValues";
import { useFillActions } from "../hooks/useFillActions";
import type {
  FillItem,
  ColorFillItem,
} from "../../../../types/builder/fill.types";
import { FillType } from "../../../../types/builder/fill.types";
import { FillLayerRow } from "../components/FillLayerRow";
import { FillDetailPopover } from "../components/FillDetailPopover";
import {
  buildFillSwatchStyle,
  createVirtualColorFill,
  resolveFillSeedColor,
} from "../utils/fillPresentation";
import { useAppearanceValues } from "../hooks/useAppearanceValues";
import { useStore as useComposedStore } from "../../../stores";

import "./FillSection.css";
import { ACTION_ICONS } from "../../../config/actionIcons";

/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const AddIcon = ACTION_ICONS.add;

/** Sortable 래퍼 - 각 FillLayerRow를 sortable로 만듦 */
function SortableFillRow({
  fill,
  onToggle,
  onUpdate,
  onRemove,
  onTypeChange,
}: {
  fill: FillItem;
  onToggle: (id: string) => void;
  onUpdate: (id: string, updates: Partial<FillItem>) => void;
  onRemove: (id: string) => void;
  onTypeChange: (fillId: string, newType: FillType) => void;
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
      />
    </div>
  );
}

/**
 * 내부 컨텐츠 - 섹션이 열릴 때만 마운트
 */
const FillSectionContent = memo(function FillSectionContent() {
  const { fills } = useFillValues();
  const { removeFill, reorderFill, toggleFill, updateFill, changeFillType } =
    useFillActions();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
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

  const fillIds = fills.map((f) => f.id);

  return (
    <div className="fill-section-content">
      {fills.length === 0 ? (
        <div className="fill-section-empty">No background</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={fillIds}
            strategy={verticalListSortingStrategy}
          >
            {fills.map((fill) => (
              <SortableFillRow
                key={fill.id}
                fill={fill}
                onToggle={toggleFill}
                onUpdate={updateFill}
                onRemove={removeFill}
                onTypeChange={changeFillType}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
});

/**
 * FillSectionInline - Appearance 섹션 내부에 인라인으로 렌더링
 * PropertySection 래퍼 없이 Background 콘텐츠만 제공
 */
export const FillSectionInline = memo(function FillSectionInline() {
  const { fills } = useFillValues();
  const { addFill } = useFillActions();

  const handleAdd = useCallback(() => {
    const hasColor = fills.some((f) => f.type === FillType.Color);
    addFill(hasColor ? FillType.LinearGradient : FillType.Color);
  }, [fills, addFill]);

  return (
    <div className="fill-section-inline">
      <div className="fill-section-inline-header">
        <span className="fill-section-inline-label">Background</span>
        <button
          type="button"
          className="fill-section-add-btn"
          onClick={handleAdd}
          aria-label="Add background"
          title="Add background"
        >
          <AddIcon
            size={iconSmall.size}
            strokeWidth={iconSmall.strokeWidth}
            color={iconSmall.color}
          />
        </button>
      </div>
      <FillSectionContent />
    </div>
  );
});

/**
 * FillBackgroundInline - style-background 그리드 구조에 맞는 V2 Fill UI
 *
 * 기존 PropertyColor와 동일한 그리드 레이아웃(3열: 1fr 1fr inspector-control-size)에서:
 * - 첫번째 Fill: PropertyColor 스타일 swatch (클릭 시 FillDetailPopover)
 * - + 버튼: 3번째 열 (actions-icon)
 * - 추가 Fill(2번째~): 그리드 아래 FillLayerRow 리스트
 */
export const FillBackgroundInline = memo(function FillBackgroundInline() {
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
  const extraFills = fills.slice(1);

  // fills가 없을 때 표시할 기본 색상: 현재 요소의 backgroundColor 또는 #FFFFFF
  // computedStyle이 color(srgb ...) 형식을 반환할 수 있으므로 정규화 필요
  const placeholderColorHex8 = resolveFillSeedColor(
    styleValues?.backgroundColor,
  );
  const virtualFill: ColorFillItem = createVirtualColorFill(
    styleValues?.backgroundColor,
  );

  // popover에 전달할 fill: 실제 fill이 있으면 그것, 없으면 가상 fill
  const popoverFill = firstFill ?? virtualFill;
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
  const presentationOwnsPaint = firstFill
    ? isFirstFillPresentationOwned(firstFill.id)
    : false;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const handleAdd = useCallback(() => {
    const hasColor = fills.some((f) => f.type === FillType.Color);
    if (hasColor) {
      addFill(FillType.LinearGradient);
    } else {
      addFill(FillType.Color, placeholderColorHex8);
    }
  }, [fills, addFill, placeholderColorHex8]);

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

  // popover 콜백: fills가 없으면 fill 생성과 동시에 색상 적용
  // fills가 있으면 기존 fill 업데이트
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
        previewFirstFillPaintPresentation(firstFill.id, { opacity })
      ) {
        return;
      }
      // Unsupported paint targets remain commit-only by design.
    },
    [firstFill, presentationOwnsPaint, previewFirstFillPaintPresentation],
  );

  const handleFillOpacityChangeEnd = useCallback(
    (opacity: number) => {
      if (
        firstFill &&
        presentationOwnsPaint &&
        commitFirstFillPaintPresentation(firstFill.id, { opacity })
      ) {
        return;
      }
      if (firstFill) updateFill(firstFill.id, { opacity });
    },
    [
      firstFill,
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

  // swatch에 표시할 색상
  const swatchColor = !firstFill
    ? placeholderColorHex8
    : firstFill.type === FillType.Color
      ? (firstFill as ColorFillItem).color
      : undefined;
  const swatchStyle = buildFillSwatchStyle(firstFill);

  const isColor = firstFill?.type === FillType.Color || !firstFill;
  const isGradient =
    firstFill?.type === FillType.LinearGradient ||
    firstFill?.type === FillType.RadialGradient ||
    firstFill?.type === FillType.AngularGradient;
  const isMesh = firstFill?.type === FillType.MeshGradient;

  const extraFillIds = extraFills.map((f) => f.id);

  return (
    <>
      <div className="style-background">
        <fieldset className="properties-aria property-color-input background-color">
          <legend className="fieldset-legend">Background</legend>
          <DialogTrigger>
            <AriaButton
              className="react-aria-Group color-swatch-button"
              aria-label="Edit background fill"
            >
              {isColor && <ColorSwatch color={swatchColor!} />}
              {isGradient && (
                <div
                  className="fill-background-gradient-swatch"
                  style={swatchStyle}
                />
              )}
              {isMesh && (
                <div
                  className="fill-background-gradient-swatch"
                  style={swatchStyle}
                />
              )}
            </AriaButton>
            <Popover
              placement="bottom start"
              className="fill-detail-popover-container"
              hideArrow
            >
              <FillDetailPopover
                fill={popoverFill}
                presentationOwnsColorFrameScheduling={
                  presentationOwnsColor || presentationOwnsGradientStops
                }
                onColorPresentationCancel={handleColorPresentationCancel}
                onColorChange={handleColorChange}
                onColorChangeEnd={handleColorChangeEnd}
                onOpacityChange={handleFillOpacityChange}
                onOpacityChangeEnd={handleFillOpacityChangeEnd}
                onUpdate={handleFillUpdate}
                onUpdateEnd={handleFillUpdateEnd}
                onTypeChange={handleTypeChange}
              />
            </Popover>
          </DialogTrigger>
        </fieldset>
        <div className="fieldset-actions actions-icon">
          <SwatchIconButton onPress={handleAdd} aria-label="Add background">
            <AddIcon
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </SwatchIconButton>
        </div>
      </div>

      {extraFills.length > 0 && (
        <div className="fill-background-extra">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={extraFillIds}
              strategy={verticalListSortingStrategy}
            >
              {extraFills.map((fill) => (
                <SortableFillRow
                  key={fill.id}
                  fill={fill}
                  onToggle={toggleFill}
                  onUpdate={updateFill}
                  onRemove={removeFill}
                  onTypeChange={changeFillType}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </>
  );
});

/**
 * FillSection - 독립 섹션 래퍼 (PropertySection 포함)
 * 호환성 유지용 — 단독 사용 시
 */
export const FillSection = memo(function FillSection() {
  return (
    <PropertySection id="background" title="Background">
      <FillSectionInline />
    </PropertySection>
  );
});
