import type { CSSProperties } from "react";

interface FillGradientStopLike {
  color?: unknown;
  position?: unknown;
}

interface FillLike {
  type?: unknown;
  enabled?: unknown;
  color?: unknown;
  rotation?: unknown;
  center?: {
    x?: unknown;
    y?: unknown;
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

function gradientStopsToCss(
  stops: FillGradientStopLike[] | null | undefined,
): string {
  if (!stops || stops.length === 0) return "#000000 0%, #FFFFFF 100%";
  return stops
    .map((stop, index) => {
      const color = toHex6(stop.color) ?? "#000000";
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
        const color = toHex6(fill.color);
        return color ? { backgroundColor: color } : {};
      }
      case "linear-gradient": {
        const rotation = isFiniteNumber(fill.rotation) ? fill.rotation : 0;
        return {
          backgroundImage: `linear-gradient(${rotation}deg, ${gradientStopsToCss(fill.stops)})`,
        };
      }
      case "radial-gradient": {
        const cx = isFiniteNumber(fill.center?.x)
          ? Math.round(fill.center.x * 100)
          : 50;
        const cy = isFiniteNumber(fill.center?.y)
          ? Math.round(fill.center.y * 100)
          : 50;
        return {
          backgroundImage: `radial-gradient(circle at ${cx}% ${cy}%, ${gradientStopsToCss(fill.stops)})`,
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
          backgroundImage: `conic-gradient(from ${rotation}deg at ${cx}% ${cy}%, ${gradientStopsToCss(fill.stops)})`,
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

export function adaptElementFillStyle<T extends FillAdaptableElement>(
  element: T,
): T {
  if (!("fills" in element)) return element;

  return {
    ...element,
    props: {
      ...(element.props ?? {}),
      style: adaptStyleWithFills(element.props?.style, element.fills),
    },
  };
}
