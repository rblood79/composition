/**
 * SpatialIndex TypeScript 래퍼
 *
 * Rust WASM SpatialIndex를 감싸서 string UUID 인터페이스를 제공한다.
 * 내부적으로 idMapper를 통해 u32 ↔ string 변환을 수행한다.
 *
 * @see docs/RENDERING_ARCHITECTURE.md §1.3 TypeScript 바인딩
 */

import { idMapper } from "./idMapper";
import { getEngineWasm, type RawSpatialIndex } from "./engineWasm";
import type { PageSpace } from "../skia/pageSpace";
import { registerCounterSource, renderCounters } from "../skia/renderCounters";

const SPATIAL_CELL_SIZE = 256;

/**
 * 2026-11-22: one grid per page (`pageSpace.ts`). An element is stored page-local — relative to
 * its page's origin offset — so a page frame that moves (the page above it grew) changes the
 * offset the queries read, not every element's cells. `""` = elements without a page (offset 0).
 */
interface Group {
  readonly index: RawSpatialIndex;
  /** Local extent of everything inserted since the last clear (grows only — a query hint). */
  extent: { left: number; top: number; right: number; bottom: number } | null;
}

let spatialIndex: RawSpatialIndex | null = null;
const groups = new Map<string, Group>();
/** element → the group its cells are in. */
const elementGroup = new Map<string, string>();
/** The page offsets of the stream the index was last synced with (`batchUpdate`). */
let space: PageSpace | null = null;
/** 마지막 full snapshot에 포함되어 SpatialIndex에 남아 있는 string ID. */
const indexedElementIds = new Set<string>();
/** Rect queries made (one per call, whatever the number of page grids it reads). */
let rectQueries = 0;

/**
 * SpatialIndex 인스턴스 초기화. initEngineWasm() 호출 후에 사용.
 *
 * ADR-916 SpatialIndex crate 분리(2026-07-05): SpatialIndex 는 Taffy(composition_wasm)
 * crate 에서 taffy-free 자체 엔진(engine) crate 로 이동됐다. 따라서 로드
 * 소스가 `getRustWasm()`(Taffy pkg) → `getEngineWasm()`(자체 엔진 pkg)로
 * 변경됨. `USE_RUST_LAYOUT_ENGINE` 이 상수 `true` 선언이라 engine pkg 는
 * 항상 startup 로드된다. (구 서술의 "UNIFIED_ENGINE override 로 항상 true" 는
 * `isUnifiedFlag` 의 단락 평가를 가리켰는데, 그 단락 평가는 2026-08-15 에 제거됐다.)
 */
export function initSpatialIndex(): void {
  if (spatialIndex) return;

  const wasm = getEngineWasm();
  if (!wasm) {
    console.warn("[SpatialIndex] engine WASM 미초기화, 생성 스킵");
    return;
  }

  spatialIndex = new wasm.SpatialIndex(SPATIAL_CELL_SIZE);
  groups.set("", { index: spatialIndex, extent: null });
  if (process.env.NODE_ENV === "development")
    registerCounterSource(drainSpatialStats);
}

/** ADR-272 Phase 0 — Rust 질의 · 갱신 작업량을 render 카운터로 옮긴다 (하니스 snapshot · reset 때). */
function drainSpatialStats(): void {
  // 산출물이 getter 이전 것이면 (wasm 재빌드 전) 세지 않는다.
  if (typeof spatialIndex?.take_query_stat !== "function") return;
  renderCounters.spatialQueries += rectQueries;
  rectQueries = 0;
  for (const { index } of groups.values()) {
    index.take_query_stat(0);
    renderCounters.spatialCellsVisited += index.take_query_stat(1);
    renderCounters.spatialItemsVisited += index.take_query_stat(2);
    renderCounters.spatialResults += index.take_query_stat(3);
    renderCounters.spatialUpsertCells += index.take_query_stat(4);
  }
}

const groupKeyOf = (id: string) => space?.pageOf(id) ?? "";
const offsetOfGroup = (key: string) =>
  key ? space?.offsetOfPage(key) : undefined;

function groupFor(key: string): Group | null {
  const existing = groups.get(key);
  if (existing) return existing;
  const wasm = getEngineWasm();
  if (!wasm) return null;
  const group: Group = {
    index: new wasm.SpatialIndex(SPATIAL_CELL_SIZE),
    extent: null,
  };
  groups.set(key, group);
  return group;
}

function grow(group: Group, x: number, y: number, w: number, h: number) {
  const e = group.extent;
  group.extent = e
    ? {
        left: Math.min(e.left, x),
        top: Math.min(e.top, y),
        right: Math.max(e.right, x + w),
        bottom: Math.max(e.bottom, y + h),
      }
    : { left: x, top: y, right: x + w, bottom: y + h };
}

/** 요소 삽입/갱신 (씬 좌표 — 그 요소 page 의 원점 기준으로 저장한다). */
export function updateElement(
  stringId: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  if (!spatialIndex) return;
  const numId = idMapper.getNumericId(stringId);
  const key = groupKeyOf(stringId);
  const before = elementGroup.get(stringId);
  if (before !== undefined && before !== key)
    groups.get(before)?.index.remove(numId);
  const group = groupFor(key);
  if (!group) return;
  const offset = offsetOfGroup(key);
  const lx = x - (offset?.x ?? 0);
  const ly = y - (offset?.y ?? 0);
  group.index.upsert(numId, lx, ly, w, h);
  if (w > 0 && h > 0) {
    grow(group, lx, ly, w, h);
    elementGroup.set(stringId, key);
    indexedElementIds.add(stringId);
  } else {
    elementGroup.delete(stringId);
    indexedElementIds.delete(stringId);
  }
}

/**
 * full snapshot 배치 삽입/갱신 (씬 좌표 · `pages` = 그 stream 의 page 표 — 이후 질의가 그 원점을 읽는다).
 *
 * 다음 snapshot에서 사라진 ID는 upsert만으로 제거되지 않으므로, 이전 snapshot과
 * 비교해 먼저 WASM index와 UUID mapper에서 제거한다. renderCommands의 clip 교차 결과가
 * 줄어드는 프레임(요소 삭제/클립 아웃)도 stale hit entry를 남기지 않는다.
 */
export function batchUpdate(
  elements: Array<{ id: string; x: number; y: number; w: number; h: number }>,
  pages?: PageSpace,
): void {
  if (!spatialIndex) return;
  if (pages) space = pages;

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
  // A full snapshot places every element again: the page grids start empty.
  drainSpatialStatsIfDev();
  for (const [key, group] of groups) {
    if (key) {
      group.index.free();
      groups.delete(key);
    } else {
      group.index.clear();
      group.extent = null;
    }
  }
  elementGroup.clear();

  if (activeElements.length === 0) return;

  const byGroup = new Map<string, typeof activeElements>();
  for (const element of activeElements) {
    const key = groupKeyOf(element.id);
    const list = byGroup.get(key);
    if (list) list.push(element);
    else byGroup.set(key, [element]);
  }
  for (const [key, list] of byGroup) {
    const group = groupFor(key);
    if (!group) continue;
    const offset = offsetOfGroup(key);
    const ox = offset?.x ?? 0;
    const oy = offset?.y ?? 0;
    const data = new Float32Array(list.length * 5);
    for (let i = 0; i < list.length; i++) {
      const el = list[i];
      const at = i * 5;
      data[at] = idMapper.getNumericId(el.id);
      data[at + 1] = el.x - ox;
      data[at + 2] = el.y - oy;
      data[at + 3] = el.w;
      data[at + 4] = el.h;
      grow(group, el.x - ox, el.y - oy, el.w, el.h);
      elementGroup.set(el.id, key);
    }
    group.index.batch_upsert(data);
  }
}

/** A freed page grid's counts would be lost: carry them over first (dev harness only). */
function drainSpatialStatsIfDev(): void {
  if (process.env.NODE_ENV !== "development") return;
  const queries = rectQueries;
  drainSpatialStats();
  // (`spatialQueries` counts calls, not grids — kept for the next drain.)
  renderCounters.spatialQueries -= queries;
  rectQueries = queries;
}

/** Each page grid's query rect (local), clipped to what the grid holds. */
function queryGroups(
  left: number,
  top: number,
  right: number,
  bottom: number,
  query: (
    index: RawSpatialIndex,
    l: number,
    t: number,
    r: number,
    b: number,
  ) => Uint32Array,
): string[] {
  rectQueries += 1;
  const result: string[] = [];
  for (const [key, group] of groups) {
    const e = group.extent;
    if (!e) continue;
    const offset = offsetOfGroup(key);
    const l = Math.max(left - (offset?.x ?? 0), e.left);
    const t = Math.max(top - (offset?.y ?? 0), e.top);
    const r = Math.min(right - (offset?.x ?? 0), e.right);
    const b = Math.min(bottom - (offset?.y ?? 0), e.bottom);
    if (l > r || t > b) continue;
    appendStringIds(result, query(group.index, l, t, r, b));
  }
  return result;
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
  return queryGroups(left, top, right, bottom, (index, l, t, r, b) =>
    index.query_viewport(l, t, r, b),
  );
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
  return queryGroups(left, top, right, bottom, (index, l, t, r, b) =>
    index.query_rect(l, t, r, b),
  );
}

/**
 * 포인트 히트 테스트 (씬 좌표).
 */
export function hitTestPoint(x: number, y: number): string[] {
  if (!spatialIndex) return [];
  const result: string[] = [];
  for (const [key, group] of groups) {
    const e = group.extent;
    if (!e) continue;
    const offset = offsetOfGroup(key);
    const px = x - (offset?.x ?? 0);
    const py = y - (offset?.y ?? 0);
    if (px < e.left || px > e.right || py < e.top || py > e.bottom) continue;
    appendStringIds(result, group.index.query_point(px, py));
  }
  return result;
}

/** 요소 제거 */
export function removeElement(stringId: string): void {
  indexedElementIds.delete(stringId);
  if (!spatialIndex) return;

  const numId = idMapper.tryGetNumericId(stringId);
  if (numId !== undefined) {
    const key = elementGroup.get(stringId);
    if (key !== undefined) groups.get(key)?.index.remove(numId);
    elementGroup.delete(stringId);
    idMapper.remove(stringId);
  }
}

/** 전체 초기화 (페이지 전환 등) */
export function clearAll(): void {
  indexedElementIds.clear();
  elementGroup.clear();
  for (const group of groups.values()) {
    group.index.clear();
    group.extent = null;
  }
  idMapper.clear();
}

/** SpatialIndex 인스턴스 접근 (디버그/테스트용 — 있는지만 본다) */
export function getSpatialIndex(): RawSpatialIndex | null {
  return spatialIndex;
}

/** u32 배열 → string ID 를 `result` 뒤에 */
function appendStringIds(result: string[], numIds: Uint32Array): void {
  for (let i = 0; i < numIds.length; i++) {
    const str = idMapper.getStringId(numIds[i]);
    if (str !== undefined) {
      result.push(str);
    }
  }
}
