/**
 * Workflow Hit-Test Utilities
 *
 * Bezier 곡선 및 페이지 프레임에 대한 히트 테스트 순수 함수들.
 * workflowRenderer.ts의 computeEndpoints/computeControlPoints를 재사용하여
 * 엣지 지오메트리를 캐싱하고 마우스 좌표와의 거리를 계산한다.
 */

import type { WorkflowEdge } from './workflowEdges';
import type { PageFrame, ElementBounds, EndpointPair, ControlPoints } from './workflowRenderer';
import { computeEndpoints, computeControlPoints, computeOrthogonalTurnPoint } from './workflowRenderer';

// ============================================
// Types
// ============================================

import type { BezierSamplePoint, CachedEdgeGeometry } from './overlayTypes';
export type { BezierSamplePoint, CachedEdgeGeometry };

// ============================================
// Bezier Sampling
// ============================================

/**
 * 3차 Bezier 곡선을 N개의 균일 파라미터 포인트로 샘플링한다.
 *
 * B(t) = (1-t)^3*P0 + 3*(1-t)^2*t*P1 + 3*(1-t)*t^2*P2 + t^3*P3
 *
 * @param n 샘플 개수 (기본 20)
 */
export function sampleBezierCurve(
  sx: number, sy: number,
  cp1x: number, cp1y: number,
  cp2x: number, cp2y: number,
  ex: number, ey: number,
  n = 20,
): BezierSamplePoint[] {
  const samples: BezierSamplePoint[] = [];

  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const u2 = u * u;
    const u3 = u2 * u;
    const t2 = t * t;
    const t3 = t2 * t;

    samples.push({
      x: u3 * sx + 3 * u2 * t * cp1x + 3 * u * t2 * cp2x + t3 * ex,
      y: u3 * sy + 3 * u2 * t * cp1y + 3 * u * t2 * cp2y + t3 * ey,
      t,
    });
  }

  return samples;
}

// ============================================
// Distance Calculation
// ============================================

/**
 * 주어진 점(px, py)에서 샘플링된 Bezier 곡선까지의 최소 거리를 계산한다.
 *
 * 각 연속된 샘플 쌍 사이의 선분과 점 사이의 거리를 구하여 최솟값을 반환.
 */
export function pointToBezierDistance(
  px: number,
  py: number,
  samples: BezierSamplePoint[],
): number {
  let minDist = Infinity;

  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i];
    const b = samples[i + 1];
    const dist = pointToSegmentDistance(px, py, a.x, a.y, b.x, b.y);
    if (dist < minDist) {
      minDist = dist;
    }
  }

  return minDist;
}

/**
 * 점 (px, py)에서 선분 (ax, ay)-(bx, by)까지의 최소 거리.
 */
function pointToSegmentDistance(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // 선분이 점으로 축소된 경우
    return Math.hypot(px - ax, py - ay);
  }

  // 선분 위의 가장 가까운 점을 t 파라미터로 계산
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = ax + t * dx;
  const closestY = ay + t * dy;

  return Math.hypot(px - closestX, py - closestY);
}

// ============================================
// Geometry Cache
// ============================================

/**
 * 모든 엣지에 대해 Bezier 지오메트리를 미리 계산하여 캐시한다.
 *
 * 각 엣지에 대해 computeEndpoints → computeControlPoints → sampleBezierCurve를
 * 수행하고, 결과를 CachedEdgeGeometry 배열로 반환.
 */
export function buildEdgeGeometryCache(
  edges: WorkflowEdge[],
  pageFrameMap: Map<string, PageFrame>,
  elBoundsMap?: Map<string, ElementBounds>,
  straightEdges?: boolean,
): CachedEdgeGeometry[] {
  const cache: CachedEdgeGeometry[] = [];

  for (const edge of edges) {
    const sourceFrame = pageFrameMap.get(edge.sourcePageId);
    const targetFrame = pageFrameMap.get(edge.targetPageId);
    if (!sourceFrame || !targetFrame) continue;

    const sourceElBounds = edge.sourceElementId && elBoundsMap
      ? elBoundsMap.get(edge.sourceElementId)
      : undefined;

    const endpoints: EndpointPair = computeEndpoints(sourceFrame, targetFrame, sourceElBounds);
    let cp: ControlPoints;
    let samples: BezierSamplePoint[];

    if (straightEdges) {
      // 직각(orthogonal): 타겟 직전 페이지와의 갭 중앙에서 꺾어 진입
      const { sx, sy, ex, ey } = endpoints;
      const pageDx = Math.abs(targetFrame.x + targetFrame.width / 2 - sourceFrame.x - sourceFrame.width / 2);
      const pageDy = Math.abs(targetFrame.y + targetFrame.height / 2 - sourceFrame.y - sourceFrame.height / 2);
      const isHorizontal = pageDx >= pageDy;
      if (isHorizontal) {
        const turnX = computeOrthogonalTurnPoint(targetFrame, sourceFrame, pageFrameMap, true, ex > sx);
        samples = [
          { x: sx, y: sy, t: 0 },
          { x: turnX, y: sy, t: 0.33 },
          { x: turnX, y: ey, t: 0.67 },
          { x: ex, y: ey, t: 1 },
        ];
      } else {
        const turnY = computeOrthogonalTurnPoint(targetFrame, sourceFrame, pageFrameMap, false, ey > sy);
        samples = [
          { x: sx, y: sy, t: 0 },
          { x: sx, y: turnY, t: 0.33 },
          { x: ex, y: turnY, t: 0.67 },
          { x: ex, y: ey, t: 1 },
        ];
      }
      cp = { cpx1: sx, cpy1: sy, cpx2: ex, cpy2: ey };
    } else {
      cp = computeControlPoints(endpoints);
      samples = sampleBezierCurve(
        endpoints.sx, endpoints.sy,
        cp.cpx1, cp.cpy1,
        cp.cpx2, cp.cpy2,
        endpoints.ex, endpoints.ey,
      );
    }

    cache.push({
      edgeId: edge.id,
      samples,
      sx: endpoints.sx,
      sy: endpoints.sy,
      ex: endpoints.ex,
      ey: endpoints.ey,
      cpx1: cp.cpx1,
      cpy1: cp.cpy1,
      cpx2: cp.cpx2,
      cpy2: cp.cpy2,
    });
  }

  return cache;
}

// ============================================
// Hit-Test Functions
// ============================================

/**
 * 마우스 좌표에서 가장 가까운 엣지를 찾는다.
 *
 * threshold(씬 좌표 거리) 이내에 있는 엣지 중 가장 가까운 것을 반환.
 * 없으면 null.
 *
 * @param mouseX 씬-로컬 X 좌표
 * @param mouseY 씬-로컬 Y 좌표
 * @param cache buildEdgeGeometryCache 결과
 * @param threshold 최대 허용 거리 (씬 좌표, 기본 8)
 */
export function hitTestEdges(
  mouseX: number,
  mouseY: number,
  cache: CachedEdgeGeometry[],
  threshold = 8,
): { edgeId: string; distance: number } | null {
  let closestId: string | null = null;
  let closestDist = Infinity;

  for (const entry of cache) {
    const dist = pointToBezierDistance(mouseX, mouseY, entry.samples);
    if (dist < threshold && dist < closestDist) {
      closestDist = dist;
      closestId = entry.edgeId;
    }
  }

  if (closestId === null) return null;

  return { edgeId: closestId, distance: closestDist };
}

/**
 * 마우스 좌표가 어떤 페이지 프레임 내부에 있는지 확인한다.
 *
 * 해당 PageFrame의 id를 반환하며, 겹치는 경우 첫 번째 일치를 반환.
 * 어디에도 해당하지 않으면 null.
 *
 * @param mouseX 씬-로컬 X 좌표
 * @param mouseY 씬-로컬 Y 좌표
 * @param pageFrameMap 페이지 ID → PageFrame 매핑
 */
export function hitTestPageFrame(
  mouseX: number,
  mouseY: number,
  pageFrameMap: Map<string, PageFrame>,
): string | null {
  for (const [pageId, frame] of pageFrameMap) {
    if (
      mouseX >= frame.x &&
      mouseX <= frame.x + frame.width &&
      mouseY >= frame.y &&
      mouseY <= frame.y + frame.height
    ) {
      return pageId;
    }
  }

  return null;
}
