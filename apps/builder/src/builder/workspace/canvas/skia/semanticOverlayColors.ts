import type { CanvasKit } from "canvaskit-wasm";
import { TAILWIND_PALETTE } from "@composition/specs";
import type { EditingSemanticsRole } from "../../../utils/editingSemantics";

/** `#rrggbb` → CanvasKit Color4f 채널 (0~1). 팔레트 hex 를 오버레이 상수로 내릴 때 공용 (ADR-191 R8). */
export function hexToRgb01(hex: string): readonly [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

/** blue-500 — tailwindcss/theme.css 파생 팔레트 (손 복사 v3 #3b82f6 제거) */
const OVERLAY_BLUE = hexToRgb01(TAILWIND_PALETTE.blue[500]);
export const OVERLAY_BLUE_R = OVERLAY_BLUE[0];
export const OVERLAY_BLUE_G = OVERLAY_BLUE[1];
export const OVERLAY_BLUE_B = OVERLAY_BLUE[2];
export const OVERLAY_BLUE_RGB: readonly [number, number, number] = [
  OVERLAY_BLUE_R,
  OVERLAY_BLUE_G,
  OVERLAY_BLUE_B,
];

/**
 * 스냅 정렬선(snapGuideRenderer)·수동 가이드(guideRenderer) 공용 웜 레드
 * (#F24822 — Figma 실측값, 양 테마 공용). 두 렌더러가 각자 선언하면 한쪽만
 * 조정될 때 "같은 색" 이라는 어법 자체가 깨진다.
 */
export const OVERLAY_WARM_RED_HEX = 0xf24822;

/** event-navigation 엣지 보라 (purple-500) — workflow 렌더러·미니맵 공용, 팔레트 파생 */
export const EVENT_NAV_PURPLE_RGB: readonly [number, number, number] =
  hexToRgb01(TAILWIND_PALETTE.purple[500]);

const ORIGIN_R = 0xd4 / 255;
const ORIGIN_G = 0x80 / 255;
const ORIGIN_B = 0xff / 255;

const INSTANCE_R = 0x95 / 255;
const INSTANCE_G = 0x80 / 255;
const INSTANCE_B = 0xf6 / 255;

export function getSemanticOverlayColor(
  ck: CanvasKit,
  role: EditingSemanticsRole | null,
  alpha: number,
): Float32Array {
  if (role === "origin") {
    return ck.Color4f(ORIGIN_R, ORIGIN_G, ORIGIN_B, alpha);
  }

  if (role === "instance") {
    return ck.Color4f(INSTANCE_R, INSTANCE_G, INSTANCE_B, alpha);
  }

  return ck.Color4f(OVERLAY_BLUE_R, OVERLAY_BLUE_G, OVERLAY_BLUE_B, alpha);
}
