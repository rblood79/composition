import type { CSSProperties } from "react";
import { resolveAssetUrl } from "./assetRef";

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
  // ADR-298 Phase 3 — a theme color token's variable (the DOM writes a token fill so a color-mode
  // change reaches it through CSS); a layer opacity mixes it with transparent (= rgba alpha in srgb).
  if (typeof color === "string" && /^var\(--[\w-]+\)$/.test(color)) {
    const alpha = round3(opacity);
    return alpha >= 1
      ? color
      : `color-mix(in srgb, ${color} ${round3(alpha * 100)}%, transparent)`;
  }
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

/** fill 하나 → CSS 배경 층. color 는 backgroundColor (단층) / linear-gradient(c, c) (다층) 둘 다 낼 수 있게 색을 따로 준다. */
type CssFillLayer =
  | { kind: "color"; color: string }
  | {
      kind: "image";
      image: string;
      size?: string;
      /** 사용자 이미지 fill 만 — 중앙 · 반복 없음 (Skia image shader 와 같은 기하) */
      photo?: true;
    };

function fillToCssLayer(fill: FillLike): CssFillLayer | null {
  switch (fill?.type) {
    case "color": {
      const color = toCssColorWithAlpha(fill.color, readFillOpacity(fill));
      return color ? { kind: "color", color } : null;
    }
    case "linear-gradient": {
      const rotation = isFiniteNumber(fill.rotation) ? fill.rotation : 0;
      return {
        kind: "image",
        image: `linear-gradient(${rotation}deg, ${gradientStopsToCss(fill.stops, readFillOpacity(fill))})`,
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
        kind: "image",
        image: `radial-gradient(${size} at ${cx}% ${cy}%, ${gradientStopsToCss(fill.stops, readFillOpacity(fill))})`,
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
        kind: "image",
        image: `conic-gradient(from ${rotation}deg at ${cx}% ${cy}%, ${gradientStopsToCss(fill.stops, readFillOpacity(fill))})`,
      };
    }
    case "image": {
      if (typeof fill.url !== "string" || fill.url.length === 0) return null;
      // ADR-235 — `asset:` 은 해석기로. 준비 전이면 층을 만들지 않는다 (요청 0).
      const url = resolveAssetUrl(fill.url);
      if (!url) return null;
      const size =
        fill.mode === "stretch"
          ? "100% 100%"
          : fill.mode === "fit"
            ? "contain"
            : "cover";
      return { kind: "image", image: `url(${url})`, size, photo: true };
    }
    case "mesh-gradient": {
      const points = Array.isArray(fill.points) ? fill.points : [];
      if (points.length < 4) return null;
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
        kind: "image",
        image: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
        size: "100% 100%",
      };
    }
    default:
      return null;
  }
}

/**
 * fills → CSS 배경. enabled fill 을 전부 그린다 (아래 → 위 = 배열 순서, 2026-09-15 — 종전엔
 * 맨 위 하나만). 단층은 종전 출력 그대로 (color → backgroundColor, 그 외 backgroundImage).
 * 다층은 CSS `background-image` 층 쌓기 — 목록 첫 항목이 맨 위이므로 배열을 뒤집고, 단색은
 * `linear-gradient(c, c)` 한 층으로. `background-size` 는 층 수만큼 (이미지만 자기 크기, 그 외
 * auto). Skia 는 buildBoxNodeData 의 fillLayers 가 같은 순서로 칠한다 (대칭).
 */
export function fillsToCssBackgroundStyle(
  fills: unknown[] | null | undefined,
): Pick<
  CSSProperties,
  | "backgroundColor"
  | "backgroundImage"
  | "backgroundSize"
  | "backgroundPosition"
  | "backgroundRepeat"
> {
  if (!fills) return {};

  const layers: CssFillLayer[] = [];
  for (const raw of fills) {
    const fill = raw as FillLike;
    if (fill?.enabled === false) continue;
    const layer = fillToCssLayer(fill);
    if (layer) layers.push(layer);
  }
  if (layers.length === 0) return {};
  // 단층 color 만 backgroundColor — 그 외 단층은 아래 층 쌓기 경로가 같은 값을 낸다.
  if (layers.length === 1 && layers[0]!.kind === "color") {
    return { backgroundColor: layers[0]!.color };
  }

  const top = [...layers].reverse();
  const hasImageSize = top.some((l) => l.kind === "image" && l.size);
  const hasPhoto = top.some((l) => l.kind === "image" && l.photo);
  return {
    backgroundImage: top
      .map((l) =>
        l.kind === "color"
          ? `linear-gradient(${l.color}, ${l.color})`
          : l.image,
      )
      .join(", "),
    ...(hasImageSize
      ? {
          backgroundSize: top
            .map((l) => (l.kind === "image" && l.size ? l.size : "auto"))
            .join(", "),
        }
      : {}),
    // 이미지 fill = 중앙 · 반복 없음 — Skia image shader (fillToSkia: 중앙 matrix · Decal) 와
    //   같은 기하 (ADR-235 G1). 종전 기본값 (좌상단 · repeat) 은 fit 에서 타일로 갈렸다.
    ...(hasPhoto
      ? {
          backgroundPosition: top
            .map((l) => (l.kind === "image" && l.photo ? "center" : "0% 0%"))
            .join(", "),
          backgroundRepeat: top
            .map((l) =>
              l.kind === "image" && l.photo ? "no-repeat" : "repeat",
            )
            .join(", "),
        }
      : {}),
  };
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
