/**
 * Size Mode Resolver — ADR-026 Phase 1
 *
 * Size Mode(Fixed/Fill/Hug) ↔ CSS 속성 양방향 변환.
 * 내부 mode key `"fit"` 과 CSS `fit-content` 는 저장 하위호환을 위해 유지한다.
 * 부모 display 컨텍스트에 따라 다른 CSS를 생성하며,
 * 기존 CSS 값에서 모드를 역추론하여 UI에 표시.
 */

// ============================================================================
// Types
// ============================================================================

export type SizeMode = "fixed" | "fill" | "fit";

export type ParentDisplay =
  | "flex"
  | "grid"
  | "block"
  | "inline-flex"
  | "inline-grid";

interface SizeModeCSS {
  /** 설정할 CSS 속성 (key: 값) */
  set: Record<string, string>;
  /** 제거할 CSS 속성 키 */
  remove: string[];
}

// ============================================================================
// Inference — CSS → Size Mode 역추론
// ============================================================================

/**
 * 요소의 CSS 값에서 Size Mode를 역추론.
 *
 * @param style - 요소의 인라인 스타일
 * @param axis - 'width' | 'height'
 * @param parentDisplay - 부모의 display 값
 * @param parentFlexDirection - 부모가 flex일 때의 direction
 */
export function inferSizeMode(
  style: Record<string, unknown> | undefined,
  axis: "width" | "height",
  parentDisplay: string,
  parentFlexDirection?: string,
): SizeMode {
  if (!style) return "fit";

  const value = style[axis];
  const strValue = value !== undefined && value !== null ? String(value) : "";

  // Fill 판별: 부모 컨텍스트에 따라 다른 CSS 패턴
  if (isFillCSS(style, axis, strValue, parentDisplay, parentFlexDirection)) {
    return "fill";
  }

  // Hug 판별: auto, fit-content, 빈 값
  if (isFitCSS(strValue)) {
    return "fit";
  }

  // Fixed 판별: 구체적인 값이 있는 경우 (px, %, rem 등)
  if (strValue !== "") {
    return "fixed";
  }

  return "fit";
}

function isFillCSS(
  style: Record<string, unknown>,
  axis: "width" | "height",
  value: string,
  parentDisplay: string,
  parentFlexDirection?: string,
): boolean {
  const isFlexParent =
    parentDisplay === "flex" || parentDisplay === "inline-flex";
  const isGridParent =
    parentDisplay === "grid" || parentDisplay === "inline-grid";

  if (axis === "width") {
    // Block 부모에서 width: 100%
    if (value === "100%") return true;

    // Flex row 부모에서 flex-grow: 1 (main axis)
    if (isFlexParent && parentFlexDirection !== "column") {
      const flexGrow = String(style.flexGrow ?? "");
      if (flexGrow === "1") return true;
    }

    // Flex column 부모에서 align-self: stretch (cross axis)
    if (isFlexParent && parentFlexDirection === "column") {
      const alignSelf = String(style.alignSelf ?? "");
      if (alignSelf === "stretch") return true;
    }

    // Grid 부모에서 justify-self: stretch
    if (isGridParent) {
      const justifySelf = String(style.justifySelf ?? "");
      if (justifySelf === "stretch") return true;
    }
  }

  if (axis === "height") {
    if (value === "100%") return true;

    // Flex column 부모에서 flex-grow: 1 (main axis)
    if (isFlexParent && parentFlexDirection === "column") {
      const flexGrow = String(style.flexGrow ?? "");
      if (flexGrow === "1") return true;
    }

    // Flex row 부모에서 align-self: stretch (cross axis)
    if (isFlexParent && parentFlexDirection !== "column") {
      const alignSelf = String(style.alignSelf ?? "");
      if (alignSelf === "stretch") return true;
    }

    // Grid 부모에서 align-self: stretch
    if (isGridParent) {
      const alignSelf = String(style.alignSelf ?? "");
      if (alignSelf === "stretch") return true;
    }
  }

  return false;
}

function isFitCSS(value: string): boolean {
  if (value === "" || value === "auto" || value === "fit-content") return true;
  return false;
}

// ============================================================================
// Resolution — Size Mode → CSS 변환
// ============================================================================

/**
 * Size Mode를 CSS 속성으로 변환.
 *
 * @param mode - 선택된 Size Mode
 * @param axis - 'width' | 'height'
 * @param parentDisplay - 부모의 display 값
 * @param parentFlexDirection - 부모가 flex일 때의 direction
 * @param currentValue - 현재 값 (Fixed 모드에서 유지)
 */
export function resolveSizeMode(
  mode: SizeMode,
  axis: "width" | "height",
  parentDisplay: string,
  parentFlexDirection?: string,
  currentValue?: string,
  fixedFallbackValue?: string,
): SizeModeCSS {
  switch (mode) {
    case "fixed":
      return resolveFixed(
        axis,
        parentDisplay,
        parentFlexDirection,
        currentValue,
        fixedFallbackValue,
      );
    case "fill":
      return resolveFill(axis, parentDisplay, parentFlexDirection);
    case "fit":
      return resolveFit(axis, parentDisplay, parentFlexDirection);
    default:
      return { set: {}, remove: [] };
  }
}

function resolveFixed(
  axis: "width" | "height",
  parentDisplay: string,
  parentFlexDirection?: string,
  currentValue?: string,
  fixedFallbackValue?: string,
): SizeModeCSS {
  const isReusableFixedValue = (value: string | undefined): value is string =>
    !!value && value !== "auto" && value !== "fit-content" && value !== "100%";
  const value = isReusableFixedValue(currentValue)
    ? currentValue
    : isReusableFixedValue(fixedFallbackValue)
      ? fixedFallbackValue
      : axis === "width"
        ? "200px"
        : "100px";

  return {
    set: { [axis]: value },
    remove: resolveAxisFillProps(axis, parentDisplay, parentFlexDirection),
  };
}

function resolveAxisFillProps(
  axis: "width" | "height",
  parentDisplay: string,
  parentFlexDirection?: string,
): string[] {
  const isFlexParent =
    parentDisplay === "flex" || parentDisplay === "inline-flex";
  const isGridParent =
    parentDisplay === "grid" || parentDisplay === "inline-grid";
  const isMainAxis =
    (axis === "width" && parentFlexDirection !== "column") ||
    (axis === "height" && parentFlexDirection === "column");

  if (isFlexParent) {
    return isMainAxis ? ["flexGrow", "flexShrink", "flexBasis"] : ["alignSelf"];
  }
  if (isGridParent) {
    return axis === "width" ? ["justifySelf"] : ["alignSelf"];
  }
  return [];
}

function resolveFill(
  axis: "width" | "height",
  parentDisplay: string,
  parentFlexDirection?: string,
): SizeModeCSS {
  const isFlexParent =
    parentDisplay === "flex" || parentDisplay === "inline-flex";
  const isGridParent =
    parentDisplay === "grid" || parentDisplay === "inline-grid";
  const isMainAxis =
    (axis === "width" && parentFlexDirection !== "column") ||
    (axis === "height" && parentFlexDirection === "column");

  if (isFlexParent && isMainAxis) {
    // Flex main axis: flex-grow: 1, flex-basis: 0
    return {
      set: {
        flexGrow: "1",
        flexShrink: "1",
        flexBasis: "0%",
      },
      remove: [axis],
    };
  }

  if (isFlexParent && !isMainAxis) {
    // Flex cross axis: align-self: stretch
    return {
      set: { alignSelf: "stretch" },
      remove: [axis],
    };
  }

  if (isGridParent) {
    if (axis === "width") {
      return {
        set: { justifySelf: "stretch" },
        remove: ["width"],
      };
    }
    return {
      set: { alignSelf: "stretch" },
      remove: ["height"],
    };
  }

  // Block 부모: width: 100%
  return {
    set: { [axis]: "100%" },
    remove:
      axis === "width"
        ? ["flexGrow", "flexShrink", "flexBasis", "justifySelf"]
        : ["alignSelf"],
  };
}

function resolveFit(
  axis: "width" | "height",
  parentDisplay: string,
  parentFlexDirection?: string,
): SizeModeCSS {
  return {
    set: { [axis]: "fit-content" },
    remove: resolveAxisFillProps(axis, parentDisplay, parentFlexDirection),
  };
}

// ============================================================================
// Helper
// ============================================================================

/**
 * SizeModeCSS를 updateSelectedStyles용 Record로 변환.
 * remove 키는 빈 문자열로 설정 (store에서 delete 처리).
 */
export function sizeModeToStyleUpdates(
  result: SizeModeCSS,
): Record<string, string> {
  const updates: Record<string, string> = { ...result.set };
  for (const key of result.remove) {
    updates[key] = "";
  }
  return updates;
}
