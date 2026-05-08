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

export function useStyleActions() {
  // 🔥 최적화: useCopyPaste hook 사용
  const { copy: copyStylesInternal, paste: pasteStylesInternal } = useCopyPaste(
    {
      onPaste: (data) => {
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
      },
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
   */
  const handleFlexDirection = useCallback((value: string) => {
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
    (value: string, currentFlexDirection: string) => {
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
        if (flexDirection === "column") {
          useStore.getState().updateSelectedStyles({
            display: "flex",
            flexDirection,
            justifyContent: position.vertical,
            alignItems: position.horizontal,
          });
        } else {
          // row or default
          useStore.getState().updateSelectedStyles({
            display: "flex",
            flexDirection,
            justifyContent: position.horizontal,
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
