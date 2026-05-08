/**
 * useFillValues - Fill 섹션 전용 Zustand 훅
 * - fills: element top-level `fills` 직접 구독
 * - activeFillIndex / colorInputMode: 스타일 패널 UI 전용 zustand store
 *
 * ADR-082 A2 (scope 결정): Fill 섹션은 user-authored `fills` 배열(gradient stops/solid
 *   fills 등) 편집 전용. Spec 기본 배경 색상은 이미 `useAppearanceValues` 의
 *   `specPreset.backgroundColor` 경로로 소비되므로 본 hook 은 Spec fallback 을 추가하지
 *   않는다 (의도적 스킵 — 같은 값을 두 섹션에 중복 표시하지 않기 위함).
 *   Fill 섹션에 값이 없으면 ensureFills() 가 backgroundColor 를 seed 로 단일 solid fill
 *   을 합성하며, 여기서의 backgroundColor 는 inline style 만 참조한다.
 */

import { useMemo } from "react";
import { create } from "zustand";
import { useStore } from "../../../stores";
import { useElementStyleContext } from "./useElementStyleContext";
import type {
  FillItem,
  ColorInputMode,
} from "../../../../types/builder/fill.types";
import { resolveElementFills } from "../utils/fillMigration";

interface FillUIState {
  activeFillIndex: number;
  colorInputMode: ColorInputMode;
  setActiveFillIndex: (index: number) => void;
  setColorInputMode: (mode: ColorInputMode) => void;
}

export const useFillUIStore = create<FillUIState>((set) => ({
  activeFillIndex: 0,
  colorInputMode: "hex",
  setActiveFillIndex: (index) => set({ activeFillIndex: index }),
  setColorInputMode: (mode) => set({ colorInputMode: mode }),
}));

export interface FillValues {
  fills: FillItem[];
  activeFillIndex: number;
  activeFill: FillItem | null;
  colorInputMode: ColorInputMode;
  setActiveFillIndex: (index: number) => void;
  setColorInputMode: (mode: ColorInputMode) => void;
}

export function useFillValues(): FillValues {
  const selectedId = useStore((s) => s.selectedElementId);
  const { fills, style } = useElementStyleContext(selectedId);
  const activeFillIndex = useFillUIStore((s) => s.activeFillIndex);
  const colorInputMode = useFillUIStore((s) => s.colorInputMode);
  const setActiveFillIndex = useFillUIStore((s) => s.setActiveFillIndex);
  const setColorInputMode = useFillUIStore((s) => s.setColorInputMode);

  const rawFills = useMemo(
    () =>
      fills || style
        ? {
            fills: fills as FillItem[] | undefined,
            props: {
              style: style as { backgroundColor?: string } | undefined,
            },
          }
        : undefined,
    [fills, style],
  );

  const fillsList = useMemo(() => resolveElementFills(rawFills), [rawFills]);
  const activeFill = fillsList[activeFillIndex] ?? null;

  return {
    fills: fillsList,
    activeFillIndex,
    activeFill,
    colorInputMode,
    setActiveFillIndex,
    setColorInputMode,
  };
}
