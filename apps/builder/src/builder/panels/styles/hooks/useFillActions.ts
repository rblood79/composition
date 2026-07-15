/**
 * Fill Actions Hook
 *
 * Gradient Phase 2: Fill 배열 CRUD 액션 + 타입 변경
 * - fills 배열을 복사 → 변경 → store.updateSelectedFills() 호출
 * - 프리뷰 액션은 store.updateSelectedFillsPreview() 사용
 * - changeFillType: Color ↔ Gradient 타입 전환
 *
 * @since 2026-02-10 Color Picker Phase 1
 * @updated 2026-02-10 Gradient Phase 2
 */

import { useCallback, useRef, useEffect } from "react";
import { useStore } from "../../../stores";
import type { Element } from "../../../../types/builder/unified.types";
import type {
  FillItem,
  ColorFillItem,
  GradientStop,
} from "../../../../types/builder/fill.types";
import {
  FillType,
  createDefaultColorFill,
  createDefaultFill,
} from "../../../../types/builder/fill.types";
import { getActiveCanonicalDocument } from "../../../stores/canonical/canonicalElementsBridge";
import { visitCanonicalDocumentElements } from "../../../stores/canonical/canonicalElementsView";
import { resolveElementFills } from "../utils/fillMigration";

export interface FillActions {
  addFill: (type?: FillType, initialColor?: string) => void;
  /** 가상(placeholder) fill 승격 — color fill 이 없으면 생성, 있으면 그 색만 갱신 */
  ensureColorFill: (color: string) => void;
  removeFill: (fillId: string) => void;
  reorderFill: (fromIndex: number, toIndex: number) => void;
  toggleFill: (fillId: string) => void;
  updateFill: (fillId: string, updates: Partial<FillItem>) => void;
  updateFillPreview: (fillId: string, updates: Partial<FillItem>) => void;
  /** RAF-throttled 경량 프리뷰 (드래그 전용) */
  updateFillPreviewThrottled: (
    fillId: string,
    updates: Partial<FillItem>,
  ) => void;
  changeFillType: (fillId: string, newType: FillType) => void;
}

/**
 * fills 배열의 현재 값을 가져오는 헬퍼.
 *
 * 표시(useFillValues → useElementStyleContext → canonical 파생)와 **동일 소스**:
 * canonical 문서 우선, canonical 미가동(legacy 프로젝트)일 때만 elementsMap.
 * 과거 legacy elementsMap 단독 읽기는 canonical 파생과 어긋나는 순간
 * (표시 0건 ↔ 액션 실값) 소스 분열로 드래그마다 addFill 중복 누적을 만들었다
 * (2026-07-15 fills 파이프라인 복원).
 */
function getCurrentFills(): FillItem[] {
  const state = useStore.getState();
  const { selectedElementId, elementsMap } = state;
  if (!selectedElementId) return [];

  const doc = getActiveCanonicalDocument();
  if (doc) {
    let found: Element | undefined;
    visitCanonicalDocumentElements(doc, (element) => {
      if (element.id === selectedElementId) found = element;
    });
    return resolveElementFills(found);
  }
  return resolveElementFills(elementsMap.get(selectedElementId));
}

export function useFillActions(): FillActions {
  // RAF throttle refs
  const rafRef = useRef<number | null>(null);
  const pendingUpdateRef = useRef<{
    fillId: string;
    updates: Partial<FillItem>;
  } | null>(null);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const addFill = useCallback(
    (type: FillType = FillType.Color, initialColor?: string) => {
      const fills = getCurrentFills();
      const newFill =
        initialColor && type === FillType.Color
          ? createDefaultColorFill(initialColor)
          : createDefaultFill(type);
      const newFills = [...fills, newFill];
      useStore.getState().updateSelectedFills(newFills);
    },
    [],
  );

  // 가상 fill 드래그 승격 전용 — create-or-update 라 드래그 tick 간 표시(firstFill)
  // 재렌더 지연이 있어도 중복 append 가 구조적으로 불가능하다.
  const ensureColorFill = useCallback((color: string) => {
    const fills = getCurrentFills();
    const colorIndex = fills.findIndex((f) => f.type === FillType.Color);
    if (colorIndex === -1) {
      useStore
        .getState()
        .updateSelectedFills([...fills, createDefaultColorFill(color)]);
      return;
    }
    const newFills = fills.map((f, index) =>
      index === colorIndex ? ({ ...f, color } as FillItem) : f,
    );
    useStore.getState().updateSelectedFills(newFills);
  }, []);

  const removeFill = useCallback((fillId: string) => {
    const fills = getCurrentFills();
    const newFills = fills.filter((f) => f.id !== fillId);
    useStore.getState().updateSelectedFills(newFills);
  }, []);

  const reorderFill = useCallback((fromIndex: number, toIndex: number) => {
    const fills = getCurrentFills();
    if (fromIndex < 0 || fromIndex >= fills.length) return;
    if (toIndex < 0 || toIndex >= fills.length) return;
    if (fromIndex === toIndex) return;

    const newFills = [...fills];
    const [moved] = newFills.splice(fromIndex, 1);
    newFills.splice(toIndex, 0, moved);
    useStore.getState().updateSelectedFills(newFills);
  }, []);

  const toggleFill = useCallback((fillId: string) => {
    const fills = getCurrentFills();
    const newFills = fills.map((f) =>
      f.id === fillId ? { ...f, enabled: !f.enabled } : f,
    );
    useStore.getState().updateSelectedFills(newFills);
  }, []);

  const updateFill = useCallback(
    (fillId: string, updates: Partial<FillItem>) => {
      const fills = getCurrentFills();
      const newFills = fills.map((f) => {
        if (f.id !== fillId) return f;
        return { ...f, ...updates } as FillItem;
      });
      useStore.getState().updateSelectedFills(newFills);
    },
    [],
  );

  const updateFillPreview = useCallback(
    (fillId: string, updates: Partial<FillItem>) => {
      const fills = getCurrentFills();
      const newFills = fills.map((f) => {
        if (f.id !== fillId) return f;
        return { ...f, ...updates } as FillItem;
      });
      useStore.getState().updateSelectedFillsPreview(newFills);
    },
    [],
  );

  const updateFillPreviewThrottled = useCallback(
    (fillId: string, updates: Partial<FillItem>) => {
      pendingUpdateRef.current = { fillId, updates };

      if (rafRef.current !== null) return;

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const pending = pendingUpdateRef.current;
        if (!pending) return;
        pendingUpdateRef.current = null;

        const fills = getCurrentFills();
        const newFills = fills.map((f) => {
          if (f.id !== pending.fillId) return f;
          return { ...f, ...pending.updates } as FillItem;
        });
        useStore.getState().updateSelectedFillsPreviewLightweight(newFills);
      });
    },
    [],
  );

  const changeFillType = useCallback((fillId: string, newType: FillType) => {
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
    useStore.getState().updateSelectedFills(newFills);
  }, []);

  return {
    addFill,
    ensureColorFill,
    removeFill,
    reorderFill,
    toggleFill,
    updateFill,
    updateFillPreview,
    updateFillPreviewThrottled,
    changeFillType,
  };
}
