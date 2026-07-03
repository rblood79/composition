/**
 * ADR-916 Phase 1-D — Dual-run diff 하네스
 *
 * 두 `LayoutEngineAPI` 인스턴스(reference = 현행 Taffy, candidate = 자체
 * composition-engine)에 **동일 batch 입력**을 먹이고, `getLayoutsBatch()` 결과를
 * elementId 기준으로 diff 한다. flex.rs 등 자체 엔진의 CSS 명세 결함(R1 HIGH)을
 * 이관 전 구간에서 잡는 유일한 검증 경로다.
 *
 * ## 판정 기준 (ADR-916 HC3 2단)
 *
 * - **(a) 수치 diff ≤ 1px** — f32 sub-pixel tolerance. 엔진 간 부동소수점 drift 허용.
 * - **(b) 1x zoom device pixel diff 0** — 수치 drift 가 동일 device pixel 로
 *   라운딩되는 범위만 허용. `(a) 통과 + (b) 위반` 시 **(b) 가 우선** → FAIL
 *   (예: 0.2px drift 가 픽셀 경계를 넘어 round 결과가 갈리는 경우).
 *
 * ## 사용
 *
 * ```ts
 * const result = runDualLayout(batch, rootId, { availableWidth, availableHeight },
 *   new TaffyLayout(), new compositionLayout());
 * if (!result.pass) reportViolations(result);
 * ```
 *
 * candidate 엔진이 아직 없으면 self-diff(동일 엔진 두 인스턴스 → diff 0)로
 * 하네스 자체의 정확성을 확증한다.
 */

import type { PersistentBatchNode } from "./persistentTaffyTree";
import type { LayoutEngineAPI } from "../../wasm-bindings/layoutBridge";
import type { LayoutResult } from "../../wasm-bindings/taffyLayout";

/** HC3 수치 tolerance — f32 sub-pixel drift 허용 폭 (px). */
export const NUMERIC_TOLERANCE_PX = 1;

/** LayoutResult 의 비교 대상 필드. */
const LAYOUT_FIELDS = ["x", "y", "width", "height"] as const;
type LayoutField = (typeof LAYOUT_FIELDS)[number];

/** 단일 필드의 수치 위반 (|delta| > 1px). */
export interface NumericViolation {
  elementId: string;
  field: LayoutField;
  reference: number;
  candidate: number;
  /** candidate - reference (부호 유지). */
  delta: number;
}

/** 단일 필드의 device-pixel 위반 (round(ref) !== round(cand)). */
export interface PixelViolation {
  elementId: string;
  field: LayoutField;
  referencePx: number;
  candidatePx: number;
}

/** dual-run 1회 결과. */
export interface DualRunResult {
  /** HC3 2단 통과 여부 = 수치 위반 0 && pixel 위반 0. */
  pass: boolean;
  numericViolations: NumericViolation[];
  pixelViolations: PixelViolation[];
  /** 비교한 노드 수 (양 엔진 공통). */
  nodeCount: number;
}

export interface AvailableSpace {
  availableWidth: number;
  availableHeight: number;
}

/**
 * 1x zoom device pixel 라운딩. CSS pixel → device pixel 매핑은 정수 반올림.
 * (HC3 (b) 는 dpr=1 기준 — 스크린샷 diff 0 의 수치 근사.)
 */
function toDevicePixel(v: number): number {
  return Math.round(v);
}

/**
 * 두 layout Map 을 elementId 기준으로 diff 한다.
 *
 * handle 값은 엔진마다 독립 발급되므로 handle 직접 비교 금지 —
 * `handleToId` 로 elementId 를 복원해 매칭한다. reference 에만 있거나
 * candidate 에만 있는 노드는 구조 불일치로 간주해 각 필드를 위반 처리하지 않고
 * (비교 불가) nodeCount 에서 제외한다. 구조 불일치는 상위 호출자가
 * nodeCount 로 감지한다.
 */
export function diffLayoutMaps(
  reference: Map<number, LayoutResult>,
  candidate: Map<number, LayoutResult>,
  handleToId: Map<number, string>,
  refHandleToId?: Map<number, string>,
): {
  numericViolations: NumericViolation[];
  pixelViolations: PixelViolation[];
  nodeCount: number;
} {
  const numericViolations: NumericViolation[] = [];
  const pixelViolations: PixelViolation[] = [];

  // reference 는 별도 handleToId 를 가질 수 있다 (엔진별 handle 독립).
  // 미지정 시 candidate 와 동일 매핑을 공유한다고 가정 (self-diff 케이스).
  const refIdMap = refHandleToId ?? handleToId;

  // elementId → LayoutResult 로 정규화
  const refById = new Map<string, LayoutResult>();
  for (const [handle, layout] of reference) {
    const id = refIdMap.get(handle);
    if (id !== undefined) refById.set(id, layout);
  }
  const candById = new Map<string, LayoutResult>();
  for (const [handle, layout] of candidate) {
    const id = handleToId.get(handle);
    if (id !== undefined) candById.set(id, layout);
  }

  let nodeCount = 0;
  for (const [id, refLayout] of refById) {
    const candLayout = candById.get(id);
    if (candLayout === undefined) continue; // 구조 불일치 — nodeCount 제외
    nodeCount++;

    for (const field of LAYOUT_FIELDS) {
      const refVal = refLayout[field];
      const candVal = candLayout[field];
      const delta = candVal - refVal;

      // (a) 수치 tolerance
      if (Math.abs(delta) > NUMERIC_TOLERANCE_PX) {
        numericViolations.push({
          elementId: id,
          field,
          reference: refVal,
          candidate: candVal,
          delta,
        });
      }

      // (b) device pixel round — (a) 통과 여부와 독립 평가 (HC3: (b) 우선)
      const refPx = toDevicePixel(refVal);
      const candPx = toDevicePixel(candVal);
      if (refPx !== candPx) {
        pixelViolations.push({
          elementId: id,
          field,
          referencePx: refPx,
          candidatePx: candPx,
        });
      }
    }
  }

  return { numericViolations, pixelViolations, nodeCount };
}

/**
 * 단일 엔진에 batch 를 먹여 layout Map 과 handle→elementId 매핑을 얻는다.
 *
 * PersistentTaffyTree.buildFull 과 동일 순서 (buildTreeBatch → computeLayout →
 * getLayoutsBatch) 를 최소 재현한다. batch 는 post-order (root 가 마지막) 이므로
 * root handle 은 반환 배열의 마지막 원소다.
 */
function runSingleEngine(
  batch: PersistentBatchNode[],
  space: AvailableSpace,
  engine: LayoutEngineAPI,
): { layouts: Map<number, LayoutResult>; handleToId: Map<number, string> } {
  const nodesJson = JSON.stringify(
    batch.map((n) => ({ style: n.style, children: n.children })),
  );
  const handles = engine.buildTreeBatch(nodesJson);

  const handleToId = new Map<number, string>();
  handles.forEach((h, i) => handleToId.set(h, batch[i].elementId));

  const rootHandle = handles[handles.length - 1];
  engine.computeLayout(rootHandle, space.availableWidth, space.availableHeight);

  const layouts = engine.getLayoutsBatch(handles);
  return { layouts, handleToId };
}

/**
 * reference / candidate 두 엔진에 동일 batch 를 먹이고 HC3 2단 diff 한다.
 *
 * @param batch     post-order PersistentBatchNode 배열 (root 마지막)
 * @param rootId    root elementId (진단용 라벨 — 매칭엔 미사용)
 * @param space     available width/height
 * @param reference 기준 엔진 (현행 Taffy)
 * @param candidate 후보 엔진 (자체 composition-engine; self-diff 시 동일 종류)
 */
export function runDualLayout(
  batch: PersistentBatchNode[],
  rootId: string,
  space: AvailableSpace,
  reference: LayoutEngineAPI,
  candidate: LayoutEngineAPI,
): DualRunResult {
  void rootId; // 현재 diff 는 전 노드 elementId 매칭 — root 라벨은 리포트용 예약
  const ref = runSingleEngine(batch, space, reference);
  const cand = runSingleEngine(batch, space, candidate);

  const { numericViolations, pixelViolations, nodeCount } = diffLayoutMaps(
    ref.layouts,
    cand.layouts,
    cand.handleToId,
    ref.handleToId,
  );

  return {
    pass: numericViolations.length === 0 && pixelViolations.length === 0,
    numericViolations,
    pixelViolations,
    nodeCount,
  };
}

/**
 * 위반을 사람이 읽을 수 있는 리포트 문자열로 포맷한다.
 * (CI/로그 출력용 — 하네스 자체는 순수 함수, side-effect 없음.)
 */
export function formatViolations(result: DualRunResult): string {
  if (result.pass) {
    return `dual-run PASS — ${result.nodeCount} nodes, 0 violations`;
  }
  const lines: string[] = [
    `dual-run FAIL — ${result.nodeCount} nodes`,
    `  numeric (>${NUMERIC_TOLERANCE_PX}px): ${result.numericViolations.length}`,
  ];
  for (const v of result.numericViolations) {
    lines.push(
      `    ${v.elementId}.${v.field}: ref=${v.reference} cand=${v.candidate} Δ=${v.delta.toFixed(3)}`,
    );
  }
  lines.push(`  pixel (device px): ${result.pixelViolations.length}`);
  for (const v of result.pixelViolations) {
    lines.push(
      `    ${v.elementId}.${v.field}: ref=${v.referencePx}px cand=${v.candidatePx}px`,
    );
  }
  return lines.join("\n");
}
