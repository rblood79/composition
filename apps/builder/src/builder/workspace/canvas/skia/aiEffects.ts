/**
 * G.3 AI Visual Feedback Renderer
 *
 * AI 작업 중(Generating) 및 완료(Flash) 시 캔버스 레벨 시각 피드백.
 * Pencil §21.14 패턴(블러+파티클, 스캔라인+스트로크)을 CanvasKit으로 구현.
 *
 * 디자인 노드 렌더링 이후, surface.flush() 이전에 호출된다.
 *
 * @see docs/WASM_DOC_IMPACT_ANALYSIS.md §G.3
 */

import type { CanvasKit, Canvas } from "canvaskit-wasm";
import type {
  GeneratingEffectState,
  FlashAnimationState,
  AIEffectNodeBounds,
} from "./types";
import { SkiaDisposable } from "./disposable";
import { acquireScopedPaint } from "./paints";

// ============================================
// Constants
// ============================================

const PARTICLE_ORBIT_RADIUS = 20; // 파티클 공전 반경 (px)
const PARTICLE_DOT_RADIUS = 3; // 각 파티클 점 반경 (px)
const SCANLINE_SPEED = 200; // 스캔라인 이동 속도 (px/s)
const SCANLINE_HEIGHT = 4; // 스캔라인 높이 (px)

// ============================================
// Generating Effect
// ============================================

/**
 * AI 생성 중인 노드 위에 블러 + 회전 파티클 이펙트를 렌더링한다.
 *
 * Pencil의 renderGeneratingEffects() 패턴:
 * - 노드 영역에 블러 오버레이
 * - 중심에서 회전하는 파란색 원형 파티클 (currentTime/2000 회전)
 */
export function renderGeneratingEffects(
  ck: CanvasKit,
  canvas: Canvas,
  currentTime: number,
  generatingNodes: Map<string, GeneratingEffectState>,
  nodeBoundsMap: Map<string, AIEffectNodeBounds>,
): void {
  if (generatingNodes.size === 0) return;

  for (const [elementId, state] of generatingNodes) {
    const bounds = nodeBoundsMap.get(elementId);
    if (!bounds) continue;

    const scope = new SkiaDisposable();
    try {
      const rect = ck.LTRBRect(
        bounds.x,
        bounds.y,
        bounds.x + bounds.width,
        bounds.y + bounds.height,
      );

      // 1. 블러 오버레이
      const blurFilter = scope.track(
        ck.ImageFilter.MakeBlur(
          state.blurSigma,
          state.blurSigma,
          ck.TileMode.Clamp,
          null,
        ),
      );
      const blurPaint = acquireScopedPaint(scope, ck);
      blurPaint.setImageFilter(blurFilter);
      blurPaint.setAlphaf(0.6);

      // 반투명 오버레이 배경
      const overlayPaint = acquireScopedPaint(scope, ck);
      overlayPaint.setColor(ck.Color4f(0.95, 0.95, 0.97, 0.5));

      canvas.saveLayer(blurPaint);
      if (bounds.borderRadius > 0) {
        const rrect = ck.RRectXY(
          rect,
          bounds.borderRadius,
          bounds.borderRadius,
        );
        canvas.drawRRect(rrect, overlayPaint);
      } else {
        canvas.drawRect(rect, overlayPaint);
      }
      canvas.restore();

      // 2. 회전 파티클
      const elapsed = currentTime - state.startTime;
      const angle = elapsed / 2000; // Pencil: currentTime / 2000
      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;

      const particlePaint = acquireScopedPaint(scope, ck);
      particlePaint.setAntiAlias(true);
      particlePaint.setColor(state.particleColor);

      for (let i = 0; i < state.particleCount; i++) {
        const particleAngle = angle + (i * 2 * Math.PI) / state.particleCount;
        const px = centerX + Math.cos(particleAngle) * PARTICLE_ORBIT_RADIUS;
        const py = centerY + Math.sin(particleAngle) * PARTICLE_ORBIT_RADIUS;
        canvas.drawCircle(px, py, PARTICLE_DOT_RADIUS, particlePaint);
      }
    } finally {
      scope.dispose();
    }
  }
}

// ============================================
// Flash Animation
// ============================================

/**
 * AI 작업 완료 후 변경 노드에 스트로크 + 스캔라인 애니메이션을 렌더링한다.
 *
 * Pencil의 renderFlashes() / addFlashForNode() 패턴:
 * - 스트로크 RRect (이즈-아웃 페이드)
 * - 스캔라인 그라디언트 (선택적)
 */
export function renderFlashes(
  ck: CanvasKit,
  canvas: Canvas,
  currentTime: number,
  flashAnimations: Map<string, FlashAnimationState>,
  nodeBoundsMap: Map<string, AIEffectNodeBounds>,
): void {
  if (flashAnimations.size === 0) return;

  for (const [elementId, state] of flashAnimations) {
    const bounds = nodeBoundsMap.get(elementId);
    if (!bounds) continue;

    const elapsed = currentTime - state.startTime;
    const progress = Math.min(elapsed / state.duration, 1.0);
    if (progress >= 1.0) continue; // 만료됨

    const scope = new SkiaDisposable();
    try {
      // 이즈-아웃 알파
      const alpha = 1.0 - progress * progress;

      const rect = ck.LTRBRect(
        bounds.x,
        bounds.y,
        bounds.x + bounds.width,
        bounds.y + bounds.height,
      );

      // 1. 스트로크 RRect
      const strokePaint = acquireScopedPaint(scope, ck);
      strokePaint.setAntiAlias(true);
      strokePaint.setStyle(ck.PaintStyle.Stroke);
      strokePaint.setStrokeWidth(state.config.strokeWidth);
      strokePaint.setColor(
        ck.Color4f(
          state.config.color[0],
          state.config.color[1],
          state.config.color[2],
          alpha,
        ),
      );

      if (bounds.borderRadius > 0) {
        const rrect = ck.RRectXY(
          rect,
          bounds.borderRadius,
          bounds.borderRadius,
        );
        canvas.drawRRect(rrect, strokePaint);
      } else {
        canvas.drawRect(rect, strokePaint);
      }

      // 2. 스캔라인 그라디언트 (선택적)
      if (state.config.scanLine) {
        const scanY =
          bounds.y + (((elapsed * SCANLINE_SPEED) / 1000) % bounds.height);

        canvas.save();
        canvas.clipRect(rect, ck.ClipOp.Intersect, false);

        const scanRect = ck.LTRBRect(
          bounds.x,
          scanY,
          bounds.x + bounds.width,
          scanY + SCANLINE_HEIGHT,
        );
        const scanPaint = acquireScopedPaint(scope, ck);
        scanPaint.setColor(
          ck.Color4f(
            state.config.color[0],
            state.config.color[1],
            state.config.color[2],
            alpha * 0.3,
          ),
        );
        canvas.drawRect(scanRect, scanPaint);

        canvas.restore();
      }
    } finally {
      scope.dispose();
    }
  }
}
