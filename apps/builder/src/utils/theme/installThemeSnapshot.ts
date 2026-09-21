/**
 * ADR-227 Phase 2 — 활성 테마 snapshot **1회 설치** (breakdown §3.3 commit 순서).
 *
 *   맵 설치 (specs `lightColors/darkColors` · `typography` · `radius` · `borderWidth` · `lightShadows/darkShadows`
 *   덮어쓰기 — production `resolveToken` 소비자 21 파일이 같은 맵을 읽는다, Phase 0 F15) →
 *   themeConfigStore 한 번의 set (`applyResolvedTheme`, themeVersion +1) → `notifyLayoutChange` 1회 →
 *   Preview `THEME_VARS` (replace) + `SET_DARK_MODE` + `THEME_BASE_TYPOGRAPHY` 1회.
 *
 * 마지막 설치본은 모듈이 들고 있다 — iframe ready 재전송 (`BuilderCore`) 과 Publish payload
 * (`getCurrentThemeSnapshot`) 이 같은 `cssVars` 를 읽는다.
 */
import {
  darkColors,
  darkShadows,
  lightColors,
  lightShadows,
  borderWidth,
  radius,
  typography,
} from "@composition/specs";
import { notifyLayoutChange } from "../../builder/workspace/canvas/skia/useSkiaNode";
import {
  resolveSkiaTheme,
  useThemeConfigStore,
  type DarkModePreference,
  type RadiusScale,
} from "../../stores/themeConfigStore";
import { MessageService } from "../messaging";
import type { NeutralPreset } from "./neutralToSkiaColors";
import type { ResolvedThemeSnapshot } from "./resolveThemeSnapshot";
import type { TintPreset } from "./tintToSkiaColors";

let current: ResolvedThemeSnapshot | null = null;

/**
 * geometry 축 (typography · base · radius · border) 이 바뀌면 레이아웃 엔진 재계산이 필요하다 —
 * `notifyLayoutChange` 는 Skia 트리 캐시만 비우고 레이아웃 엔진 결과 (`layoutVersion`) 는 안 건드린다
 * (Phase 2 live S5 실측: text-sm 24 에도 Button 폭 72 유지). builder store 의 `invalidateLayout`
 * 을 순환 import 없이 부르려고 등록 콜백을 쓴다 (BuilderCore 가 `registerThemeLayoutInvalidator`).
 */
let layoutInvalidator: (() => void) | null = null;
export function registerThemeLayoutInvalidator(fn: (() => void) | null): void {
  layoutInvalidator = fn;
}

function geometryChanged(
  prev: ResolvedThemeSnapshot | null,
  next: ResolvedThemeSnapshot,
): boolean {
  if (!prev) return true;
  const same = (a: object, b: object) =>
    JSON.stringify(a) === JSON.stringify(b);
  return !(
    same(prev.typography, next.typography) &&
    same(prev.radius, next.radius) &&
    same(prev.border, next.border) &&
    same(prev.base, next.base)
  );
}

export function getCurrentThemeSnapshot(): ResolvedThemeSnapshot | null {
  return current;
}

/** 테스트 전용 */
export function resetCurrentThemeSnapshotForTest(): void {
  current = null;
}

function overwrite(
  target: Record<string, unknown>,
  source: Readonly<Record<string, unknown>>,
): void {
  for (const key of Object.keys(source)) target[key] = source[key];
}

/**
 * Preview iframe 에 현재 설치본을 보낸다 (ready 뒤에만 — 아니면 조용히 no-op, ready 핸들러가 재전송).
 * `replace: true` — 이전 테마의 변수를 전부 걷어내고 이 벌로 교체한다 (§3.3 "이전 override 제거").
 */
export function sendThemeSnapshotToPreview(
  snapshot: ResolvedThemeSnapshot | null = current,
): boolean {
  if (!snapshot) return false;
  const iframe = MessageService.getIframe();
  if (!iframe?.contentWindow) return false;
  const origin = window.location.origin;
  iframe.contentWindow.postMessage(
    { type: "THEME_VARS", vars: snapshot.cssVars, replace: true },
    origin,
  );
  iframe.contentWindow.postMessage(
    {
      type: "SET_DARK_MODE",
      isDark:
        resolveSkiaTheme(snapshot.darkMode as DarkModePreference) === "dark",
    },
    origin,
  );
  iframe.contentWindow.postMessage(
    { type: "THEME_BASE_TYPOGRAPHY", payload: snapshot.base },
    origin,
  );
  return true;
}

export function installThemeSnapshot(snapshot: ResolvedThemeSnapshot): void {
  const previous = current;
  // 1. 맵 설치 — Skia paint · layout · text 측정이 다음 resolveToken 부터 읽는다
  overwrite(
    lightColors as unknown as Record<string, unknown>,
    snapshot.colors.light,
  );
  overwrite(
    darkColors as unknown as Record<string, unknown>,
    snapshot.colors.dark,
  );
  overwrite(
    typography as unknown as Record<string, unknown>,
    snapshot.typography,
  );
  overwrite(radius as unknown as Record<string, unknown>, snapshot.radius);
  overwrite(borderWidth as unknown as Record<string, unknown>, snapshot.border);
  overwrite(
    lightShadows as unknown as Record<string, unknown>,
    snapshot.shadows.light,
  );
  overwrite(
    darkShadows as unknown as Record<string, unknown>,
    snapshot.shadows.dark,
  );
  current = snapshot;

  // 2. store 한 번 (themeVersion +1 → ElementSprite 재생성) — setter 4~5 회 대신
  useThemeConfigStore.getState().applyResolvedTheme({
    tint: snapshot.preset.tint as TintPreset,
    darkMode: snapshot.darkMode as DarkModePreference,
    neutral: snapshot.preset.neutral as NeutralPreset,
    radiusScale: snapshot.preset.radiusScale as RadiusScale,
    baseTypography: snapshot.base,
  });

  // 3. 레이아웃/캐시 무효화 1회 — Skia 트리 캐시 (항상) + 레이아웃 엔진 재계산 (geometry 축이 바뀐 때만)
  notifyLayoutChange();
  if (geometryChanged(previous, snapshot)) layoutInvalidator?.();

  // 4. Preview 1회
  sendThemeSnapshotToPreview(snapshot);
}
