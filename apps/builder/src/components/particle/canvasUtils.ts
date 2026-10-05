import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PIXEL_SAMPLE_STEP,
  POINT_SCALE,
  SVG_SCALE,
  BASE_FONT_SIZE,
  PARTICLE_COUNT,
} from "./constants";
import type { MorphContent } from "./types";

// ==================== 공유 캔버스 ====================
let sharedCanvas: HTMLCanvasElement | null = null;
let sharedCtx: CanvasRenderingContext2D | null = null;

export function getSharedCanvas(): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  if (!sharedCanvas) {
    sharedCanvas = document.createElement("canvas");
    sharedCanvas.width = CANVAS_WIDTH;
    sharedCanvas.height = CANVAS_HEIGHT;
    sharedCtx = sharedCanvas.getContext("2d", { willReadFrequently: true })!;
  }
  return { canvas: sharedCanvas, ctx: sharedCtx! };
}

// ==================== SVG 유틸리티 ====================
function getAttr(elem: Element, name: string, defaultValue = 0): number {
  return parseFloat(elem.getAttribute(name) || String(defaultValue));
}

function renderPoly(
  elem: Element,
  ctx: CanvasRenderingContext2D,
  close: boolean
) {
  const points =
    elem.getAttribute("points")?.trim().split(/\s+|,/).map(Number) || [];
  if (points.length < 4) return;
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) {
    ctx.lineTo(points[i], points[i + 1]);
  }
  if (close) ctx.closePath();
  ctx.stroke();
}

const svgRenderers: Record<
  string,
  (elem: Element, ctx: CanvasRenderingContext2D) => void
> = {
  path: (elem, ctx) => {
    const d = elem.getAttribute("d");
    if (d) ctx.stroke(new Path2D(d));
  },
  circle: (elem, ctx) => {
    ctx.beginPath();
    ctx.arc(
      getAttr(elem, "cx"),
      getAttr(elem, "cy"),
      getAttr(elem, "r"),
      0,
      Math.PI * 2
    );
    ctx.stroke();
  },
  line: (elem, ctx) => {
    ctx.beginPath();
    ctx.moveTo(getAttr(elem, "x1"), getAttr(elem, "y1"));
    ctx.lineTo(getAttr(elem, "x2"), getAttr(elem, "y2"));
    ctx.stroke();
  },
  rect: (elem, ctx) => {
    const x = getAttr(elem, "x"),
      y = getAttr(elem, "y");
    const w = getAttr(elem, "width"),
      h = getAttr(elem, "height");
    const rx = getAttr(elem, "rx");
    if (rx > 0) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, rx);
      ctx.stroke();
    } else {
      ctx.strokeRect(x, y, w, h);
    }
  },
  ellipse: (elem, ctx) => {
    ctx.beginPath();
    ctx.ellipse(
      getAttr(elem, "cx"),
      getAttr(elem, "cy"),
      getAttr(elem, "rx"),
      getAttr(elem, "ry"),
      0,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  },
  polyline: (elem, ctx) => renderPoly(elem, ctx, false),
  polygon: (elem, ctx) => renderPoly(elem, ctx, true),
};

export function drawSvgToCanvas(
  svgString: string,
  ctx: CanvasRenderingContext2D
) {
  const doc = new DOMParser().parseFromString(svgString, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) return;

  const viewBox = svg.getAttribute("viewBox")?.split(" ").map(Number) || [
    0, 0, 24, 24,
  ];
  const [, , svgWidth, svgHeight] = viewBox;

  ctx.save();
  ctx.translate(
    CANVAS_WIDTH / 2 - (svgWidth * SVG_SCALE) / 2,
    CANVAS_HEIGHT / 2 - (svgHeight * SVG_SCALE) / 2
  );
  ctx.scale(SVG_SCALE, SVG_SCALE);
  ctx.lineWidth = 2;
  ctx.strokeStyle = ctx.fillStyle = "white";
  ctx.lineCap = ctx.lineJoin = "round";

  svg
    .querySelectorAll("path, circle, line, rect, ellipse, polyline, polygon")
    .forEach((elem) => {
      const renderer = svgRenderers[elem.tagName.toLowerCase()];
      if (renderer) renderer(elem, ctx);
    });

  ctx.restore();
}

export function drawTextToCanvas(text: string, ctx: CanvasRenderingContext2D) {
  ctx.textAlign = "center";
  const maxWidth = CANVAS_WIDTH * 0.85;
  ctx.font = `bold ${BASE_FONT_SIZE}px sans-serif`;

  const textWidth = ctx.measureText(text).width;
  if (textWidth > maxWidth) {
    const fontSize = Math.floor((BASE_FONT_SIZE * maxWidth) / textWidth);
    ctx.font = `bold ${fontSize}px sans-serif`;
  }

  const metrics = ctx.measureText(text);
  const textHeight =
    metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
  const centerY =
    CANVAS_HEIGHT / 2 + metrics.actualBoundingBoxAscent - textHeight / 2;
  ctx.fillText(text, CANVAS_WIDTH / 2, centerY);
}

export function generatePointsFromContent(content: MorphContent): Float32Array {
  const { ctx } = getSharedCanvas();

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = "white";

  if (content.type === "text") {
    drawTextToCanvas(content.value, ctx);
  } else {
    drawSvgToCanvas(content.value, ctx);
  }

  const { data } = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  const points: number[] = [];
  const halfWidth = CANVAS_WIDTH / 2;
  const halfHeight = CANVAS_HEIGHT / 2;

  for (let y = 0; y < CANVAS_HEIGHT; y += PIXEL_SAMPLE_STEP) {
    for (let x = 0; x < CANVAS_WIDTH; x += PIXEL_SAMPLE_STEP) {
      if (data[(y * CANVAS_WIDTH + x) * 4] > 128) {
        points.push(
          (x - halfWidth) * POINT_SCALE,
          -(y - halfHeight) * POINT_SCALE,
          (Math.random() - 0.5) * 12
        );
      }
    }
  }

  const pointCount = points.length / 3;
  while (points.length / 3 < PARTICLE_COUNT) {
    const i = Math.floor(Math.random() * pointCount) * 3;
    points.push(
      points[i] + (Math.random() - 0.5) * 7,
      points[i + 1] + (Math.random() - 0.5) * 7,
      points[i + 2]
    );
  }

  return new Float32Array(points.slice(0, PARTICLE_COUNT * 3));
}

// ==================== WebGL 정리 ====================

/**
 * 캔버스 언마운트 때 GPU 자원을 놓는다 — pass 마다 dispose (bloom · afterimage 의 render
 * target 은 composer.dispose 가 놓지 않는다), 그다음 renderer 와 WebGL context 자체.
 * 이펙트 전환마다 새 context 를 만들므로 context 를 잃게 하지 않으면 브라우저 상한에 닿는다.
 */
export function releaseWebGL(
  renderer: { dispose(): void; forceContextLoss(): void },
  composer?: { passes: readonly { dispose?(): void }[]; dispose(): void },
): void {
  if (composer) {
    for (const pass of composer.passes) pass.dispose?.();
    composer.dispose();
  }
  renderer.dispose();
  renderer.forceContextLoss();
}
