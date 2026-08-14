/**
 * SpatialIndex TypeScript 래퍼
 *
 * Rust WASM SpatialIndex를 감싸서 string UUID 인터페이스를 제공한다.
 * 내부적으로 idMapper를 통해 u32 ↔ string 변환을 수행한다.
 *
 * @see docs/RENDERING_ARCHITECTURE.md §1.3 TypeScript 바인딩
 */

import { idMapper } from "./idMapper";
import {
  getCompositionEngineWasm,
  type RawSpatialIndex,
} from "./compositionEngineWasm";

const SPATIAL_CELL_SIZE = 256;

let spatialIndex: RawSpatialIndex | null = null;
/** 마지막 full snapshot에 포함되어 SpatialIndex에 남아 있는 string ID. */
const indexedElementIds = new Set<string>();

/**
 * SpatialIndex 인스턴스 초기화. initCompositionEngineWasm() 호출 후에 사용.
 *
 * ADR-916 SpatialIndex crate 분리(2026-07-05): SpatialIndex 는 Taffy(composition_wasm)
 * crate 에서 taffy-free 자체 엔진(composition-engine) crate 로 이동됐다. 따라서 로드
 * 소스가 `getRustWasm()`(Taffy pkg) → `getCompositionEngineWasm()`(자체 엔진 pkg)로
 * 변경됨. `USE_RUST_LAYOUT_ENGINE`(UNIFIED_ENGINE override 로 항상 true)이 활성이라
 * composition-engine pkg 는 항상 startup 로드된다.
 */
export function initSpatialIndex(): void {
  if (spatialIndex) return;

  const wasm = getCompositionEngineWasm();
  if (!wasm) {
    console.warn("[SpatialIndex] composition-engine WASM 미초기화, 생성 스킵");
    return;
  }

  spatialIndex = new wasm.SpatialIndex(SPATIAL_CELL_SIZE);
}

/** 요소 삽입/갱신 (씬 좌표) */
export function updateElement(
  stringId: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  if (!spatialIndex) return;
  const numId = idMapper.getNumericId(stringId);
  spatialIndex.upsert(numId, x, y, w, h);
  if (w > 0 && h > 0) {
    indexedElementIds.add(stringId);
  } else {
    indexedElementIds.delete(stringId);
  }
}

/**
 * full snapshot 배치 삽입/갱신.
 *
 * 다음 snapshot에서 사라진 ID는 upsert만으로 제거되지 않으므로, 이전 snapshot과
 * 비교해 먼저 WASM index와 UUID mapper에서 제거한다. renderCommands의 clip 교차 결과가
 * 줄어드는 프레임(요소 삭제/클립 아웃)도 stale hit entry를 남기지 않는다.
 */
export function batchUpdate(
  elements: Array<{ id: string; x: number; y: number; w: number; h: number }>,
): void {
  if (!spatialIndex) return;

  const activeElements = elements.filter(
    (element) => element.w > 0 && element.h > 0,
  );
  const nextIndexedElementIds = new Set(
    activeElements.map((element) => element.id),
  );
  for (const previousId of indexedElementIds) {
    if (!nextIndexedElementIds.has(previousId)) {
      removeElement(previousId);
    }
  }
  indexedElementIds.clear();
  for (const nextId of nextIndexedElementIds) {
    indexedElementIds.add(nextId);
  }

  if (activeElements.length === 0) return;

  const data = new Float32Array(activeElements.length * 5);
  for (let i = 0; i < activeElements.length; i++) {
    const el = activeElements[i];
    const offset = i * 5;
    data[offset] = idMapper.getNumericId(el.id);
    data[offset + 1] = el.x;
    data[offset + 2] = el.y;
    data[offset + 3] = el.w;
    data[offset + 4] = el.h;
  }

  spatialIndex.batch_upsert(data);
}

/**
 * 뷰포트 내 가시 요소 쿼리 (씬 좌표).
 * useViewportCulling에서 사용.
 */
export function queryVisibleElements(
  left: number,
  top: number,
  right: number,
  bottom: number,
): string[] {
  if (!spatialIndex) return [];

  const numIds = spatialIndex.query_viewport(left, top, right, bottom);
  return uint32ArrayToStringIds(numIds);
}

/**
 * 사각형 영역 내 요소 쿼리 (씬 좌표).
 * 라쏘 선택에서 사용.
 */
export function queryRect(
  left: number,
  top: number,
  right: number,
  bottom: number,
): string[] {
  if (!spatialIndex) return [];

  const numIds = spatialIndex.query_rect(left, top, right, bottom);
  return uint32ArrayToStringIds(numIds);
}

/**
 * 포인트 히트 테스트 (씬 좌표).
 */
export function hitTestPoint(x: number, y: number): string[] {
  if (!spatialIndex) return [];

  const numIds = spatialIndex.query_point(x, y);
  return uint32ArrayToStringIds(numIds);
}

/** 요소 제거 */
export function removeElement(stringId: string): void {
  indexedElementIds.delete(stringId);
  if (!spatialIndex) return;

  const numId = idMapper.tryGetNumericId(stringId);
  if (numId !== undefined) {
    spatialIndex.remove(numId);
    idMapper.remove(stringId);
  }
}

/** 전체 초기화 (페이지 전환 등) */
export function clearAll(): void {
  indexedElementIds.clear();
  if (spatialIndex) {
    spatialIndex.clear();
  }
  idMapper.clear();
}

/** SpatialIndex 인스턴스 접근 (디버그/테스트용) */
export function getSpatialIndex(): RawSpatialIndex | null {
  return spatialIndex;
}

/** u32 배열 → string ID 배열 변환 */
function uint32ArrayToStringIds(numIds: Uint32Array): string[] {
  const result: string[] = [];
  for (let i = 0; i < numIds.length; i++) {
    const str = idMapper.getStringId(numIds[i]);
    if (str !== undefined) {
      result.push(str);
    }
  }
  return result;
}
