/**
 * Fill Actions Hook
 *
 * Gradient Phase 2: Fill 배열 CRUD 액션 + 타입 변경
 * - fills 배열을 복사 → 변경 → Styles host `updateFills` 호출 (구 store 또는 catalog 문서)
 * - 연속 프리뷰는 Styles host `previewFills` (`previewFill`), 놓을 때 commit
 * - changeFillType: Color ↔ Gradient 타입 전환
 *
 * @since 2026-02-10 Color Picker Phase 1
 * @updated 2026-02-10 Gradient Phase 2
 */

import { useCallback, useRef } from "react";
import type {
  ColorFillItem,
  FillItem,
  GradientStop,
} from "../../../../types/builder/fill.types";
import {
  FillType,
  createDefaultColorFill,
  createDefaultFill,
} from "../../../../types/builder/fill.types";
import { useStylesHost } from "../stylesHost";

export interface FillActions {
  addFill: (type?: FillType, initialColor?: string) => void;
  /** 가상(placeholder) fill 승격 — color fill 이 없으면 생성, 있으면 그 색만 갱신 */
  ensureColorFill: (color: string) => void;
  /**
   * 가상 fill 의 opacity commit — color fill 이 없으면 `color` 로 생성, 있으면 그 opacity 만 갱신
   * (팝오버가 색 · 알파를 연달아 commit 할 때 방금 승격된 색을 덮지 않는다).
   */
  ensureColorFillOpacity: (opacity: number, color: string) => void;
  removeFill: (fillId: string) => void;
  reorderFill: (fromIndex: number, toIndex: number) => void;
  toggleFill: (fillId: string) => void;
  updateFill: (fillId: string, updates: Partial<FillItem>) => void;
  /**
   * A Fill drag (color, opacity, gradient stops) on any layer through the host's `previewFills`;
   * false = the host has none.
   * Successive previews of one gesture add up; the release commits through `updateFill`.
   */
  previewFill: (
    fillId: string,
    updates: Partial<FillItem>,
    fallbackFill?: ColorFillItem,
  ) => boolean;
  /** Put the selection's own layers back after a cancelled drag. */
  cancelFillPreview: () => void;
  changeFillType: (fillId: string, newType: FillType) => void;
}

function applyFillUpdates(
  fills: readonly FillItem[],
  fillId: string,
  updates: Partial<FillItem>,
): FillItem[] {
  return fills.map((fill) =>
    fill.id === fillId ? ({ ...fill, ...updates } as FillItem) : fill,
  );
}

export function useFillActions(): FillActions {
  const host = useStylesHost();
  const getCurrentFills = host.readFills;
  /** The layers a host preview shows during one gesture. */
  const draftRef = useRef<{
    id: string | null;
    base: string;
    fills: FillItem[];
  } | null>(null);
  const dropDraft = useCallback(() => {
    draftRef.current = null;
  }, []);
  const writeFills = useCallback(
    (fills: FillItem[]) => {
      dropDraft();
      host.updateFills(fills);
    },
    [dropDraft, host],
  );

  const previewFill = useCallback(
    (
      fillId: string,
      updates: Partial<FillItem>,
      fallbackFill?: ColorFillItem,
    ): boolean => {
      if (!host.previewFills) return false;
      const id = host.readSelectedId();
      const current = getCurrentFills();
      // A gesture continues on the same element over the same committed layers (a release that
      // committed nothing — the same color — or an undo starts the next one afresh).
      const base = JSON.stringify(current);
      let draft = draftRef.current;
      if (!draft || draft.id !== id || draft.base !== base)
        draft = {
          id,
          base,
          fills:
            !current.some((fill) => fill.id === fillId) && fallbackFill
              ? [...current, fallbackFill]
              : current,
        };
      draft = {
        ...draft,
        fills: applyFillUpdates(draft.fills, fillId, updates),
      };
      draftRef.current = draft;
      host.previewFills(draft.fills);
      return true;
    },
    [getCurrentFills, host],
  );

  const cancelFillPreview = useCallback(() => {
    dropDraft();
    host.cancelPreview?.();
  }, [dropDraft, host]);

  const addFill = useCallback(
    (type: FillType = FillType.Color, initialColor?: string) => {
      const fills = getCurrentFills();
      const newFill =
        initialColor && type === FillType.Color
          ? createDefaultColorFill(initialColor)
          : createDefaultFill(type);
      const newFills = [...fills, newFill];
      writeFills(newFills);
    },
    [getCurrentFills, writeFills],
  );

  // 가상 fill terminal 승격 전용. create-or-update라 재렌더 지연이 있어도
  // 중복 append가 구조적으로 불가능하다.
  const ensureColorFill = useCallback(
    (color: string) => {
      const fills = getCurrentFills();
      const colorIndex = fills.findIndex((f) => f.type === FillType.Color);
      if (colorIndex === -1) {
        writeFills([...fills, createDefaultColorFill(color)]);
        return;
      }
      const newFills = fills.map((f, index) =>
        index === colorIndex ? ({ ...f, color } as FillItem) : f,
      );
      writeFills(newFills);
    },
    [getCurrentFills, writeFills],
  );

  const ensureColorFillOpacity = useCallback(
    (opacity: number, color: string) => {
      const fills = getCurrentFills();
      const colorIndex = fills.findIndex((f) => f.type === FillType.Color);
      if (colorIndex === -1) {
        writeFills([...fills, { ...createDefaultColorFill(color), opacity }]);
        return;
      }
      writeFills(
        fills.map((f, index) => (index === colorIndex ? { ...f, opacity } : f)),
      );
    },
    [getCurrentFills, writeFills],
  );

  const removeFill = useCallback(
    (fillId: string) => {
      const fills = getCurrentFills();
      const newFills = fills.filter((f) => f.id !== fillId);
      writeFills(newFills);
    },
    [getCurrentFills, writeFills],
  );

  const reorderFill = useCallback(
    (fromIndex: number, toIndex: number) => {
      const fills = getCurrentFills();
      if (fromIndex < 0 || fromIndex >= fills.length) return;
      if (toIndex < 0 || toIndex >= fills.length) return;
      if (fromIndex === toIndex) return;

      const newFills = [...fills];
      const [moved] = newFills.splice(fromIndex, 1);
      newFills.splice(toIndex, 0, moved);
      writeFills(newFills);
    },
    [getCurrentFills, writeFills],
  );

  const toggleFill = useCallback(
    (fillId: string) => {
      const fills = getCurrentFills();
      const newFills = fills.map((f) =>
        f.id === fillId ? { ...f, enabled: !f.enabled } : f,
      );
      writeFills(newFills);
    },
    [getCurrentFills, writeFills],
  );

  const updateFill = useCallback(
    (fillId: string, updates: Partial<FillItem>) => {
      const fills = getCurrentFills();
      const newFills = fills.map((f) => {
        if (f.id !== fillId) return f;
        return { ...f, ...updates } as FillItem;
      });
      writeFills(newFills);
    },
    [getCurrentFills, writeFills],
  );

  const changeFillType = useCallback(
    (fillId: string, newType: FillType) => {
      const fills = getCurrentFills();
      const newFills = fills.map((f) => {
        if (f.id !== fillId) return f;

        const isCurrentColor = f.type === FillType.Color;
        const isCurrentGradient =
          f.type === FillType.LinearGradient ||
          f.type === FillType.RadialGradient ||
          f.type === FillType.AngularGradient;
        const isNewGradient =
          newType === FillType.LinearGradient ||
          newType === FillType.RadialGradient ||
          newType === FillType.AngularGradient;

        // Color → Gradient
        if (isCurrentColor && isNewGradient) {
          const colorFill = f as ColorFillItem;
          const base = createDefaultFill(newType);
          return {
            ...base,
            id: f.id,
            enabled: f.enabled,
            opacity: f.opacity,
            stops: [
              { color: colorFill.color, position: 0 },
              { color: "#FFFFFFFF", position: 1 },
            ],
          } as FillItem;
        }

        // Gradient → Color
        if (isCurrentGradient && newType === FillType.Color) {
          const gradFill = f as { stops?: GradientStop[] };
          const color = gradFill.stops?.[0]?.color ?? "#000000FF";
          return {
            ...createDefaultColorFill(color),
            id: f.id,
            enabled: f.enabled,
            opacity: f.opacity,
          };
        }

        // Gradient → Gradient (타입만 변경, stops 유지)
        if (isCurrentGradient && isNewGradient) {
          const base = createDefaultFill(newType);
          const currentStops = (f as { stops?: GradientStop[] }).stops;
          return {
            ...base,
            id: f.id,
            enabled: f.enabled,
            opacity: f.opacity,
            ...(currentStops ? { stops: currentStops } : {}),
          } as FillItem;
        }

        // Any → Image / Image → Any (기본값으로 전환)
        const base = createDefaultFill(newType);
        return {
          ...base,
          id: f.id,
          enabled: f.enabled,
          opacity: f.opacity,
        } as FillItem;
      });
      writeFills(newFills);
    },
    [getCurrentFills, writeFills],
  );

  return {
    addFill,
    ensureColorFill,
    ensureColorFillOpacity,
    removeFill,
    reorderFill,
    toggleFill,
    updateFill,
    previewFill,
    cancelFillPreview,
    changeFillType,
  };
}
