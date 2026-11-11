/**
 * 빌더 알림 Toast 의 skin — S2 `Toast` 그대로 (사용자 2026-11-11 「builder 의 toast 를 S2 형태로」 ·
 * 「빌더 chrome 판 S2」).
 *
 * 쌓기 · 펼치기 (「모두 표시」 · 「모두 지우기」 · 「접기」) · view transition · 닫기는 Preview 와 같은 구현
 * (`packages/shared/src/components/ToastRegion.lazy.tsx` `ToastRegion`) 이다. 다른 것은 skin 뿐 —
 * class 접두 `builder-toast` 의 시트 (`Toast.css`) 를 빌더가 소유한다. ADR-305 로 빌더 문서는
 * `catalog-toast` 시트 · 테마 변수 · 문서 Button 시트를 싣지 않으므로 크기 · 색은 inline 이 아니라
 * 이 시트가 준다.
 *
 * store 의 `type` → S2 variant: success → positive · error → negative · info → info ·
 * warning → neutral (S2 toast 에 warning variant 가 없다).
 */
import type { ToastRegionSkin } from "../../../../../../packages/shared/src/components/ToastRegion.lazy";
import type { ToastVariant } from "../../../../../../packages/shared/src/components/Toast";
import type { ToastType } from "../../stores/toast";
import "./Toast.css";

export const BUILDER_TOAST_PREFIX = "builder-toast";

export const BUILDER_TOAST_SKIN: ToastRegionSkin = {
  prefix: BUILDER_TOAST_PREFIX,
  // 크기 · 색 · action 버튼 모양은 `Toast.css` 의 `.builder-toast*` 가 준다.
  action: {},
};

/** S2 `ToastQueue` variant — 빌더 store 의 type 이름에서. */
export const BUILDER_TOAST_VARIANT = {
  success: "positive",
  error: "negative",
  info: "info",
  warning: "neutral",
} as const satisfies Record<ToastType, ToastVariant>;
