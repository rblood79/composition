import React, { useCallback, useEffect, useRef, useState } from "react";

import type { Key } from "react-aria-components/Collection";

import type { Selection } from "react-aria-components/ListBox";

import {
  TagGroupProps as AriaTagGroupProps,
  TagListProps,
} from "react-aria-components/TagGroup";

import { Text } from "react-aria-components/Text";

import { flushSync } from "react-dom";

// chip leading icon glyph — DOM 아이콘은 프로젝트 관례상 고정 크기(14px), Skia 는
//   Tag rule `sizes[*].iconSize`(전 size 14)로 같은 값을 쓴다.
import type {
  ColumnMapping,
  DataBinding,
  DataBindingValue,
  TagItemTemplate,
} from "../types";

export interface TagGroupProps<T>
  extends
    Omit<AriaTagGroupProps, "children">,
    Pick<TagListProps<T>, "items" | "children" | "renderEmptyState"> {
  /** ADR-256 Phase 5d: the catalog's Label · Description · error part node elements, else text. */
  label?: React.ReactNode;
  description?: React.ReactNode;
  errorMessage?: React.ReactNode;
  allowsRemoving?: boolean;
  onRemove?: (keys: Selection) => void;
  // 선택 관련 프로퍼티 추가
  selectionMode?: "none" | "single" | "multiple";
  selectionBehavior?: "toggle" | "replace";
  selectedKeys?: "all" | Iterable<Key>;
  defaultSelectedKeys?: "all" | Iterable<Key>;
  onSelectionChange?: (keys: Selection) => void;
  // 비활성화 관련 프로퍼티 추가
  isDisabled?: boolean;
  // orientation 제거 (2026-07-01): RAC/RSP TagGroup 에 없는 non-standard prop (D2 위반).
  //   chip 배치는 항상 row+wrap, 그룹↔라벨 배치는 RSP 표준 labelPosition 이 담당.
  disallowEmptySelection?: boolean;
  // 데이터 바인딩
  dataBinding?: DataBinding | DataBindingValue;
  columnMapping?: ColumnMapping;
  // 제거된 항목 추적 (columnMapping 모드에서 동적 데이터 항목 제거용)
  removedItemIds?: string[];
  // Tag 스타일 제어
  variant?: string;
  size?: "S" | "M" | "L";
  /**
   * React Aria 1.13.0: 커스텀 필터 함수
   * @example filter={(item) => item.status === 'active'}
   */
  filter?: (item: T) => boolean;
  /**
   * Limit the number of rows initially shown.
   * Renders a button that allows the user to expand to show all tags.
   * @example maxRows={2}
   */
  maxRows?: number;
  labelPosition?: "top" | "side";
  /**
   * React Aria 1.13.0: 텍스트 기반 필터링
   * @example filterText="search query"
   */
  filterText?: string;
  /**
   * React Aria 1.13.0: 필터링 대상 필드 목록
   * @default ['label', 'name', 'title']
   */
  filterFields?: (keyof T)[];
  /**
   * ADR-229 Phase 1 — chip item template (Components 페이지 `component-tag-item-*` origin).
   * 렌더러 (`renderTagGroup`) 가 renderContext 에서 넘기는 wrapper 내부 계약 — canonical prop 아님
   * (D2 무관). chip inline style (base + selected overlay) · leading slot 존재 gating · slot 크기.
   */
  itemTemplate?: TagItemTemplate | null;
  /**
   * ADR-234 Phase 3 — 작성자가 채운 목록: TagList 의 Tag instance 자식을 **이미 RAC Tag 인** 노드로 받는다
   * (catalog 경로는 renderCatalogDom 가 상태 층 render props 를 실은 RAC Tag). `text` 는 maxRows
   * 미러 측정용 글자. 있으면 `items` · `children` 보다 우선.
   */
  staticItems?: ReadonlyArray<{
    node: React.ReactNode;
    text: string;
    /** The item's RAC key (ADR-256 Phase 5d: a removed item leaves the list). */
    id?: Key;
  }>;
}

/** The reference's error text (`Text[slot=errorMessage]`); a catalog part element as it is. */
export function renderTagGroupError(
  errorMessage: React.ReactNode,
): React.ReactNode {
  if (!errorMessage) return null;
  if (React.isValidElement(errorMessage)) return errorMessage;
  return <Text slot="errorMessage">{errorMessage}</Text>;
}

/**
 * maxRows (S2 패턴): 숨겨진 미러 DOM 에서 행을 세고 실제 목록은 앞에서 자른다. 미러는 항상 전체 태그를
 * 그린다 (상태 무관) → 무한 루프 방지. `wrapperRef` = 실제 chip 배치 상자 (`.tag-list-wrapper`).
 */
export interface TagRowsState {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  visibleTagCount: number;
  setVisibleTagCount: (count: number) => void;
}

/** The collapse state of a maxRows list (held above RAC's TagGroup — see `useTagMaxRows`). */
export function useTagRowsState(): TagRowsState {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [visibleTagCount, setVisibleTagCount] = useState<number>(Infinity);
  return { isCollapsed, setIsCollapsed, visibleTagCount, setVisibleTagCount };
}

/**
 * `shared`: the state of a list RAC also renders a copy of (its collection is built from a hidden
 * `<template>` render of the TagGroup's children — a copy with its own state would keep every tag);
 * only the copy with layout measures.
 */
export function useTagMaxRows(
  maxRows: number | undefined,
  shared?: TagRowsState,
  /**
   * The measured chips (their texts): a change counts the rows again — a tag added to an open
   * list, removed or relabelled (2026-10-09 — a fifth tag stayed behind Show all).
   */
  itemsKey?: string,
) {
  const own = useTagRowsState();
  const { isCollapsed, setIsCollapsed, visibleTagCount, setVisibleTagCount } =
    shared ?? own;
  const hiddenRef = useRef<HTMLDivElement>(null);
  // 실제 chip 배치 컨테이너(.tag-list-wrapper) — 미러 측정 폭 동기화용.
  //   **Why (side-label maxRows 접힘 과다 버그, 2026-07-02)**: 미러 DOM 은 `<AriaTagGroup>` 밖의
  //   형제(position:relative 최상위 div 자식, width:100%)라 side-label 의 좁아진 폭(Label 차감)을
  //   못 받는다. side 에서 실제 wrapper 는 flex-direction:row 로 Label 옆 남은 폭(전체−Label−gap)에서
  //   chip 을 wrap 하나, 미러는 전체 폭으로 측정 → 행당 chip 과다 → visibleTagCount 과다 →
  //   실제 배치에서 maxRows 초과(라이브: 미러 348 → 10칩 2줄에 8개, 실제 wrapper 276 → 그 8개가 3줄).
  //   측정 직전에 실제 wrapper clientWidth 를 미러 width 에 주입해 폭을 일치시킨다.
  const tagListWrapperRef = useRef<HTMLDivElement>(null);
  const hasMaxRows = maxRows != null && maxRows > 0;
  const showCollapsed = hasMaxRows && isCollapsed;

  const computeVisibleTagCount = useCallback(() => {
    if (!hiddenRef.current || !maxRows) return;
    // (RAC's hidden collection copy — inside a `<template>`, no layout — does not measure.)
    if (hiddenRef.current.closest("template")) return;
    // 미러 폭을 실제 chip 배치 컨테이너 폭과 동기화 (side-label Label 차감 폭 반영).
    //   실제 wrapper 가 아직 없으면(측정 초기) width:100% fallback 유지.
    const actualWidth = tagListWrapperRef.current?.clientWidth;
    if (actualWidth != null && actualWidth > 0) {
      hiddenRef.current.style.width = `${actualWidth}px`;
    }
    const items = hiddenRef.current.children;
    if (items.length === 0) return;

    let currY = -Infinity;
    let rowCount = 0;
    let index = 0;
    for (let i = 0; i < items.length; i++) {
      const { y } = items[i].getBoundingClientRect();
      if (y !== currY) {
        currY = y;
        rowCount++;
      }
      if (rowCount > maxRows) break;
      index++;
    }

    flushSync(() => {
      setVisibleTagCount(index);
    });
  }, [maxRows, setVisibleTagCount]);

  // 초기 측정 + 컬렉션 변경 시 재측정 (`itemsKey` — 미러 chip 이 바뀌면)
  useEffect(() => {
    if (hasMaxRows && isCollapsed) {
      // microtask로 DOM 렌더 완료 후 측정
      queueMicrotask(computeVisibleTagCount);
    }
  }, [hasMaxRows, isCollapsed, computeVisibleTagCount, itemsKey]);

  // ResizeObserver: 컨테이너 크기 변경 시 재측정
  //   최상위 relative div(미러 부모) + 실제 chip 배치 컨테이너(.tag-list-wrapper) 양쪽 관찰.
  //   **Why wrapper 도 관찰**: side-label 에서 실제 wrap 폭 = 전체 − Label − gap 이라 Label 텍스트
  //   변경 시 relative div(고정) 는 안 바뀌어도 wrapper 폭은 바뀐다. 미러 측정 폭 동기화(위
  //   computeVisibleTagCount)가 wrapper clientWidth 를 읽으므로, wrapper resize 도 재측정 trigger.
  useEffect(() => {
    if (!hasMaxRows || !hiddenRef.current) return;
    const parentEl = hiddenRef.current.parentElement;
    const wrapperEl = tagListWrapperRef.current;
    if (!parentEl && !wrapperEl) return;
    const observer = new ResizeObserver(() => {
      if (isCollapsed) computeVisibleTagCount();
    });
    if (parentEl) observer.observe(parentEl);
    if (wrapperEl) observer.observe(wrapperEl);
    return () => observer.disconnect();
  }, [hasMaxRows, isCollapsed, computeVisibleTagCount]);

  useEffect(() => {
    queueMicrotask(() => {
      setIsCollapsed(true);
      setVisibleTagCount(Infinity);
    });
  }, [maxRows, setIsCollapsed, setVisibleTagCount]);

  return {
    hiddenRef,
    wrapperRef: tagListWrapperRef,
    hasMaxRows,
    isCollapsed,
    setIsCollapsed,
    showCollapsed,
    visibleTagCount,
  };
}
