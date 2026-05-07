/**
 * Element Diff Utility
 *
 * 🎯 목적: 메모리 효율적인 히스토리 시스템을 위한 Diff 생성/적용
 *
 * 성능 비교:
 * - Before: 전체 요소 스냅샷 저장 → 요소당 ~2-5KB
 * - After: 변경된 props만 저장 → 변경당 ~100-500 bytes
 *
 * @since 2025-12-10 Phase 3 History Diff System
 */

import type {
  Element,
  ComponentElementProps,
} from "../../../types/core/store.types";

/**
 * Props Diff 타입
 * - 변경된 props 키와 이전/이후 값만 저장
 */
export interface PropsDiff {
  /** 변경된 속성들 (key → { prev, next }) */
  changed: Map<string, { prev: unknown; next: unknown }>;
  /** 추가된 속성들 (key → value) */
  added: Map<string, unknown>;
  /** 삭제된 속성들 (key → previousValue) */
  removed: Map<string, unknown>;
}

/**
 * Element Diff 타입
 * - 요소의 변경사항만 저장
 */
export interface ElementDiff {
  elementId: string;
  /** Props 변경사항 */
  props?: PropsDiff;
  /** parent_id 변경 */
  parentId?: { prev: string | null; next: string | null };
  /** 메타데이터 변경 */
  metadata?: {
    customId?: { prev: string | undefined; next: string | undefined };
    events?: { prev: unknown; next: unknown };
    dataBinding?: { prev: unknown; next: unknown };
  };
}

/**
 * 직렬화 가능한 Diff 타입 (JSON 저장용)
 */
export interface SerializablePropsDiff {
  changed: Array<[string, { prev: unknown; next: unknown }]>;
  added: Array<[string, unknown]>;
  removed: Array<[string, unknown]>;
}

export interface SerializableElementDiff {
  elementId: string;
  props?: SerializablePropsDiff;
  parentId?: { prev: string | null; next: string | null };
  metadata?: {
    customId?: { prev: string | undefined; next: string | undefined };
    events?: { prev: unknown; next: unknown };
    dataBinding?: { prev: unknown; next: unknown };
  };
}

/**
 * 빈 Props Diff 생성
 */
export function createEmptyPropsDiff(): PropsDiff {
  return {
    changed: new Map(),
    added: new Map(),
    removed: new Map(),
  };
}

/**
 * 두 값이 동일한지 깊은 비교
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;

  if (typeof a === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;

    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);

    if (aKeys.length !== bKeys.length) return false;

    for (const key of aKeys) {
      if (!deepEqual(aObj[key], bObj[key])) return false;
    }
    return true;
  }

  return false;
}

/**
 * 두 Props 객체 간의 Diff 계산
 *
 * @param prevProps 이전 props
 * @param nextProps 다음 props
 * @returns Props Diff
 */
export function createPropsDiff(
  prevProps: ComponentElementProps,
  nextProps: ComponentElementProps,
): PropsDiff {
  const diff = createEmptyPropsDiff();

  // 🔧 타입 안전한 인덱싱을 위해 Record로 캐스팅
  const prev = prevProps as Record<string, unknown>;
  const next = nextProps as Record<string, unknown>;

  // 이전 props 검사 (삭제 또는 변경)
  for (const key of Object.keys(prev)) {
    const prevValue = prev[key];
    const nextValue = next[key];

    if (!(key in next)) {
      // 삭제된 속성
      diff.removed.set(key, prevValue);
    } else if (!deepEqual(prevValue, nextValue)) {
      // 변경된 속성
      diff.changed.set(key, { prev: prevValue, next: nextValue });
    }
  }

  // 다음 props 검사 (추가)
  for (const key of Object.keys(next)) {
    if (!(key in prev)) {
      // 추가된 속성
      diff.added.set(key, next[key]);
    }
  }

  return diff;
}

/**
 * 두 Element 간의 Diff 계산
 *
 * @param prevElement 이전 요소
 * @param nextElement 다음 요소
 * @returns Element Diff
 */
export function createElementDiff(
  prevElement: Element,
  nextElement: Element,
): ElementDiff {
  const diff: ElementDiff = {
    elementId: prevElement.id,
  };

  // Props diff
  const propsDiff = createPropsDiff(
    prevElement.props as ComponentElementProps,
    nextElement.props as ComponentElementProps,
  );
  if (
    propsDiff.changed.size > 0 ||
    propsDiff.added.size > 0 ||
    propsDiff.removed.size > 0
  ) {
    diff.props = propsDiff;
  }

  // parent_id 변경
  if (prevElement.parent_id !== nextElement.parent_id) {
    diff.parentId = {
      prev: prevElement.parent_id || null,
      next: nextElement.parent_id || null,
    };
  }

  // metadata 변경
  const metadataChanges: ElementDiff["metadata"] = {};

  if (prevElement.customId !== nextElement.customId) {
    metadataChanges.customId = {
      prev: prevElement.customId,
      next: nextElement.customId,
    };
  }

  if (!deepEqual(prevElement.events, nextElement.events)) {
    metadataChanges.events = {
      prev: prevElement.events,
      next: nextElement.events,
    };
  }

  if (!deepEqual(prevElement.dataBinding, nextElement.dataBinding)) {
    metadataChanges.dataBinding = {
      prev: prevElement.dataBinding,
      next: nextElement.dataBinding,
    };
  }

  if (Object.keys(metadataChanges).length > 0) {
    diff.metadata = metadataChanges;
  }

  return diff;
}

/**
 * Diff를 적용하여 이전 상태로 복원 (Undo)
 *
 * @param element 현재 요소
 * @param diff 적용할 diff
 * @returns 복원된 요소
 */
export function applyDiffUndo(element: Element, diff: ElementDiff): Element {
  const restored: Element = { ...element };

  // Props 복원
  if (diff.props) {
    // 🔧 타입 안전한 인덱싱을 위해 Record로 캐스팅
    const restoredProps = { ...element.props } as Record<string, unknown>;

    // 변경된 속성 → 이전 값으로
    for (const [key, { prev }] of diff.props.changed) {
      restoredProps[key] = prev;
    }

    // 추가된 속성 → 삭제
    for (const key of diff.props.added.keys()) {
      delete restoredProps[key];
    }

    // 삭제된 속성 → 복원
    for (const [key, value] of diff.props.removed) {
      restoredProps[key] = value;
    }

    restored.props = restoredProps as ComponentElementProps;
  }

  // parent_id 복원
  if (diff.parentId) {
    restored.parent_id = diff.parentId.prev;
  }

  // metadata 복원
  if (diff.metadata) {
    if (diff.metadata.customId) {
      restored.customId = diff.metadata.customId.prev;
    }
    if (diff.metadata.events) {
      restored.events = diff.metadata.events.prev as Element["events"];
    }
    if (diff.metadata.dataBinding) {
      restored.dataBinding = diff.metadata.dataBinding
        .prev as Element["dataBinding"];
    }
  }

  return restored;
}

/**
 * Diff를 적용하여 다음 상태로 진행 (Redo)
 *
 * @param element 현재 요소
 * @param diff 적용할 diff
 * @returns 진행된 요소
 */
export function applyDiffRedo(element: Element, diff: ElementDiff): Element {
  const updated: Element = { ...element };

  // Props 업데이트
  if (diff.props) {
    // 🔧 타입 안전한 인덱싱을 위해 Record로 캐스팅
    const updatedProps = { ...element.props } as Record<string, unknown>;

    // 변경된 속성 → 다음 값으로
    for (const [key, { next }] of diff.props.changed) {
      updatedProps[key] = next;
    }

    // 추가된 속성 → 추가
    for (const [key, value] of diff.props.added) {
      updatedProps[key] = value;
    }

    // 삭제된 속성 → 삭제
    for (const key of diff.props.removed.keys()) {
      delete updatedProps[key];
    }

    updated.props = updatedProps as ComponentElementProps;
  }

  // parent_id 업데이트
  if (diff.parentId) {
    updated.parent_id = diff.parentId.next;
  }

  // metadata 업데이트
  if (diff.metadata) {
    if (diff.metadata.customId) {
      updated.customId = diff.metadata.customId.next;
    }
    if (diff.metadata.events) {
      updated.events = diff.metadata.events.next as Element["events"];
    }
    if (diff.metadata.dataBinding) {
      updated.dataBinding = diff.metadata.dataBinding
        .next as Element["dataBinding"];
    }
  }

  return updated;
}

/**
 * Diff가 비어있는지 확인
 */
export function isDiffEmpty(diff: ElementDiff): boolean {
  const hasPropsChanges =
    diff.props &&
    (diff.props.changed.size > 0 ||
      diff.props.added.size > 0 ||
      diff.props.removed.size > 0);

  return !hasPropsChanges && !diff.parentId && !diff.metadata;
}

/**
 * Diff를 직렬화 가능한 형태로 변환
 */
export function serializeDiff(diff: ElementDiff): SerializableElementDiff {
  const serialized: SerializableElementDiff = {
    elementId: diff.elementId,
  };

  if (diff.props) {
    serialized.props = {
      changed: Array.from(diff.props.changed.entries()),
      added: Array.from(diff.props.added.entries()),
      removed: Array.from(diff.props.removed.entries()),
    };
  }

  if (diff.parentId) {
    serialized.parentId = diff.parentId;
  }

  if (diff.metadata) {
    serialized.metadata = diff.metadata;
  }

  return serialized;
}

/**
 * 직렬화된 Diff를 원래 형태로 복원
 */
export function deserializeDiff(
  serialized: SerializableElementDiff,
): ElementDiff {
  const diff: ElementDiff = {
    elementId: serialized.elementId,
  };

  if (serialized.props) {
    diff.props = {
      changed: new Map(serialized.props.changed),
      added: new Map(serialized.props.added),
      removed: new Map(serialized.props.removed),
    };
  }

  if (serialized.parentId) {
    diff.parentId = serialized.parentId;
  }

  if (serialized.metadata) {
    diff.metadata = serialized.metadata;
  }

  return diff;
}

/**
 * Diff의 메모리 크기 추정 (바이트)
 */
export function estimateDiffSize(diff: ElementDiff): number {
  let size = 0;

  // elementId
  size += diff.elementId.length * 2;

  // props diff
  if (diff.props) {
    for (const [key, { prev, next }] of diff.props.changed) {
      size += key.length * 2;
      size += estimateValueSize(prev);
      size += estimateValueSize(next);
    }
    for (const [key, value] of diff.props.added) {
      size += key.length * 2;
      size += estimateValueSize(value);
    }
    for (const [key, value] of diff.props.removed) {
      size += key.length * 2;
      size += estimateValueSize(value);
    }
  }

  // parentId
  if (diff.parentId) size += 100;

  // metadata
  if (diff.metadata) size += 500;

  return size;
}

/**
 * 값의 메모리 크기 추정
 */
function estimateValueSize(value: unknown): number {
  if (value === null || value === undefined) return 8;
  if (typeof value === "string") return value.length * 2;
  if (typeof value === "number") return 8;
  if (typeof value === "boolean") return 4;
  if (typeof value === "object") {
    try {
      return JSON.stringify(value).length * 2;
    } catch {
      return 1000;
    }
  }
  return 100;
}

/**
 * 여러 요소의 Batch Diff 계산
 */
export function createBatchDiff(
  prevElements: Element[],
  nextElements: Element[],
): ElementDiff[] {
  const diffs: ElementDiff[] = [];

  const prevMap = new Map(prevElements.map((el) => [el.id, el]));
  const nextMap = new Map(nextElements.map((el) => [el.id, el]));

  // 변경된 요소 추적
  for (const [id, nextEl] of nextMap) {
    const prevEl = prevMap.get(id);
    if (prevEl) {
      const diff = createElementDiff(prevEl, nextEl);
      if (!isDiffEmpty(diff)) {
        diffs.push(diff);
      }
    }
  }

  return diffs;
}

/**
 * Batch Diff 적용 (Undo)
 */
export function applyBatchDiffUndo(
  elements: Element[],
  diffs: ElementDiff[],
): Element[] {
  const elementsMap = new Map(elements.map((el) => [el.id, el]));

  for (const diff of diffs) {
    const element = elementsMap.get(diff.elementId);
    if (element) {
      const restored = applyDiffUndo(element, diff);
      elementsMap.set(diff.elementId, restored);
    }
  }

  return Array.from(elementsMap.values());
}

/**
 * Batch Diff 적용 (Redo)
 */
export function applyBatchDiffRedo(
  elements: Element[],
  diffs: ElementDiff[],
): Element[] {
  const elementsMap = new Map(elements.map((el) => [el.id, el]));

  for (const diff of diffs) {
    const element = elementsMap.get(diff.elementId);
    if (element) {
      const updated = applyDiffRedo(element, diff);
      elementsMap.set(diff.elementId, updated);
    }
  }

  return Array.from(elementsMap.values());
}
