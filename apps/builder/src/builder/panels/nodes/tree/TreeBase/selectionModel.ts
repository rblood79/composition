/**
 * 가상화 트리의 클릭 → 선택 해석.
 *
 * `TreeBase` 는 react-aria `Tree` 가 선택을 소유하지만, `VirtualizedTree` 는
 * 접근성을 일부 포기하고 행을 직접 그리므로 클릭 해석도 직접 해야 한다. 두
 * 경로가 같은 규칙을 따르지 않으면 노드 수가 가상화 임계를 넘는 순간 선택
 * 동작이 조용히 바뀐다.
 *
 * 규칙은 RAC `selectionBehavior="replace"` 의 미러다 — 수식어 없는 클릭은 교체,
 * meta/ctrl 은 개별 토글, shift 는 anchor 부터의 구간. anchor 는 "구간의 시작"
 * 이라 shift 중에는 움직이지 않는다.
 */

import type { Key } from "react-stately";

export interface TreeSelectionModifiers {
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
}

export interface VirtualizedSelectionInput {
  /** 직전 구간 선택의 시작점. shift 클릭이 여기서부터 범위를 잡는다. */
  readonly anchorKey: Key | null;
  readonly key: Key;
  readonly modifiers: TreeSelectionModifiers;
  /** 현재 화면에 펼쳐진 행의 표시 순서. shift 구간의 정의역이다. */
  readonly orderedKeys: readonly Key[];
  readonly selectedKeys: ReadonlySet<Key>;
  /** RAC 기본값과 같이 생략 시 `"toggle"`. 레이어 패널은 `"replace"` 를 쓴다. */
  readonly selectionBehavior?: "replace" | "toggle";
  readonly selectionMode: "single" | "multiple" | "none";
}

export interface VirtualizedSelectionResult {
  readonly anchorKey: Key | null;
  readonly keys: Set<Key>;
}

export function resolveVirtualizedSelection(
  input: VirtualizedSelectionInput,
): VirtualizedSelectionResult {
  const {
    anchorKey,
    key,
    modifiers,
    orderedKeys,
    selectedKeys,
    selectionBehavior = "toggle",
    selectionMode,
  } = input;

  if (selectionMode === "none") {
    return { anchorKey, keys: new Set(selectedKeys) };
  }

  const replace = (): VirtualizedSelectionResult => ({
    anchorKey: key,
    keys: new Set<Key>([key]),
  });

  const toggle = (): VirtualizedSelectionResult => {
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return { anchorKey: key, keys: next };
  };

  if (selectionMode === "single") return replace();

  if (modifiers.shiftKey) {
    // anchor 가 접혀서 화면에서 사라졌으면 구간을 정의할 수 없다.
    const anchorIndex =
      anchorKey === null ? -1 : orderedKeys.indexOf(anchorKey);
    const targetIndex = orderedKeys.indexOf(key);
    if (anchorIndex < 0 || targetIndex < 0) return replace();

    const start = Math.min(anchorIndex, targetIndex);
    const end = Math.max(anchorIndex, targetIndex);
    return {
      anchorKey,
      keys: new Set(orderedKeys.slice(start, end + 1)),
    };
  }

  if (modifiers.metaKey || modifiers.ctrlKey) return toggle();

  // `"toggle"` 어법에서는 수식어 없는 클릭도 개별 토글이다 (체크박스 목록).
  if (selectionBehavior === "toggle") return toggle();

  return replace();
}
