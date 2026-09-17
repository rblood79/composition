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

    // Flex row 부모에서 flex-grow > 0 (main axis) — `2fr` 같은 비율도 Fill
    if (isFlexParent && parentFlexDirection !== "column") {
      if (parseGrow(style.flexGrow) !== null) return true;
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

    // Flex column 부모에서 flex-grow > 0 (main axis)
    if (isFlexParent && parentFlexDirection === "column") {
      if (parseGrow(style.flexGrow) !== null) return true;
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

/** flexGrow 값 → 양수 grow 계수. 0 · 음수 · 비숫자는 null (Fill 아님). */
function parseGrow(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * `Nfr` 입력 → grow 계수 (Framer 어법 — Fill 의 비율). `fill` 은 grow 1 의 표기이고,
 * 형제 간 2:1 이 필요할 때만 `2fr` 을 친다. 0 이하는 Fill 이 아니므로 null.
 */
export function parseFrValue(value: string): number | null {
  const m = value.trim().match(/^(\d+(?:\.\d+)?)fr$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 ? n : null;
}

/**
 * Fill 상태의 grow 계수 — flex 부모의 **주축**에서만 의미가 있다 (교차축 stretch · grid ·
 * block `100%` 는 비율이 없으므로 null). Fill 이 아니면 null.
 */
export function inferFillGrow(
  style: Record<string, unknown> | undefined,
  axis: "width" | "height",
  parentDisplay: string,
  parentFlexDirection?: string,
): number | null {
  if (!style) return null;
  const isFlexParent =
    parentDisplay === "flex" || parentDisplay === "inline-flex";
  const isMainAxis =
    (axis === "width" && parentFlexDirection !== "column") ||
    (axis === "height" && parentFlexDirection === "column");
  if (!isFlexParent || !isMainAxis) return null;
  return parseGrow(style.flexGrow);
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
 * @param fillGrow - Fill 의 grow 계수 (`2fr` → 2). flex 주축에서만 쓰이고 기본 1.
 */
export function resolveSizeMode(
  mode: SizeMode,
  axis: "width" | "height",
  parentDisplay: string,
  parentFlexDirection?: string,
  currentValue?: string,
  fixedFallbackValue?: string,
  fillGrow?: number,
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
      return resolveFill(axis, parentDisplay, parentFlexDirection, fillGrow);
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
  fillGrow?: number,
): SizeModeCSS {
  const isFlexParent =
    parentDisplay === "flex" || parentDisplay === "inline-flex";
  const isGridParent =
    parentDisplay === "grid" || parentDisplay === "inline-grid";
  const isMainAxis =
    (axis === "width" && parentFlexDirection !== "column") ||
    (axis === "height" && parentFlexDirection === "column");

  if (isFlexParent && isMainAxis) {
    // Flex main axis: flex-grow: N (기본 1 = `fill`, `Nfr` 은 비율), flex-basis: 0
    const grow =
      fillGrow !== undefined && Number.isFinite(fillGrow) && fillGrow > 0
        ? fillGrow
        : 1;
    return {
      set: {
        flexGrow: String(grow),
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
