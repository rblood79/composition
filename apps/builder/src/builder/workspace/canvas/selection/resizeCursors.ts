/**
 * 각도 파라미터 리사이즈 커서 (Pen v1.2.1 수법 차용)
 *
 * OS 기본 resize 커서 키워드 대신, 요청 각도로 회전한 양방향 화살표를
 * 오프스크린 캔버스에 1x/2x 로 그려 data URL 로 캐시하고
 * `-webkit-image-set(...) x y, <fallback>` CSS cursor 문자열을 만든다.
 *
 * - 플랫폼 무관 동일 커서 (OS 커서 테마 편차 제거) + 임의 각도 지원.
 * - 각도는 1° 단위 양자화 + 180° 대칭 접기로 캐시 — 현행 축 정렬 핸들은
 *   0/45/90/135° 4종만 실사용, 요소 회전 도입 시 그대로 임의 각도 수용.
 * - 캔버스 2D 미지원 환경 (테스트 jsdom 등) 은 keyword fallback 으로 강등.
 *
 * @see docs/explanation/research/PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md §6-2
 */

import type { HandleConfig, HandlePosition } from "./types";

/** 커서 비트맵 논리 크기 (1x, px) — hotspot 은 정중앙 */
const CURSOR_SIZE = 24;
const HOTSPOT = CURSOR_SIZE / 2;

/**
 * 핸들 위치 → 화살표 각도 (deg, 화면 좌표계 y-down 기준 +x 축에서 시계방향).
 * nwse(↘) = 45°, nesw(↗) = 135°.
 */
const HANDLE_ANGLES: Record<HandlePosition, number> = {
  "middle-left": 0,
  "middle-right": 0,
  "top-left": 45,
  "bottom-right": 45,
  "top-center": 90,
  "bottom-center": 90,
  "top-right": 135,
  "bottom-left": 135,
};

/** 45° 버킷별 keyword fallback (임의 각도 → 최근접 표준 커서) */
const FALLBACK_BY_BUCKET = [
  "ew-resize",
  "nwse-resize",
  "ns-resize",
  "nesw-resize",
] as const;

/** 각도 → cursor 문자열 캐시 (양자화 후 각도당 1회 생성) */
const cursorCache = new Map<number, string>();

/** 캔버스 2D 사용 가능 여부 — 첫 실패 시 false 고정 (jsdom 등) */
let imageCursorSupported: boolean | null = null;

/** 1° 양자화 + 180° 대칭 접기 (양방향 화살표는 반주기 대칭) */
function quantizeAngle(angleDeg: number): number {
  return ((Math.round(angleDeg) % 180) + 180) % 180;
}

function fallbackKeyword(quantized: number): string {
  return FALLBACK_BY_BUCKET[Math.round(quantized / 45) % 4];
}

/**
 * 양방향 리사이즈 화살표를 주어진 배율/각도로 그려 data URL 을 반환한다.
 * 검정 본체 + 흰색 외곽선 (배경 무관 가시성 — Figma/Pen 동일 계열).
 */
function drawArrowDataUrl(scale: number, angleDeg: number): string | null {
  const size = CURSOR_SIZE * scale;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.scale(scale, scale);
  ctx.translate(HOTSPOT, HOTSPOT);
  ctx.rotate((angleDeg * Math.PI) / 180);

  // x축 정렬 양방향 화살표 폴리곤 (중심 원점, 좌우 대칭)
  const pts: ReadonlyArray<readonly [number, number]> = [
    [-10.5, 0],
    [-4.5, -4.5],
    [-4.5, -1.6],
    [4.5, -1.6],
    [4.5, -4.5],
    [10.5, 0],
    [4.5, 4.5],
    [4.5, 1.6],
    [-4.5, 1.6],
    [-4.5, 4.5],
  ];
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i][0], pts[i][1]);
  }
  ctx.closePath();

  // 흰 외곽선 먼저 (본체 밖으로 절반 노출) → 검정 본체 fill
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = "#000000";
  ctx.fill();

  return canvas.toDataURL("image/png");
}

/**
 * 주어진 각도의 리사이즈 커서 CSS cursor 값을 반환한다.
 *
 * 성공 시 `-webkit-image-set(url(...) 1x, url(...) 2x) hx hy, <fallback>`,
 * 이미지 커서 미지원 환경에서는 keyword fallback 만 반환.
 *
 * @param angleDeg 화살표 각도 (deg, y-down 화면 좌표계)
 * @param fallback 미지원/파싱 실패 시 keyword — 생략 시 최근접 표준 커서
 */
export function getResizeCursorForAngle(
  angleDeg: number,
  fallback?: string,
): string {
  const quantized = quantizeAngle(angleDeg);
  const keyword = fallback ?? fallbackKeyword(quantized);

  if (imageCursorSupported === false) return keyword;

  const cached = cursorCache.get(quantized);
  if (cached) return `${cached}, ${keyword}`;

  if (typeof document === "undefined") {
    imageCursorSupported = false;
    return keyword;
  }

  try {
    const url1x = drawArrowDataUrl(1, quantized);
    const url2x = drawArrowDataUrl(2, quantized);
    if (!url1x || !url2x) {
      imageCursorSupported = false;
      return keyword;
    }
    imageCursorSupported = true;
    const imageSet = `-webkit-image-set(url("${url1x}") 1x, url("${url2x}") 2x) ${HOTSPOT} ${HOTSPOT}`;
    cursorCache.set(quantized, imageSet);
    return `${imageSet}, ${keyword}`;
  } catch {
    imageCursorSupported = false;
    return keyword;
  }
}

/**
 * 선택 핸들의 hover 커서를 결정한다 — 핸들 위치의 기하 각도로
 * 이미지 커서를 생성하고, 미지원 시 기존 keyword (`handle.cursor`) 유지.
 *
 * 요소 회전 도입 시 `rotationDeg` 에 요소 회전각을 더해 그대로 확장한다.
 */
export function resolveHandleCursor(
  handle: Pick<HandleConfig, "position" | "cursor">,
  rotationDeg = 0,
): string {
  const baseAngle = HANDLE_ANGLES[handle.position] ?? 0;
  return getResizeCursorForAngle(baseAngle + rotationDeg, handle.cursor);
}
