import type { CSSProperties } from "react";
import { shadowLiteralToCssVar } from "@composition/specs";

interface FillGradientStopLike {
  color?: unknown;
  position?: unknown;
}

interface FillLike {
  type?: unknown;
  enabled?: unknown;
  color?: unknown;
  opacity?: unknown;
  rotation?: unknown;
  center?: {
    x?: unknown;
    y?: unknown;
  } | null;
  radius?: {
    width?: unknown;
    height?: unknown;
  } | null;
  stops?: FillGradientStopLike[] | null;
  url?: unknown;
  mode?: unknown;
  points?: Array<{ color?: unknown }> | null;
}

interface FillAdaptableElement {
  fills?: unknown[];
  props?: Record<string, unknown> & {
    style?: CSSProperties;
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toHex6(color: unknown): string | undefined {
  if (typeof color !== "string") return undefined;
  if (/^#[0-9a-fA-F]{8}$/.test(color)) return color.slice(0, 7).toUpperCase();
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color.toUpperCase();
  return undefined;
}

/** "#RRGGBB[AA]" → 채널 분해 (a 는 0-1) */
function parseHexColor(
  color: unknown,
): { r: number; g: number; b: number; a: number } | undefined {
  if (typeof color !== "string") return undefined;
  const match = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(color);
  if (!match) return undefined;
  return {
    r: parseInt(match[1].slice(0, 2), 16),
    g: parseInt(match[1].slice(2, 4), 16),
    b: parseInt(match[1].slice(4, 6), 16),
    a: match[2] !== undefined ? parseInt(match[2], 16) / 255 : 1,
  };
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * hex alpha × fill-level opacity 합성 CSS 색.
 * 합성 alpha 가 1 이면 기존 출력 형식(hex6) 보존, 미만이면 rgba() —
 * alpha 절단(toHex6 단독)으로 반투명 fill 이 불투명 렌더되던 결함(2026-07-15)
 * 의 수정 지점. Skia 경로(fillToSkia)는 이미 alpha×opacity 를 적용하므로
 * 본 합성이 DOM↔Skia 대칭을 회복한다.
 */
function toCssColorWithAlpha(
  color: unknown,
  opacity: number,
): string | undefined {
  const parsed = parseHexColor(color);
  if (!parsed) return undefined;
  const alpha = round3(parsed.a * opacity);
  if (alpha >= 1) return toHex6(color);
  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${alpha})`;
}

function readFillOpacity(fill: FillLike): number {
  return isFiniteNumber(fill.opacity) ? fill.opacity : 1;
}

function gradientStopsToCss(
  stops: FillGradientStopLike[] | null | undefined,
  opacity: number,
): string {
  if (!stops || stops.length === 0) return "#000000 0%, #FFFFFF 100%";
  return stops
    .map((stop, index) => {
      const color = toCssColorWithAlpha(stop.color, opacity) ?? "#000000";
      const rawPosition = isFiniteNumber(stop.position)
        ? stop.position
        : index === stops.length - 1
          ? 1
          : 0;
      const percent = Math.max(0, Math.min(100, Math.round(rawPosition * 100)));
      return `${color} ${percent}%`;
    })
    .join(", ");
}

export function fillsToCssBackgroundStyle(
  fills: unknown[] | null | undefined,
): Pick<
  CSSProperties,
  "backgroundColor" | "backgroundImage" | "backgroundSize"
> {
  if (!fills) return {};

  for (let i = fills.length - 1; i >= 0; i--) {
    const fill = fills[i] as FillLike;
    if (fill?.enabled === false) continue;

    switch (fill?.type) {
      case "color": {
        const color = toCssColorWithAlpha(fill.color, readFillOpacity(fill));
        return color ? { backgroundColor: color } : {};
      }
      case "linear-gradient": {
        const rotation = isFiniteNumber(fill.rotation) ? fill.rotation : 0;
        return {
          backgroundImage: `linear-gradient(${rotation}deg, ${gradientStopsToCss(fill.stops, readFillOpacity(fill))})`,
        };
      }
      case "radial-gradient": {
        const cx = isFiniteNumber(fill.center?.x)
          ? Math.round(fill.center.x * 100)
          : 50;
        const cy = isFiniteNumber(fill.center?.y)
          ? Math.round(fill.center.y * 100)
          : 50;
        // fill 모델 radius(비율 0~1)를 ellipse 크기로 반영 — 과거 `circle`
        // (farthest-corner) 고정은 radius 를 소거해 Skia(radius 소비)와 falloff
        // 크기가 어긋났다 (2026-07-15 정정). radius 무효 시 기존 circle 보존.
        const rw = isFiniteNumber(fill.radius?.width)
          ? Math.round(fill.radius.width * 100)
          : null;
        const rh = isFiniteNumber(fill.radius?.height)
          ? Math.round(fill.radius.height * 100)
          : null;
        const size =
          rw !== null && rh !== null && rw > 0 && rh > 0
            ? `${rw}% ${rh}%`
            : "circle";
        return {
          backgroundImage: `radial-gradient(${size} at ${cx}% ${cy}%, ${gradientStopsToCss(fill.stops, readFillOpacity(fill))})`,
        };
      }
      case "angular-gradient": {
        const rotation = isFiniteNumber(fill.rotation) ? fill.rotation : 0;
        const cx = isFiniteNumber(fill.center?.x)
          ? Math.round(fill.center.x * 100)
          : 50;
        const cy = isFiniteNumber(fill.center?.y)
          ? Math.round(fill.center.y * 100)
          : 50;
        return {
          backgroundImage: `conic-gradient(from ${rotation}deg at ${cx}% ${cy}%, ${gradientStopsToCss(fill.stops, readFillOpacity(fill))})`,
        };
      }
      case "image": {
        if (typeof fill.url !== "string" || fill.url.length === 0) return {};
        const backgroundSize =
          fill.mode === "stretch"
            ? "100% 100%"
            : fill.mode === "fit"
              ? "contain"
              : "cover";
        return {
          backgroundImage: `url(${fill.url})`,
          backgroundSize,
        };
      }
      case "mesh-gradient": {
        const points = Array.isArray(fill.points) ? fill.points : [];
        if (points.length < 4) return {};
        const tl = toHex6(points[0]?.color) ?? "#FF0000";
        const tr = toHex6(points[1]?.color) ?? "#FFFF00";
        const bl = toHex6(points[2]?.color) ?? "#0000FF";
        const br = toHex6(points[3]?.color) ?? "#00FF00";
        const svg = [
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">',
          "<defs>",
          `<linearGradient id="t"><stop offset="0" stop-color="${tl}"/><stop offset="1" stop-color="${tr}"/></linearGradient>`,
          `<linearGradient id="b"><stop offset="0" stop-color="${bl}"/><stop offset="1" stop-color="${br}"/></linearGradient>`,
          '<linearGradient id="m" x2="0" y2="1"><stop offset="0" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient>',
          '<mask id="fade"><rect width="100" height="100" fill="url(#m)"/></mask>',
          "</defs>",
          '<rect width="100" height="100" fill="url(#b)"/>',
          '<rect width="100" height="100" fill="url(#t)" mask="url(#fade)"/>',
          "</svg>",
        ].join("");
        return {
          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
          backgroundSize: "100% 100%",
        };
      }
      default:
        continue;
    }
  }

  return {};
}

export function adaptStyleWithFills(
  style: CSSProperties | undefined,
  fills: unknown[] | null | undefined,
): CSSProperties | undefined {
  // 빈 배열 = fills 없음과 동일 semantics. truthy 빈 배열이 아래 delete 만
  // 수행하고 아무것도 추가하지 않으면 style.background* 사용자 편집을 능동
  // 소거한다 (canonical Preview fills:[] 하드코딩과 결합해 배경 전멸 — 2026-07-15).
  if (!fills || fills.length === 0) return style;

  const nextStyle: CSSProperties = { ...(style ?? {}) };
  delete nextStyle.backgroundColor;
  delete nextStyle.backgroundImage;
  delete nextStyle.backgroundSize;

  return {
    ...nextStyle,
    ...fillsToCssBackgroundStyle(fills),
  };
}

/**
 * 저장된 그림자 리터럴을 CSS 변수 참조로 바꾼다 (ADR-166 후속).
 *
 * 스타일 패널은 프리셋을 고른 순간의 **리터럴**을 기록하므로 그대로 인라인하면 저장 당시
 * theme 이 고착된다. `var(--shadow-md)` 로 내보내면 `[data-theme]` 블록이 브라우저 쪽에서
 * 전환해주므로 이 경로에 theme 을 배선하지 않아도 된다 — preview iframe 과 publish 모두
 * `theme.css → preview-system.css` 를 로드한다.
 *
 * Skia 축은 같은 판정을 `normalizeShadowForTheme` 로 받아 theme 리터럴을 쓴다(대칭).
 * 정규화 대상이 아닌 값(임의 CSS / none / inset 토글)은 원문 그대로 흐른다.
 *
 * **패널 경로에는 적용하지 않는다** — `adaptStyleWithFills` 를 직접 쓰는 `useAppearanceValues` /
 * `useResetStyles` 는 리터럴을 프리셋 키로 역매핑하므로 var 를 받으면 "custom" 으로 표시된다.
 */
function adaptStyleShadow(
  style: CSSProperties | undefined,
): CSSProperties | undefined {
  const raw = style?.boxShadow;
  if (typeof raw !== "string") return style;
  const next = shadowLiteralToCssVar(raw);
  return next === raw ? style : { ...style, boxShadow: next };
}

/**
 * DOM 소비자(preview iframe / publish)가 인라인할 `props.style` 을 만든다.
 *
 * fills → background 변환과 그림자 리터럴 정규화를 합친 **단일 진입점**. 종전에는 fills 만
 * 다뤄 `adaptElementFillStyle` 이었는데, 그림자 축이 붙으면서 이름이 실제 역할보다 좁아져
 * 개명했다. fills 가 없는 요소도 통과해야 하므로 조기 반환은 fills 분기 안으로 옮겼다 —
 * 종전 위치(`if (!("fills" in element)) return element`)에 그대로 두면 fills 없는 요소가
 * 그림자 정규화를 통째로 건너뛴다.
 */
export function adaptElementStyle<T extends FillAdaptableElement>(
  element: T,
): T {
  const hasFills = "fills" in element;
  const baseStyle = element.props?.style;
  const withFills = hasFills
    ? adaptStyleWithFills(baseStyle, element.fills)
    : baseStyle;
  const nextStyle = adaptStyleShadow(withFills);

  // fills 없고 그림자도 그대로면 새 객체를 만들지 않는다 (React memo 참조 안정).
  if (!hasFills && nextStyle === baseStyle) return element;

  return {
    ...element,
    props: {
      ...(element.props ?? {}),
      style: nextStyle,
    },
  };
}
