/**
 * useStyleActions - 스타일 업데이트 액션 훅
 *
 * Builder Store의 updateSelectedStyle, updateSelectedStyles를 래핑하여 제공
 *
 * ⚠️ 최적화: 모든 액션은 getState()를 사용하여 구독하지 않음
 * Action 함수는 변경되지 않으므로 리렌더링 유발할 필요 없음
 *
 * 🚀 Single Source of Truth: useInspectorState 제거, Builder Store 직접 사용
 */

import { useCallback } from "react";
import { useStore } from "../../../stores";
import { useCopyPaste } from "@/builder/hooks";
import {
  isFillDerivedStyleProp,
  sanitizeFillDerivedStylePatch,
} from "../utils/fillDerivedStyleProps";
import {
  resolveDirectionDrivenProp,
  flexDirectionToDrivenValue,
} from "../utils/orientationDrivenTags";
import { resolveStyleSpecType } from "./useElementStyleContext";

/** Direction 토글이 style 경로에서 쓰는 display 값 — 사용자가 따로 고른 grid 등은 남긴다. */
const DIRECTION_TOGGLE_DISPLAYS = new Set(["flex", "block"]);

/** Direction 토글이 보내는 값 — 그 밖 (빈 선택) 은 쓰지 않는다. */
const DIRECTION_VALUES = new Set(["block", "row", "column"]);

/**
 * 그룹 축 prop 컨테이너의 인라인에 Direction 토글이 남긴 `flexDirection` · `display` 가 있으면
 * 그 둘을 뺀 style 을, 없으면 null 을 준다.
 */
function withoutStaleDirectionStyle(
  style: unknown,
): Record<string, unknown> | null {
  if (!style || typeof style !== "object") return null;
  const current = style as Record<string, unknown>;
  const staleDisplay =
    typeof current.display === "string" &&
    DIRECTION_TOGGLE_DISPLAYS.has(current.display);
  if (current.flexDirection === undefined && !staleDisplay) return null;
  const next = { ...current };
  delete next.flexDirection;
  if (staleDisplay) delete next.display;
  return next;
}

export function useStyleActions() {
  // onPaste 는 getState() 만 쓰므로 안정 참조로 고정한다. 렌더마다 새 클로저를
  // 넘기면 useCopyPaste 의 `paste` 가 렌더마다 바뀌고, 그 소비자
  // (CanvasSelectionShortcutsHost) 의 useCallback 이 이전 렌더 클로저를 memo 로
  // 붙잡는 V8 shared-context 사슬의 한 링크가 된다 (2026-09-02 leak 실측 —
  // scripts/perf-baseline.mjs `edit` 시리즈, mutation 당 elements view 1개 영구 보유).
  const onPasteStyles = useCallback((data: Record<string, unknown>) => {
    // Convert all values to strings
    const stylesObj: Record<string, string> = {};
    Object.entries(data).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        stylesObj[key] = String(value);
      }
    });
    useStore
      .getState()
      .updateSelectedStyles(sanitizeFillDerivedStylePatch(stylesObj, true));
  }, []);

  // 🔥 최적화: useCopyPaste hook 사용
  const { copy: copyStylesInternal, paste: pasteStylesInternal } = useCopyPaste(
    {
      onPaste: onPasteStyles,
      name: "styles",
    },
  );

  /**
   * 단일 스타일 속성 업데이트
   */
  const updateStyle = useCallback((property: string, value: string) => {
    if (isFillDerivedStyleProp(property)) {
      return;
    }
    useStore.getState().updateSelectedStyle(property, value);
  }, []);

  /**
   * 여러 스타일 속성 일괄 업데이트
   */
  const updateStyles = useCallback((styles: Record<string, string>) => {
    useStore
      .getState()
      .updateSelectedStyles(sanitizeFillDerivedStylePatch(styles, true));
  }, []);

  /**
   * Vertical alignment 버튼 선택 핸들러
   */
  const handleVerticalAlignment = useCallback((value: string) => {
    const alignItemsMap: Record<string, string> = {
      "align-vertical-start": "flex-start",
      "align-vertical-center": "center",
      "align-vertical-end": "flex-end",
    };

    useStore.getState().updateSelectedStyles({
      display: "flex",
      alignItems: alignItemsMap[value] || "flex-start",
    });
  }, []);

  /**
   * Horizontal alignment 버튼 선택 핸들러
   */
  const handleHorizontalAlignment = useCallback((value: string) => {
    const justifyContentMap: Record<string, string> = {
      "align-horizontal-start": "flex-start",
      "align-horizontal-center": "center",
      "align-horizontal-end": "flex-end",
    };

    useStore.getState().updateSelectedStyles({
      display: "flex",
      justifyContent: justifyContentMap[value] || "flex-start",
    });
  }, []);

  /**
   * Flex direction 버튼 선택 핸들러
   * - 'block': display: block (flex 속성 제거)
   * - 'row': display: flex + flex-direction: row
   * - 'column': display: flex + flex-direction: column
   *
   * 그룹 축 prop derive 컨테이너 특례: 그룹 root flexDirection 의 SSOT 가
   * style.flexDirection 이 아니라 별도 layout prop (orientation: ToggleButtonGroup
   * /Toolbar, labelPosition: RadioGroup/CheckboxGroup) 이라 렌더 derive 경로가
   * inline style.flexDirection 을 무시한다. direction 토글 편집을 style 에 쓰면
   * 화면 반영조차 안 됨 → 해당 prop 으로 번역해 단일 SSOT 에 직접 기록(이중 저장
   * 아님). 매핑: orientation column→vertical/row→horizontal, labelPosition
   * column→top/row→side. block 은 모델에 없어 패널에서 disable 되므로 여기로
   * 도달하지 않지만, 방어적으로 row 쪽 흡수. 대상 정본: orientationDrivenTags.
   */
  const handleFlexDirection = useCallback((value: string) => {
    // 선택된 버튼을 다시 누르면 토글 그룹이 빈 선택 (undefined) 을 준다 — prop 번역은 column 외를
    //   side / horizontal 로 흡수하므로 여기서 걸러야 top 이 side 로 뒤집히지 않는다.
    if (!DIRECTION_VALUES.has(value)) return;
    const { selectedElementId, elementsMap } = useStore.getState();
    const selected = selectedElementId
      ? elementsMap.get(selectedElementId)
      : undefined;
    const drivenProp = resolveDirectionDrivenProp(
      resolveStyleSpecType(selected, elementsMap),
    );
    if (drivenProp) {
      const drivenValue = flexDirectionToDrivenValue(drivenProp, value);
      const staleStyle = withoutStaleDirectionStyle(selected?.props?.style);
      if (staleStyle) {
        // 이 토글이 prop 번역 전에 (ref instance 판정 누락 · 멤버십 밖) 쓴 인라인이 남아 있으면
        // DOM 에서 인라인이 variant 를 이긴다 — prop 과 같은 쓰기에서 지운다.
        useStore
          .getState()
          .updateSelectedProperties({
            [drivenProp]: drivenValue,
            style: staleStyle,
          });
        return;
      }
      useStore.getState().updateSelectedProperty(drivenProp, drivenValue);
      return;
    }
    if (value === "block") {
      // display: block으로 전환, flex 관련 속성 제거
      useStore.getState().updateSelectedStyles({
        display: "block",
        flexDirection: "",
        justifyContent: "",
        alignItems: "",
        flexWrap: "",
        gap: "",
      });
    } else if (value === "row") {
      useStore.getState().updateSelectedStyles({
        display: "flex",
        flexDirection: "row",
      });
    } else if (value === "column") {
      useStore.getState().updateSelectedStyles({
        display: "flex",
        flexDirection: "column",
      });
    }
  }, []);

  /**
   * Flex alignment (3x3 grid) 버튼 선택 핸들러
   */
  const handleFlexAlignment = useCallback(
    (
      value: string,
      currentFlexDirection: string,
      options?: { preserveMainAxis?: boolean },
    ) => {
      // Map button position to horizontal and vertical alignment values
      const positionMap: Record<
        string,
        { horizontal: string; vertical: string }
      > = {
        leftTop: { horizontal: "flex-start", vertical: "flex-start" },
        centerTop: { horizontal: "center", vertical: "flex-start" },
        rightTop: { horizontal: "flex-end", vertical: "flex-start" },
        leftCenter: { horizontal: "flex-start", vertical: "center" },
        centerCenter: { horizontal: "center", vertical: "center" },
        rightCenter: { horizontal: "flex-end", vertical: "center" },
        leftBottom: { horizontal: "flex-start", vertical: "flex-end" },
        centerBottom: { horizontal: "center", vertical: "flex-end" },
        rightBottom: { horizontal: "flex-end", vertical: "flex-end" },
      };

      const position = positionMap[value];
      if (position) {
        const flexDirection =
          currentFlexDirection === "column" ? "column" : "row";

        // For row: horizontal = justifyContent, vertical = alignItems
        // For column: horizontal = alignItems, vertical = justifyContent
        // preserveMainAxis (Space 분산 중): 교차축 alignItems 만 쓰고 justifyContent 는
        //   space-* 그대로 둔다 (panel-ui 01).
        const preserveMainAxis = options?.preserveMainAxis === true;
        if (flexDirection === "column") {
          useStore.getState().updateSelectedStyles({
            display: "flex",
            flexDirection,
            ...(preserveMainAxis ? {} : { justifyContent: position.vertical }),
            alignItems: position.horizontal,
          });
        } else {
          // row or default
          useStore.getState().updateSelectedStyles({
            display: "flex",
            flexDirection,
            ...(preserveMainAxis
              ? {}
              : { justifyContent: position.horizontal }),
            alignItems: position.vertical,
          });
        }
      }
    },
    [],
  );

  /**
   * Justify content spacing 버튼 선택 핸들러
   */
  const handleJustifyContentSpacing = useCallback((value: string) => {
    useStore.getState().updateSelectedStyles({
      display: "flex",
      justifyContent: value, // space-around, space-between, space-evenly
    });
  }, []);

  /**
   * Flex wrap 버튼 선택 핸들러
   */
  const handleFlexWrap = useCallback((value: string) => {
    useStore.getState().updateSelectedStyles({
      display: "flex",
      flexWrap: value, // wrap, wrap-reverse, nowrap
    });
  }, []);

  /**
   * Reset styles (inline style 제거)
   */
  const resetStyles = useCallback((properties: string[]) => {
    const resetObj: Record<string, string> = {};
    properties.forEach((prop) => (resetObj[prop] = ""));
    useStore
      .getState()
      .updateSelectedStyles(sanitizeFillDerivedStylePatch(resetObj, true));
  }, []);

  /**
   * Copy styles to clipboard (wrapper around useCopyPaste)
   */
  const copyStyles = useCallback(
    async (styles: Record<string, unknown>) => copyStylesInternal(styles),
    [copyStylesInternal],
  );

  /**
   * Paste styles from clipboard (wrapper around useCopyPaste)
   */
  const pasteStyles = useCallback(
    async () => pasteStylesInternal(),
    [pasteStylesInternal],
  );

  return {
    // 기본 액션
    updateStyle,
    updateStyles,
    resetStyles,
    copyStyles,
    pasteStyles,

    // 특수 핸들러
    handleVerticalAlignment,
    handleHorizontalAlignment,
    handleFlexDirection,
    handleFlexAlignment,
    handleJustifyContentSpacing,
    handleFlexWrap,
  };
}
