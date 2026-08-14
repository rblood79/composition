import type { CanvasKit } from "canvaskit-wasm";
import type { EditingSemanticsRole } from "../../../utils/editingSemantics";

export const OVERLAY_BLUE_R = 0x3b / 255;
export const OVERLAY_BLUE_G = 0x82 / 255;
export const OVERLAY_BLUE_B = 0xf6 / 255;
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

/** event-navigation 엣지 보라 (purple-500 #a855f7) — workflow 렌더러·미니맵 공용 */
export const EVENT_NAV_PURPLE_RGB: readonly [number, number, number] = [
  0xa8 / 255,
  0x55 / 255,
  0xf7 / 255,
];

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
