/**
 * Spec Shape[] → SkiaNodeData 변환기
 *
 * ComponentSpec의 render.shapes()가 반환하는 Shape 배열을
 * CanvasKit/Skia 렌더러가 이해하는 SkiaNodeData로 변환한다.
 */

import type { Shape, ColorValue } from "@composition/specs";
import { getIconData } from "@composition/specs";
import type { SkiaNodeData } from "./nodeRenderers";
import type { EffectStyle, FillStyle } from "./types";
import {
  resolveColor,
  resolveToken,
  hexStringToNumber,
} from "@composition/specs";
import { getSkImage, loadSkImage } from "./imageCache";
import { measureWrappedTextHeight } from "../utils/textMeasure";
import { getLabelLineHeight } from "@composition/specs";
import { hexToColor4fChannels } from "./themeWatcher";
import {
  parseTextDecoration,
  parseDecorationColor,
} from "../sprites/styleConverter";

// ========== Helpers ==========

/** Resolve a value that might be a TokenRef string to a number */
function resolveNum(
  value: unknown,
  theme: "light" | "dark",
  fallback: number = 0,
  depth: number = 0,
): number {
  if (depth > 5) return fallback;
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.startsWith("{")) {
    const resolved = resolveToken(
      value as Parameters<typeof resolveToken>[0],
      theme,
    );
    // 중첩 TokenRef 재귀 해석 (e.g. {spacing.md} → {sizing.4} → 16)
    if (typeof resolved === "string" && resolved.startsWith("{")) {
      return resolveNum(resolved, theme, fallback, depth + 1);
    }
    return typeof resolved === "number"
      ? resolved
      : parseFloat(String(resolved)) || fallback;
  }
  if (typeof value === "string") return parseFloat(value) || fallback;
  return fallback;
}

/**
 * Resolve border radius that may be a number, array, or TokenRef.
 * SkiaNodeData.box.borderRadius supports number | [tl, tr, br, bl].
 */
function resolveRadius(
  value: unknown,
  theme: "light" | "dark",
): number | [number, number, number, number] {
  if (Array.isArray(value)) {
    return [
      resolveNum(value[0], theme, 0),
      resolveNum(value[1], theme, 0),
      resolveNum(value[2], theme, 0),
      resolveNum(value[3], theme, 0),
    ] as [number, number, number, number];
  }
  return resolveNum(value, theme, 0);
}

/** ColorValue → Float32Array color for Skia */
function colorValueToFloat32(
  value: ColorValue,
  theme: "light" | "dark",
  alpha: number = 1,
): Float32Array {
  if (value === "transparent") return TRANSPARENT;
  const resolved = resolveColor(value, theme);
  if (resolved === "transparent" || resolved === undefined || resolved === null)
    return TRANSPARENT;
  let hex: number;
  if (typeof resolved === "string") {
    hex = hexStringToNumber(resolved);
  } else {
    hex = resolved;
  }
  const [r, g, b] = hexToColor4fChannels(hex);
  return Float32Array.of(r, g, b, alpha);
}

/** Transparent color */
const TRANSPARENT = Float32Array.of(0, 0, 0, 0);

/**
 * object-fit 스타일에 따라 이미지 콘텐츠 영역을 계산한다.
 * 반환값: 컨테이너 내부에서 이미지가 그려질 (x, y, w, h)
 */
function computeImageFit(
  fit: "contain" | "cover" | "fill" | "none",
  containerW: number,
  containerH: number,
  imgW: number,
  imgH: number,
): { x: number; y: number; w: number; h: number } {
  if (fit === "fill" || imgW === 0 || imgH === 0) {
    return { x: 0, y: 0, w: containerW, h: containerH };
  }
  if (fit === "none") {
    // 원본 크기, 중앙 정렬
    return {
      x: (containerW - imgW) / 2,
      y: (containerH - imgH) / 2,
      w: imgW,
      h: imgH,
    };
  }
  const scaleX = containerW / imgW;
  const scaleY = containerH / imgH;
  const scale =
    fit === "contain" ? Math.min(scaleX, scaleY) : Math.max(scaleX, scaleY);
  const w = imgW * scale;
  const h = imgH * scale;
  return {
    x: (containerW - w) / 2,
    y: (containerH - h) / 2,
    w,
    h,
  };
}

// ========== Main Converter ==========

/**
 * Shape[] → SkiaNodeData 변환
 *
 * Returns a container SkiaNodeData with the first roundRect/rect as the background box,
 * and all other shapes as children.
 *
 * 2-pass 처리: shadow/border(target 참조)가 target보다 먼저 선언되어도 정상 동작.
 */
export function specShapesToSkia(
  shapes: Shape[],
  theme: "light" | "dark",
  containerWidth: number,
  containerHeight: number,
  elementId?: string,
): SkiaNodeData {
  // Collect converted nodes and track IDs for border/shadow targeting
  const nodeById = new Map<string, SkiaNodeData>();
  const children: SkiaNodeData[] = [];
  let lastNode: SkiaNodeData | null = null;

  // First background box data (extracted from first rect/roundRect)
  let bgBox: SkiaNodeData["box"] | undefined;
  let bgExtracted = false;

  // Deferred shapes: shadow/border with explicit target (forward reference)
  const deferredShapes: Shape[] = [];

  // ===== Pass 1: geometry shapes + targetless shadow/border =====
  for (const shape of shapes) {
    // Defer shadow/border with explicit target to Pass 2
    if ((shape.type === "shadow" || shape.type === "border") && shape.target) {
      deferredShapes.push(shape);
      continue;
    }

    processShape(shape);
  }

  // ===== Pass 2: deferred shadow/border (targets now registered) =====
  for (const shape of deferredShapes) {
    processShape(shape);
  }

  // ===== Post-process: border-box 보정 =====
  // CSS border-box 모델에서 border는 padding 바깥에 위치하므로
  // 텍스트 콘텐츠 영역은 containerWidth에서 border*2를 추가로 제외해야 한다.
  // Pass 2에서 bgBox.strokeWidth가 확정된 후 text children을 일괄 보정.
  const bgBorderWidth = bgBox?.strokeWidth ?? 0;
  if (bgBorderWidth > 0) {
    for (const child of children) {
      if (child.type === "text" && child.text) {
        child.text.paddingLeft += bgBorderWidth;
        child.text.maxWidth -= bgBorderWidth * 2;
        if (child.text.maxWidth < 1) child.text.maxWidth = containerWidth;
      }
      // icon_path border-box 보정: 절대 좌표(padding 기준) 아이콘만 오프셋
      // align="center"/baseline="middle"로 계산된 중앙 배치 아이콘은 보정 불필요
      // (containerWidth/2가 이미 border-box 전체 기준 정확한 중앙)
      if (child.type === "icon_path" && child.iconPath) {
        const halfW = containerWidth / 2;
        const halfH = containerHeight / 2;
        const isCenteredX = Math.abs(child.iconPath.cx - halfW) < 0.5;
        const isCenteredY = Math.abs(child.iconPath.cy - halfH) < 0.5;
        if (!isCenteredX) child.iconPath.cx += bgBorderWidth;
        if (!isCenteredY) child.iconPath.cy += bgBorderWidth;
      }
    }
  }

  // Build the top-level container
  const result = {
    type: "box" as const,
    x: 0,
    y: 0,
    width: containerWidth,
    height: containerHeight,
    visible: true,
    box: bgBox ?? { fillColor: TRANSPARENT, borderRadius: 0 },
    children: children.length > 0 ? children : undefined,
  };

  return result;

  // ===== Shape processor (shared by both passes) =====
  function processShape(shape: Shape): void {
    switch (shape.type) {
      case "roundRect": {
        const w = shape.width === "auto" ? containerWidth : shape.width;
        const h = shape.height === "auto" ? containerHeight : shape.height;
        const fillColor = shape.fill
          ? colorValueToFloat32(shape.fill, theme, shape.fillAlpha ?? 1)
          : TRANSPARENT;
        const radius = resolveRadius(shape.radius, theme);

        const node: SkiaNodeData = {
          type: "box",
          x: shape.x,
          y: shape.y,
          width: w,
          height: h,
          visible: true,
          box: { fillColor, borderRadius: radius },
        };

        // First rect/roundRect at origin = component background
        // 'auto' 또는 containerWidth의 90% 이상이면 full-width 배경으로 추출
        // Fixed-size shapes at origin (e.g., checkbox indicator 20x20) should NOT be extracted as bg
        const isFullWidthRR =
          shape.width === "auto" ||
          (typeof shape.width === "number" &&
            shape.width >= containerWidth * 0.9);
        const isFullHeightRR =
          shape.height === "auto" || shape.height === containerHeight;
        if (
          !bgExtracted &&
          shape.x === 0 &&
          shape.y === 0 &&
          isFullWidthRR &&
          isFullHeightRR
        ) {
          bgBox = node.box;
          bgExtracted = true;
        } else {
          children.push(node);
        }

        if (shape.id)
          nodeById.set(
            shape.id,
            bgExtracted && children.length === 0
              ? { ...node, box: bgBox }
              : node,
          );
        lastNode =
          bgExtracted && children.length === 0 ? { ...node, box: bgBox } : node;
        break;
      }

      case "rect": {
        const w = shape.width === "auto" ? containerWidth : shape.width;
        const h = shape.height === "auto" ? containerHeight : shape.height;
        const fillColor = shape.fill
          ? colorValueToFloat32(shape.fill, theme, shape.fillAlpha ?? 1)
          : TRANSPARENT;

        const node: SkiaNodeData = {
          type: "box",
          x: shape.x,
          y: shape.y,
          width: w,
          height: h,
          visible: true,
          box: { fillColor, borderRadius: 0 },
        };

        // 음수 좌표를 가진 shape는 backdrop 등 전체화면 오버레이이므로 bgBox로 추출하지 않음
        const isPositiveOriginR = shape.x >= 0 && shape.y >= 0;
        const isFullWidthR =
          shape.width === "auto" ||
          (typeof shape.width === "number" &&
            shape.width >= containerWidth * 0.9);
        const isFullHeightR =
          shape.height === "auto" || shape.height === containerHeight;
        if (
          !bgExtracted &&
          isPositiveOriginR &&
          shape.x === 0 &&
          shape.y === 0 &&
          isFullWidthR &&
          isFullHeightR
        ) {
          bgBox = node.box;
          bgExtracted = true;
        } else {
          children.push(node);
        }

        if (shape.id)
          nodeById.set(
            shape.id,
            bgExtracted && children.length === 0
              ? { ...node, box: bgBox }
              : node,
          );
        lastNode =
          bgExtracted && children.length === 0 ? { ...node, box: bgBox } : node;
        break;
      }

      case "circle": {
        // Circle → box with borderRadius = radius
        const diameter = shape.radius * 2;
        const fillColor = shape.fill
          ? colorValueToFloat32(shape.fill, theme, shape.fillAlpha ?? 1)
          : TRANSPARENT;

        const circleBox: SkiaNodeData["box"] = {
          fillColor,
          borderRadius: shape.radius,
        };

        // stroke 속성이 있으면 strokeColor/strokeWidth 추가 (링 표현용)
        if (shape.stroke && shape.strokeWidth) {
          circleBox.strokeColor = colorValueToFloat32(
            shape.stroke,
            theme,
            shape.fillAlpha ?? 1,
          );
          circleBox.strokeWidth = shape.strokeWidth;
          circleBox.strokeStyle = "solid";
        }

        const node: SkiaNodeData = {
          type: "box",
          x: shape.x - shape.radius, // center → top-left
          y: shape.y - shape.radius,
          width: diameter,
          height: diameter,
          visible: true,
          box: circleBox,
        };

        children.push(node);
        if (shape.id) nodeById.set(shape.id, node);
        lastNode = node;
        break;
      }

      case "arc": {
        const arcStrokeColor = colorValueToFloat32(shape.stroke, theme);
        const arcDiameter = shape.radius * 2 + shape.strokeWidth;
        // Arc를 box 타입으로 변환 — renderBox에서 node.arc를 감지하여 렌더링
        // (별도 "arc" 타입은 renderNodeInternal switch 도달 문제로 사용하지 않음)
        const arcNode: SkiaNodeData = {
          type: "box",
          x: shape.x - shape.radius - shape.strokeWidth / 2,
          y: shape.y - shape.radius - shape.strokeWidth / 2,
          width: arcDiameter,
          height: arcDiameter,
          visible: true,
          box: { fillColor: TRANSPARENT, borderRadius: 0 },
          arc: {
            // canvas.translate(node.x, node.y) 후 로컬 좌표
            cx: shape.radius + shape.strokeWidth / 2,
            cy: shape.radius + shape.strokeWidth / 2,
            radius: shape.radius,
            startAngle: shape.startAngle,
            sweepAngle: shape.sweepAngle,
            strokeColor: arcStrokeColor,
            strokeWidth: shape.strokeWidth,
            strokeCap: shape.strokeCap,
          },
        };
        children.push(arcNode);
        if (shape.id) nodeById.set(shape.id, arcNode);
        lastNode = arcNode;
        break;
      }

      case "line": {
        const strokeColor = colorValueToFloat32(shape.stroke, theme);

        // Resolve 'auto' values (used by Separator, Tabs, Panel line shapes)
        const x1 = shape.x1 === "auto" ? containerWidth : shape.x1;
        const y1 = shape.y1 === "auto" ? containerHeight : shape.y1;
        const x2 = shape.x2 === "auto" ? containerWidth : shape.x2;
        const y2 = shape.y2 === "auto" ? containerHeight : shape.y2;

        const node: SkiaNodeData = {
          type: "line",
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          visible: true,
          line: {
            x1,
            y1,
            x2,
            y2,
            strokeColor,
            strokeWidth: shape.strokeWidth,
            // Separator dashed/dotted 등 strokeDasharray 전달
            ...(shape.strokeDasharray
              ? { strokeDasharray: shape.strokeDasharray }
              : {}),
            ...(shape.strokeCap ? { strokeCap: shape.strokeCap } : {}),
          },
        };

        children.push(node);
        lastNode = node;
        break;
      }

      case "icon_font": {
        if (!shape.iconName) break;
        const iconData = getIconData(
          shape.iconName,
          shape.iconFontFamily ?? "lucide",
        );
        if (!iconData) break;

        const strokeColor = shape.fill
          ? colorValueToFloat32(shape.fill, theme)
          : Float32Array.of(0, 0, 0, 1);
        const size = resolveNum(shape.fontSize ?? 16, theme, 16);

        // align="center" → containerWidth 기준 중앙 배치 (icon-only 버튼 등)
        // 음수 x → 우측에서 오프셋 (Button icon end 등)
        let cx: number;
        if (shape.align === "center") {
          cx = containerWidth / 2;
        } else if (shape.align === "right") {
          cx = containerWidth - shape.x;
        } else {
          cx = shape.x < 0 ? containerWidth + shape.x : shape.x;
        }
        // baseline="middle" → containerHeight 기준 수직 중앙 배치
        // 음수 y → 하단에서 오프셋
        let cy: number;
        if (shape.baseline === "middle") {
          cy = containerHeight / 2;
        } else if (shape.baseline === "bottom") {
          cy = containerHeight - shape.y;
        } else {
          cy = shape.y < 0 ? containerHeight + shape.y : shape.y;
        }

        const node: SkiaNodeData = {
          type: "icon_path",
          x: 0,
          y: 0,
          width: size,
          height: size,
          visible: true,
          iconPath: {
            paths: iconData.paths,
            circles: iconData.circles,
            cx,
            cy,
            size,
            strokeColor,
            strokeWidth: shape.strokeWidth ?? 2,
          },
        };

        children.push(node);
        lastNode = node;
        break;
      }

      case "border": {
        // Apply stroke to the target or last node
        const targetNode = shape.target ? nodeById.get(shape.target) : lastNode;

        // M-6: partial border — sides 지정 시 개별 변 렌더링
        if (shape.sides) {
          const strokeColor = colorValueToFloat32(shape.color, theme);
          // Skip fully transparent borders (alpha === 0) — matches CSS behavior
          if (strokeColor[3] === 0) break;
          const bw = shape.borderWidth;
          const tw =
            targetNode?.width ??
            (shape.width === "auto"
              ? containerWidth
              : (shape.width ?? containerWidth));
          const th =
            targetNode?.height ??
            (shape.height === "auto"
              ? containerHeight
              : (shape.height ?? containerHeight));
          const ox = targetNode?.x ?? shape.x ?? 0;
          const oy = targetNode?.y ?? shape.y ?? 0;

          // sides border의 style → strokeDasharray 변환
          const sideStyle = shape.style;
          const sideDasharray: number[] | undefined =
            sideStyle === "dashed"
              ? [Math.max(bw * 3, 4), Math.max(bw * 2, 3)]
              : sideStyle === "dotted"
                ? [bw, bw * 1.5]
                : undefined;

          // M-6 개선: border-radius가 있는 경우 partial_border 노드로 렌더링
          // 우선순위: shape.radius → targetNode.box?.borderRadius
          const rawRadius = shape.radius ?? targetNode?.box?.borderRadius;
          const resolvedRadius =
            rawRadius !== undefined ? resolveRadius(rawRadius, theme) : 0;
          const radiusArr: [number, number, number, number] = Array.isArray(
            resolvedRadius,
          )
            ? resolvedRadius
            : [resolvedRadius, resolvedRadius, resolvedRadius, resolvedRadius];
          const hasRadius = radiusArr.some((r) => r > 0);

          if (hasRadius) {
            // Path-based rendering: arc를 포함한 변별 테두리 (radius 표현 가능)
            children.push({
              type: "partial_border" as const,
              x: ox,
              y: oy,
              width: tw,
              height: th,
              visible: true,
              partialBorder: {
                sides: shape.sides,
                strokeColor,
                strokeWidth: bw,
                borderRadius: radiusArr,
                ...(sideDasharray ? { strokeDasharray: sideDasharray } : {}),
              },
            });
          } else {
            // 기존 line-based rendering (radius 없을 때 유지)
            if (shape.sides.top) {
              children.push({
                type: "line" as const,
                x: 0,
                y: 0,
                width: tw,
                height: bw,
                visible: true,
                line: {
                  x1: ox,
                  y1: oy,
                  x2: ox + tw,
                  y2: oy,
                  strokeColor,
                  strokeWidth: bw,
                  ...(sideDasharray ? { strokeDasharray: sideDasharray } : {}),
                },
              });
            }
            if (shape.sides.right) {
              children.push({
                type: "line" as const,
                x: 0,
                y: 0,
                width: bw,
                height: th,
                visible: true,
                line: {
                  x1: ox + tw,
                  y1: oy,
                  x2: ox + tw,
                  y2: oy + th,
                  strokeColor,
                  strokeWidth: bw,
                  ...(sideDasharray ? { strokeDasharray: sideDasharray } : {}),
                },
              });
            }
            if (shape.sides.bottom) {
              children.push({
                type: "line" as const,
                x: 0,
                y: 0,
                width: tw,
                height: bw,
                visible: true,
                line: {
                  x1: ox,
                  y1: oy + th,
                  x2: ox + tw,
                  y2: oy + th,
                  strokeColor,
                  strokeWidth: bw,
                  ...(sideDasharray ? { strokeDasharray: sideDasharray } : {}),
                },
              });
            }
            if (shape.sides.left) {
              children.push({
                type: "line" as const,
                x: 0,
                y: 0,
                width: bw,
                height: th,
                visible: true,
                line: {
                  x1: ox,
                  y1: oy,
                  x2: ox,
                  y2: oy + th,
                  strokeColor,
                  strokeWidth: bw,
                  ...(sideDasharray ? { strokeDasharray: sideDasharray } : {}),
                },
              });
            }
          }
          break;
        }

        if (targetNode) {
          const strokeColor = colorValueToFloat32(shape.color, theme);
          // Skip fully transparent borders (alpha === 0) — matches CSS behavior
          if (strokeColor[3] === 0) break;

          // If the target is the background box
          if (targetNode.box === bgBox && bgBox) {
            bgBox.strokeColor = strokeColor;
            bgBox.strokeWidth = shape.borderWidth;
            bgBox.strokeStyle = shape.style ?? "solid";
          } else if (targetNode.box) {
            targetNode.box.strokeColor = strokeColor;
            targetNode.box.strokeWidth = shape.borderWidth;
            targetNode.box.strokeStyle = shape.style ?? "solid";
          }
        } else {
          const strokeColor = colorValueToFloat32(shape.color, theme);
          // Skip fully transparent borders (alpha === 0) — matches CSS behavior
          if (strokeColor[3] === 0) break;

          // No target found - render as standalone border box
          const bx = shape.x ?? 0;
          const by = shape.y ?? 0;
          const bw =
            shape.width === "auto"
              ? containerWidth
              : (shape.width ?? containerWidth);
          const bh =
            shape.height === "auto"
              ? containerHeight
              : (shape.height ?? containerHeight);
          const br = resolveRadius(shape.radius, theme);

          children.push({
            type: "box",
            x: bx,
            y: by,
            width: bw,
            height: bh,
            visible: true,
            box: {
              fillColor: TRANSPARENT,
              borderRadius: br,
              strokeColor,
              strokeWidth: shape.borderWidth,
              strokeStyle: shape.style ?? "solid",
            },
          });
        }
        break;
      }

      case "text": {
        if (!shape.text) break;

        // ADR-912 paddingX 데이터 갭 (2026-06-05): NaN 방지 안전장치. shape.x 가 undefined/NaN 이면
        //   하류 `node.text.paddingLeft + textIndent`(nodeRendererText:295/622)가 NaN → drawX=NaN →
        //   텍스트 미표시. 정상 경로는 buildCatalogShapes 가 size.paddingX(rule 데이터) 또는 0 으로
        //   항상 number 를 보내므로 본 guard 는 발동 안 함 — 데이터 보강을 대체하지 않는 방어선.
        if (!Number.isFinite(shape.x)) shape.x = 0;

        const fillColor = shape.fill
          ? colorValueToFloat32(shape.fill, theme)
          : Float32Array.of(0, 0, 0, 1); // default black

        // Resolve fontSize (might be TokenRef like '{typography.text-md}')
        const fontSize = resolveNum(shape.fontSize, theme, 14);

        // Resolve lineHeight:
        // - shape.lineHeight <= 5 → 배수값 (1.5 등) → fontSize * 배수
        // - shape.lineHeight > 5  → px값으로 직접 사용
        // - undefined → CSS typography 토큰 기반 (getLabelLineHeight)
        const defaultLineHeight = getLabelLineHeight(fontSize);
        const lineHeightPx = shape.lineHeight
          ? shape.lineHeight <= 5
            ? fontSize * shape.lineHeight
            : resolveNum(shape.lineHeight, theme, defaultLineHeight)
          : defaultLineHeight;

        // 줄바꿈 시 실제 텍스트 블록 높이 계산 (단일줄이면 lineHeightPx)
        let textBlockHeight = lineHeightPx;
        if (shape.baseline === "middle" && shape.y === 0) {
          const effectiveMaxWidth =
            shape.maxWidth ??
            (shape.x > 0 ? containerWidth - shape.x * 2 : containerWidth);
          if (effectiveMaxWidth > 0 && effectiveMaxWidth < containerWidth) {
            const ff = shape.fontFamily ?? "Inter";
            const fw =
              typeof shape.fontWeight === "number" ? shape.fontWeight : 400;
            const measured = measureWrappedTextHeight(
              shape.text,
              fontSize,
              fw,
              ff,
              effectiveMaxWidth,
              lineHeightPx,
            );
            if (measured > lineHeightPx + 0.5) {
              textBlockHeight = measured;
            }
          }
        }

        // Calculate paddingTop based on baseline
        let paddingTop = shape.y;
        if (shape.baseline === "middle") {
          if (shape.y > 0) {
            paddingTop = Math.max(0, shape.y - lineHeightPx / 2);
          } else {
            // 컨테이너 전체 기준 수직 중앙 (Button, Input, Badge 등)
            paddingTop = Math.max(0, (containerHeight - textBlockHeight) / 2);
          }
        }
        const paddingBottom = Math.max(
          0,
          containerHeight - Math.max(0, paddingTop) - textBlockHeight,
        );

        // Calculate paddingLeft based on align
        // align="right" + x>0: x는 우측 경계 → paddingLeft=0, maxWidth=x
        // align="left"/"center" + x>0: x는 좌측 오프셋 → paddingLeft=x
        let paddingLeft = shape.x;
        let maxWidth = shape.maxWidth ?? containerWidth;

        if (shape.align === "right" && shape.x > 0 && shape.maxWidth == null) {
          // Right-aligned: x는 텍스트 우측 끝 위치 → [0, x] 영역 내 우측 정렬
          paddingLeft = 0;
          maxWidth = shape.x;
        } else if (shape.x > 0 && shape.maxWidth == null) {
          // Auto-reduce maxWidth when text has padding offset
          if (shape.align === "center") {
            // Center-aligned: symmetric padding (subtract from both sides)
            maxWidth = containerWidth - shape.x * 2;
          } else {
            // Left-aligned: subtract left padding only
            maxWidth = containerWidth - shape.x;
          }
          // Clamp to prevent negative maxWidth when container is smaller than padding
          if (maxWidth < 1) maxWidth = containerWidth;
        }

        // Parse fontWeight
        let fontWeight: number | undefined;
        if (shape.fontWeight !== undefined) {
          fontWeight =
            typeof shape.fontWeight === "number"
              ? shape.fontWeight
              : parseInt(String(shape.fontWeight), 10) || 400;
          if (shape.fontWeight === "bold") fontWeight = 700;
          if (shape.fontWeight === "normal") fontWeight = 400;
          if (shape.fontWeight === "medium") fontWeight = 500;
        }

        // Font families — CSS fallback chain을 개별 폰트명으로 분리
        // "Pretendard, Inter, system-ui" → ["Pretendard", "Inter", "system-ui"]
        // 분리하지 않으면 CanvasKit이 전체 문자열을 단일 폰트명으로 매칭 → 실패 → fallback 폰트 사용 → 폭 차이
        const fontFamilies = shape.fontFamily
          ? [
              ...shape.fontFamily
                .split(",")
                .map((f: string) => f.trim().replace(/['"]/g, "")),
              "Inter",
              "system-ui",
              "sans-serif",
            ]
          : ["Inter", "system-ui", "sans-serif"];

        // textDecoration → CanvasKit 비트마스크 변환 (ADR-057 Phase B 풀셋)
        // underline=1, overline=2, lineThrough=4, 조합 지원
        // decorationStyle + decorationColor 동시 처리
        const decorationMask = parseTextDecoration(shape.textDecoration);
        const decoration: number | undefined =
          decorationMask > 0 ? decorationMask : undefined;
        const decorationStyle = shape.decorationStyle;
        const decorationColorF32 = parseDecorationColor(shape.decorationColor);

        // textTransform → 텍스트 콘텐츠 변환
        let textContent = shape.text;
        if (shape.textTransform === "uppercase") {
          textContent = textContent.toUpperCase();
        } else if (shape.textTransform === "lowercase") {
          textContent = textContent.toLowerCase();
        } else if (shape.textTransform === "capitalize") {
          textContent = textContent.replace(/\b\w/g, (c) => c.toUpperCase());
        }

        const node: SkiaNodeData = {
          type: "text",
          x: 0,
          y: 0,
          width: containerWidth,
          height: containerHeight,
          visible: true,
          // 편집 중 Skia 텍스트 숨김용 (nodeRenderers의 _editingElementId 검사)
          elementId,
          text: {
            content: textContent,
            fontFamilies,
            fontSize,
            fontWeight,
            color: fillColor,
            align: shape.align ?? "left",
            letterSpacing: shape.letterSpacing,
            lineHeight:
              shape.lineHeight !== undefined ? lineHeightPx : undefined,
            decoration,
            ...(decorationStyle ? { decorationStyle } : {}),
            ...(decorationColorF32
              ? { decorationColor: decorationColorF32 }
              : {}),
            paddingLeft,
            paddingTop: Math.max(0, paddingTop),
            paddingBottom,
            maxWidth,
            // shape.whiteSpace(spec/escape 가 선언, shape.types.ts:164) → node.text.whiteSpace
            //   변환. 이전엔 매핑 누락으로 무시됐다(node.text.whiteSpace 는 buildSpecNodeData
            //   의 element.props.style.whiteSpace 경로로만 설정됨) → datefield_segments 등
            //   nowrap 선언이 dead 였음. nodeRendererText 가 nowrap 시 layoutMaxWidth 무한
            //   처리(줄바꿈 금지) → CSS Group white-space:nowrap 과 시각 정합.
            //   buildSpecNodeData:1416 의 style.whiteSpace(사용자 override)가 이후 우선 적용.
            ...(shape.whiteSpace ? { whiteSpace: shape.whiteSpace } : {}),
            // shape.verticalAlign(primitive/escape 가 선언) → node.text.verticalAlign 전달.
            //   nodeRendererText computeDrawY 가 "middle" 이면 `(node.height - textHeight)/2` 진짜
            //   세로 중앙(baseline 좌표 계산과 별개). 미전달 시 undefined → top 정렬(위쪽 치우침).
            //   CalendarHeader inline_icon_text center text 가 이 경로로 세로 중앙(사용자 지적).
            ...(shape.verticalAlign
              ? {
                  verticalAlign: shape.verticalAlign as
                    | "top"
                    | "middle"
                    | "bottom"
                    | "baseline",
                }
              : {}),
            autoCenter: false,
          },
        };

        children.push(node);
        break;
      }

      case "shadow": {
        // Apply shadow as effect to target or last node
        const targetNode = shape.target ? nodeById.get(shape.target) : lastNode;

        if (targetNode) {
          const shadowColor = colorValueToFloat32(
            shape.color,
            theme,
            shape.alpha ?? 0.3,
          );
          const effect: EffectStyle = {
            type: "drop-shadow",
            dx: shape.offsetX,
            dy: shape.offsetY,
            sigmaX: shape.blur / 2,
            sigmaY: shape.blur / 2,
            color: shadowColor,
            inner: shape.inset ?? false,
            // M-2: spread → dilate/erode filter 근사
            ...(shape.spread ? { spread: shape.spread } : {}),
          };
          if (!targetNode.effects) targetNode.effects = [];
          targetNode.effects.push(effect);
        }
        break;
      }

      case "container": {
        // Recursively convert children
        const containerNode = specShapesToSkia(
          shape.children,
          theme,
          shape.width === "auto"
            ? containerWidth
            : (shape.width ?? containerWidth),
          shape.height === "auto"
            ? containerHeight
            : (shape.height ?? containerHeight),
          elementId,
        );
        containerNode.x = shape.x;
        containerNode.y = shape.y;
        children.push(containerNode);
        break;
      }

      case "gradient": {
        const w = shape.width === "auto" ? containerWidth : shape.width;
        const h = shape.height === "auto" ? containerHeight : shape.height;
        const colors = shape.gradient.stops.map((s) =>
          colorValueToFloat32(s.color, theme),
        );
        const positions = shape.gradient.stops.map((s) => s.offset);

        let fill: FillStyle;
        if (shape.gradient.type === "linear") {
          const angle = ((shape.gradient.angle ?? 0) * Math.PI) / 180;
          fill = {
            type: "linear-gradient",
            start: [
              w / 2 - (Math.sin(angle) * w) / 2,
              h / 2 - (Math.cos(angle) * h) / 2,
            ],
            end: [
              w / 2 + (Math.sin(angle) * w) / 2,
              h / 2 + (Math.cos(angle) * h) / 2,
            ],
            colors,
            positions,
          };
        } else if (shape.gradient.type === "conic") {
          // CSS conic-gradient 0°=12시 → CanvasKit MakeSweepGradient 0°=3시
          // -90° 보정 + 사용자 angle 적용
          const angleDeg = (shape.gradient.angle ?? 0) - 90;
          const angleRad = (angleDeg * Math.PI) / 180;
          const cos = Math.cos(angleRad);
          const sin = Math.sin(angleRad);
          // CanvasKit 3x3 행렬 (row-major): cx/cy 중심 회전
          const cx = w / 2;
          const cy = h / 2;
          const rotationMatrix = Float32Array.of(
            cos,
            -sin,
            cx - cx * cos + cy * sin,
            sin,
            cos,
            cy - cx * sin - cy * cos,
            0,
            0,
            1,
          );
          fill = {
            type: "angular-gradient",
            cx,
            cy,
            colors,
            positions,
            rotationMatrix,
          };
        } else {
          fill = {
            type: "radial-gradient",
            center: [w / 2, h / 2],
            startRadius: 0,
            endRadius: Math.max(w, h) / 2,
            colors,
            positions,
          };
        }

        const radius = shape.radius ? resolveRadius(shape.radius, theme) : 0;
        const node: SkiaNodeData = {
          type: "box",
          x: shape.x,
          y: shape.y,
          width: w,
          height: h,
          visible: true,
          box: { fillColor: TRANSPARENT, fill, borderRadius: radius },
        };

        // Gradient can also be a background (same logic as roundRect/rect)
        const isFullWidthG =
          shape.width === "auto" ||
          (typeof shape.width === "number" &&
            shape.width >= containerWidth * 0.9);
        const isFullHeightG =
          shape.height === "auto" || shape.height === containerHeight;
        if (
          !bgExtracted &&
          shape.x === 0 &&
          shape.y === 0 &&
          isFullWidthG &&
          isFullHeightG
        ) {
          bgBox = node.box;
          bgExtracted = true;
        } else {
          children.push(node);
        }

        if (shape.id)
          nodeById.set(
            shape.id,
            bgExtracted && children.length === 0
              ? { ...node, box: bgBox }
              : node,
          );
        lastNode =
          bgExtracted && children.length === 0 ? { ...node, box: bgBox } : node;
        break;
      }

      case "image": {
        const imgX = shape.x ?? 0;
        const imgY = shape.y ?? 0;
        const imgW =
          shape.width === "auto"
            ? containerWidth
            : (shape.width ?? containerWidth);
        const imgH =
          shape.height === "auto"
            ? containerHeight
            : (shape.height ?? containerHeight);
        const imgRadius = resolveRadius(shape.radius, theme);

        // 동기 캐시 조회 — 캐시 미스 시 비동기 로딩 트리거
        const skImage = shape.src ? getSkImage(shape.src) : null;
        if (shape.src && !skImage) {
          loadSkImage(shape.src);
        }

        // 이미지 콘텐츠 영역 계산 (object-fit)
        const fit = shape.fit ?? "cover";
        const intrinsicW = skImage ? skImage.width() : imgW;
        const intrinsicH = skImage ? skImage.height() : imgH;
        const content = computeImageFit(
          fit,
          imgW,
          imgH,
          intrinsicW,
          intrinsicH,
        );

        const imgNode: SkiaNodeData = {
          type: "image",
          x: imgX,
          y: imgY,
          width: imgW,
          height: imgH,
          visible: true,
          box: {
            fillColor: TRANSPARENT,
            borderRadius: imgRadius,
          },
          image: {
            skImage,
            contentX: content.x,
            contentY: content.y,
            contentWidth: content.w,
            contentHeight: content.h,
          },
        };

        children.push(imgNode);
        lastNode = imgNode;
        break;
      }
    }
  }
}
