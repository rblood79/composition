/**
 * ADR-302 사용자 결정 8 (a) — 사다리 표 · 생성식 (`ladderGenerate.ts`) 은 lazy chunk 다. initial 에는 이 로더만 있다.
 *
 * resolver (`resolveThemeSnapshot`) 는 동기라 로드된 모듈을 여기서 읽는다. 비기본 preset (tint ≠ blue · 사용자
 * hex · Tone ≠ neutral) 인데 아직 로드 전이면 seed (기본 preset 값) 를 쓰고 `THEME_LADDERS_PENDING` 경고를 남긴다
 * — 테마 상태의 key 가 로드 여부를 담아 (`catalogThemeState`), 로드되면 구독자 (Builder workspace · Preview ·
 * Publish 세션) 가 테마를 다시 적용한다.
 */
import type * as LadderModule from "./ladderGenerate";

export type ThemeLadderModule = typeof LadderModule;

/** resolver 경고 — 비기본 preset 을 사다리 로드 전에 seed 로 풀었다. */
export const THEME_LADDERS_PENDING = "theme-ladders-pending";

let loaded: ThemeLadderModule | undefined;
let pending: Promise<ThemeLadderModule> | undefined;
const listeners = new Set<() => void>();

/** 로드된 생성 모듈 — 없으면 undefined (resolver 는 seed). */
export function themeLadderModule(): ThemeLadderModule | undefined {
  return loaded;
}

/** 생성 모듈을 한 번 불러온다. 로드되면 구독자에게 알린다. */
export function loadThemeLadders(): Promise<ThemeLadderModule> {
  pending ??= import("./ladderGenerate").then((mod) => {
    loaded = mod;
    for (const listener of [...listeners]) listener();
    return mod;
  });
  return pending;
}

/**
 * 생성 모듈이 로드되면 한 번 부른다. 이미 로드됐으면 다음 microtask 에 부른다 — 구독보다 로드가 먼저 끝난 경우
 * (Builder 는 workspace 를 만들며 로드를 시작하고 구독은 그 뒤 effect 에서 건다) 대기 중에 그린 seed 를 다시
 * 풀어야 한다. 소비자의 재적용은 테마 key 가 같으면 아무것도 하지 않는다. 해제 함수를 돌려준다.
 */
export function onThemeLaddersLoaded(listener: () => void): () => void {
  if (loaded) {
    let active = true;
    queueMicrotask(() => {
      if (active) listener();
    });
    return () => {
      active = false;
    };
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 사용자 accent 색 토큰 — hex 문자열이면 tint preset 을 대신한다 (ADR-302). */
export const THEME_ACCENT_TOKEN = "color.accent";

/** 토큰 델타의 사용자 accent hex — 없거나 문자열이 아니면 `undefined`. */
export function themeAccentHex(
  tokens: Readonly<Record<string, { readonly value?: unknown } | undefined>>,
): string | undefined {
  const value = tokens[THEME_ACCENT_TOKEN]?.value;
  return typeof value === "string" ? value : undefined;
}

/** 이 preset 이 생성 사다리를 쓰는가 — 기본 tint (blue · hex 없음) 와 기본 Tone (neutral) 이면 아니다. */
export function themeNeedsLadders(
  preset: { tint?: string; neutral?: string },
  accentHex: string | undefined,
): boolean {
  return (
    (preset.tint || "blue") !== "blue" ||
    accentHex !== undefined ||
    (preset.neutral || "neutral") !== "neutral"
  );
}
