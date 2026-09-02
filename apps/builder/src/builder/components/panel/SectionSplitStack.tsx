/**
 * SectionSplitStack - 세로로 쌓인 두 Section 을 드래그 구분선으로 나누는 컨테이너
 *
 * 높이 규칙 (Navigator UX 3단계):
 * - 위 섹션은 "내용 맞춤 + 상한" — 내용 높이까지만 차지하고, 상한을 넘으면 자체 스크롤.
 *   기본 상한은 컨테이너 높이의 비율, 사용자가 드래그한 값은 localStorage 에 저장돼 상한이 된다.
 * - 아래 섹션은 남는 공간 전부 (자체 스크롤).
 * - 어느 한쪽이 접히면 구분선을 숨기고 나머지가 전부 차지한다.
 * - 구분선 더블클릭 = 저장값 삭제 (기본 상한 복귀). Home/End·화살표는 PanelSplitter 가 처리.
 */

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { PanelSplitter } from "../../layout/PanelSplitter";
import {
  isSectionCollapsedInState,
  useSectionCollapse,
} from "../../panels/styles/hooks/useSectionCollapse";
import {
  clampSplitValue,
  readSplitCap,
  resolveSplitLayout,
  writeSplitCap,
} from "./sectionSplitLayout";
import "./SectionSplitStack.css";

function measureHeight(element: HTMLElement | null): number {
  return element ? element.getBoundingClientRect().height : 0;
}

export interface SectionSplitStackProps {
  /** 저장 키 (localStorage) — 컨테이너마다 고유 */
  storageKey: string;
  /** 위 Section 의 `id` (접힘 판정용) */
  topId: string;
  /** 아래 Section 의 `id` */
  bottomId: string;
  top: ReactNode;
  bottom: ReactNode;
  /** 구분선 접근성 라벨 (i18n 은 호출자 책임) */
  label?: string;
  className?: string;
  minTop?: number;
  minBottom?: number;
  defaultRatio?: number;
}

export function SectionSplitStack({
  storageKey,
  topId,
  bottomId,
  top,
  bottom,
  label = "Resize sections",
  className,
  minTop,
  minBottom,
  defaultRatio,
}: SectionSplitStackProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [topVisibleHeight, setTopVisibleHeight] = useState(0);
  const [userCap, setUserCap] = useState<number | null>(() =>
    readSplitCap(storageKey),
  );
  const dragStartRef = useRef(0);
  const capRef = useRef<number | null>(userCap);

  const topCollapsed = useSectionCollapse((s) =>
    isSectionCollapsedInState(s, topId),
  );
  const bottomCollapsed = useSectionCollapse((s) =>
    isSectionCollapsedInState(s, bottomId),
  );

  useLayoutEffect(() => {
    const root = rootRef.current;
    const topPane = topRef.current;
    if (!root || !topPane) return;
    setContainerHeight(measureHeight(root));
    setTopVisibleHeight(measureHeight(topPane));
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        if (entry.target === root) setContainerHeight(height);
        else if (entry.target === topPane) setTopVisibleHeight(height);
      }
    });
    observer.observe(root);
    observer.observe(topPane);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(
    () =>
      resolveSplitLayout({
        containerHeight,
        userCap,
        topCollapsed,
        bottomCollapsed,
        minTop,
        minBottom,
        defaultRatio,
      }),
    [
      bottomCollapsed,
      containerHeight,
      defaultRatio,
      minBottom,
      minTop,
      topCollapsed,
      userCap,
    ],
  );

  // 드래그는 눈에 보이는 높이 (내용 맞춤으로 상한보다 작을 수 있다) 에서 시작한다 —
  // 상한에서 시작하면 내용이 짧을 때 구분선이 한동안 움직이지 않는다.
  const visibleValue = clampSplitValue(
    Math.round(topVisibleHeight || layout.value),
    layout.minValue,
    layout.maxValue,
  );

  const handleResizeStart = useCallback(() => {
    dragStartRef.current = visibleValue;
  }, [visibleValue]);

  const handleResize = useCallback(
    (_deltaX: number, deltaY: number) => {
      const next = clampSplitValue(
        Math.round(dragStartRef.current + deltaY),
        layout.minValue,
        layout.maxValue,
      );
      capRef.current = next;
      setUserCap(next);
    },
    [layout.maxValue, layout.minValue],
  );

  const handleResizeEnd = useCallback(() => {
    writeSplitCap(storageKey, capRef.current);
  }, [storageKey]);

  const handleReset = useCallback(() => {
    capRef.current = null;
    setUserCap(null);
    writeSplitCap(storageKey, null);
  }, [storageKey]);

  const topStyle: CSSProperties | undefined =
    layout.topMaxHeight === null ? undefined : { maxHeight: layout.topMaxHeight };
  const topPaneId = `${storageKey}-top`;

  return (
    <div
      ref={rootRef}
      className={
        className ? `split-stack ${className}` : "split-stack"
      }
      data-user-cap={userCap === null ? "default" : "custom"}
    >
      <div
        ref={topRef}
        id={topPaneId}
        className="split-pane"
        data-split-role="top"
        data-collapsed={topCollapsed ? "true" : "false"}
        style={topStyle}
      >
        {top}
      </div>
      {layout.showDivider && (
        <div className="split-divider" onDoubleClick={handleReset}>
          <PanelSplitter
            edge="bottom"
            label={label}
            controls={topPaneId}
            value={visibleValue}
            minValue={layout.minValue}
            maxValue={layout.maxValue}
            className="split-handle"
            onResizeStart={handleResizeStart}
            onResize={handleResize}
            onResizeEnd={handleResizeEnd}
          />
        </div>
      )}
      <div
        className="split-pane"
        data-split-role="bottom"
        data-collapsed={bottomCollapsed ? "true" : "false"}
      >
        {bottom}
      </div>
    </div>
  );
}
