/**
 * Tone 견본의 사다리 (ADR-302 Phase 3) — 역할 색과 같은 생성 사다리 (`ladderGenerate.ts` `toneLadder`, light).
 * `neutral` 은 seed 사다리 (Spectrum gray). 생성 chunk 는 패널이 열릴 때 불러오고, 로드 전 비기본 Tone 은
 * `undefined` (견본은 비어 보인다 — 다른 값을 대신 그리지 않는다).
 */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { SPECTRUM_DEFAULT_LADDERS } from "@composition/rendering";
import {
  loadThemeLadders,
  onThemeLaddersLoaded,
  themeLadderModule,
} from "../../../../../../packages/shared/src/catalog/runtime/themeLadders";
import {
  NEUTRAL_PRESETS,
  type NeutralPreset,
} from "../../../utils/theme/neutralToSkiaColors";

export type ToneLadder = Readonly<Record<number, string>>;

export function useToneLadders(): Readonly<
  Record<NeutralPreset, ToneLadder | undefined>
> {
  const ladders = useSyncExternalStore(onThemeLaddersLoaded, themeLadderModule);
  useEffect(() => {
    void loadThemeLadders();
  }, []);
  return useMemo(
    () =>
      Object.fromEntries(
        NEUTRAL_PRESETS.map((preset) => [
          preset,
          preset === "neutral"
            ? SPECTRUM_DEFAULT_LADDERS.tone.light
            : ladders?.toneLadder(preset, "light"),
        ]),
      ) as Record<NeutralPreset, ToneLadder | undefined>,
    [ladders],
  );
}
