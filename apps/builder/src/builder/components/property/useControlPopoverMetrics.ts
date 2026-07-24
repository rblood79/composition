/**
 * useControlPopoverMetrics
 *
 * 프로퍼티/스타일 패널의 Select·ComboBox 팝오버가 **control 외곽 박스
 * (`.react-aria-Group`)** 와 같은 폭·좌측 정렬로 뜨게 하는 공통 측정 훅.
 *
 * **Why**: RAC Popover 는 기본적으로 trigger 버튼 기준(`--trigger-width`)으로 뜬다.
 * 그런데 패널의 field 는 `.react-aria-control.react-aria-Group` 이 padding(+ 선택적
 * `control-label` 아이콘 컬럼) 을 가진 회색 박스라, trigger 기준으로 두면 팝오버가
 * field 박스보다 좁고 안쪽으로 밀려 뜬다. 패널 전체에서 드롭다운 좌측 모서리가
 * 제각각이 되는 원인.
 *
 * 그래서 `PropertySelect` / `PropertyUnitInput` 은 group ↔ control 의 실측 rect 로
 * `width / min-width / margin-left` 를 직접 계산해 왔는데, 동일 로직이 컴포넌트마다
 * 복제되면서 `PropertyDataBinding` 처럼 복제를 빠뜨린 곳이 패널 규약에서 이탈했다
 * (컬렉션 선택 팝오버가 field 박스보다 28px 좁고 24px 안쪽으로 뜨던 문제).
 * 본 훅이 그 계산의 단일 소스다.
 *
 * 사용:
 * ```tsx
 * const { anchorRef, controlRef, popoverStyle } = useControlPopoverMetrics();
 * <div className="react-aria-control react-aria-Group" ref={anchorRef}>
 *   <AriaSelect ref={controlRef}>
 *     <Popover className="react-aria-Popover property-select-popover" style={popoverStyle} />
 * ```
 *
 * `anchorRef` 를 붙일 수 없는 경우(예: group 을 `PropertyFieldset` 이 렌더) 생략하면
 * `controlRef` 의 `closest(".react-aria-Group")` 로 자동 해석한다.
 */

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";

/** 팝오버 폭 산출 방식 */
export type PopoverWidthMode =
  /** anchor 폭으로 고정 */
  | "width"
  /** 내용 폭 + anchor 폭을 최소값으로 (기본) */
  | "fit-content"
  /** 내용 폭 자유 + anchor 폭을 최소값으로 */
  | "min-width";

/** anchor 로 해석할 control 외곽 박스 선택자 */
const ANCHOR_SELECTOR = ".react-aria-Group";

export interface ControlPopoverMetricsOptions {
  widthMode?: PopoverWidthMode;
}

export interface ControlPopoverMetrics {
  /** control 외곽 박스(`.react-aria-Group`). 생략 시 controlRef 에서 closest 로 해석 */
  anchorRef: (node: HTMLElement | null) => void;
  /** Select / ComboBox 루트 */
  controlRef: (node: HTMLElement | null) => void;
  /** `<Popover style={...}>` 에 그대로 전달 */
  popoverStyle: CSSProperties;
}

export function useControlPopoverMetrics({
  widthMode = "fit-content",
}: ControlPopoverMetricsOptions = {}): ControlPopoverMetrics {
  // ref 대신 state 로 element 를 잡는다 — 조건부 렌더되는 control (예: collection 이
  // 비동기 로드된 뒤에야 마운트되는 PropertyDataBinding 의 Select) 도 마운트 시점에
  // 측정 effect 가 다시 돌아야 하기 때문. object ref 였다면 최초 effect 가 null 로
  // 돌고 끝나 metrics 가 0 으로 고정된다.
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [controlEl, setControlEl] = useState<HTMLElement | null>(null);
  const [metrics, setMetrics] = useState({ width: 0, offset: 0 });

  const anchorRef = useCallback((node: HTMLElement | null) => {
    setAnchorEl(node);
  }, []);

  const controlRef = useCallback((node: HTMLElement | null) => {
    setControlEl(node);
  }, []);

  useEffect(() => {
    if (!controlEl) return;

    const resolvedAnchor =
      anchorEl ?? controlEl.closest<HTMLElement>(ANCHOR_SELECTOR);

    if (!resolvedAnchor) return;

    const updatePopoverMetrics = () => {
      const anchorRect = resolvedAnchor.getBoundingClientRect();
      const controlRect = controlEl.getBoundingClientRect();
      const nextMetrics = {
        width: Math.round(anchorRect.width),
        offset: Math.round(anchorRect.left - controlRect.left),
      };

      setMetrics((prev) =>
        prev.width === nextMetrics.width && prev.offset === nextMetrics.offset
          ? prev
          : nextMetrics,
      );
    };

    updatePopoverMetrics();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updatePopoverMetrics);

      return () => {
        window.removeEventListener("resize", updatePopoverMetrics);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      updatePopoverMetrics();
    });

    resizeObserver.observe(resolvedAnchor);
    resizeObserver.observe(controlEl);
    window.addEventListener("resize", updatePopoverMetrics);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updatePopoverMetrics);
    };
  }, [anchorEl, controlEl]);

  const hasWidth = metrics.width > 0;

  const popoverStyle: CSSProperties = {
    width:
      widthMode === "width" && hasWidth
        ? `${metrics.width}px`
        : widthMode === "fit-content"
          ? "max-content"
          : undefined,
    minWidth:
      (widthMode === "fit-content" || widthMode === "min-width") && hasWidth
        ? `${metrics.width}px`
        : undefined,
    marginLeft: metrics.offset !== 0 ? `${metrics.offset}px` : undefined,
  };

  return { anchorRef, controlRef, popoverStyle };
}
