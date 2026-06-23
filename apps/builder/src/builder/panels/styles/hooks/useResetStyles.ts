/**
 * useResetStyles - 경량 스타일 리셋 훅
 *
 * 🚀 Phase 4.2c: 래퍼 컴포넌트 최적화
 * - 섹션 래퍼 (TransformSection 등)는 resetStyles만 필요
 * - useStyleActions의 useCopyPaste 훅 오버헤드 제거
 * - 안정적인 함수 참조 반환 (useCallback + 빈 deps)
 *
 * 🚀 Body 기본값 보존: Reset 시 컴포넌트 기본값으로 복원
 */

import { useCallback, useMemo } from "react";
import { useStore } from "../../../stores";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import { visitCanonicalDocumentElements } from "../../../stores/canonical/canonicalElementsView";
import { getDefaultProps } from "../../../../types/builder/unified.types";
import {
  resolveAppearanceSpecPreset,
  resolveLayoutSpecPreset,
  resolveSpecPreset,
  resolveTypographySpecPreset,
} from "../utils/specPresetResolver";
import { numToPx, uniform4Way } from "../utils/styleValueHelpers";
import { LAYOUT_PRESETS } from "../../properties/editors/LayoutPresetSelector/presetDefinitions";
import { normalizeFramePresetContainerStyle } from "../../properties/editors/LayoutPresetSelector/presetStyle";
import {
  useCanonicalPropertyElement,
  useCanonicalPropertyElementsMap,
} from "../../properties/hooks/useCanonicalPropertyRead";
import type { CompositionDocument } from "@composition/shared";

const PX_LIKE_STYLE_PROPS = new Set([
  "width",
  "height",
  "top",
  "left",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "borderWidth",
  "borderRadius",
  "gap",
  "rowGap",
  "columnGap",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "fontSize",
  "lineHeight",
  "letterSpacing",
]);

type ResetBaselineElement = {
  type: string;
  props?: Readonly<Record<string, unknown>>;
};

function getActiveCanonicalResetDocument(): CompositionDocument | null {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return null;

  return canonical.documents.get(projectId) ?? null;
}

function getActiveCanonicalResetElement(
  elementId: string,
): ResetBaselineElement | null {
  const doc = getActiveCanonicalResetDocument();
  if (!doc) return null;

  let found: ResetBaselineElement | null = null;
  visitCanonicalDocumentElements(doc, (element) => {
    if (!found && element.id === elementId) {
      found = {
        type: element.type,
        props: element.props as Readonly<Record<string, unknown>> | undefined,
      };
    }
  });
  return found;
}

function normalizeStyleValue(prop: string, value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number" && PX_LIKE_STYLE_PROPS.has(prop)) {
    return `${value}px`;
  }
  return String(value);
}

function resolveSpecStyleDefaults(
  type: string,
  props: Readonly<Record<string, unknown>> | undefined,
): Record<string, string | undefined> {
  const size = typeof props?.size === "string" ? props.size : undefined;
  const transformPreset = resolveSpecPreset(type, size);
  const layoutPreset = resolveLayoutSpecPreset(type, size, props);
  const appearancePreset = resolveAppearanceSpecPreset(type, size);
  const typographyPreset = resolveTypographySpecPreset(type, size);

  return {
    width: normalizeStyleValue("width", transformPreset.width),
    height: normalizeStyleValue("height", transformPreset.height),
    // top/left 는 position 값이라 TransformSpecPreset(시각 spec)에 없음 → 항상 undefined dead 였음.
    //   specStyle.top/left=undefined → reset 은 legacyStyle fallback(동작 동일). dead 필드 제거로
    //   `transformPreset.top` TS2339 해소(useResetStyles 부모-컨텍스트 baseline 추가 시 위치 시프트로 표면화).
    minWidth: normalizeStyleValue("minWidth", transformPreset.minWidth),
    maxWidth: normalizeStyleValue("maxWidth", transformPreset.maxWidth),
    minHeight: normalizeStyleValue("minHeight", transformPreset.minHeight),
    maxHeight: normalizeStyleValue("maxHeight", transformPreset.maxHeight),
    aspectRatio: normalizeStyleValue(
      "aspectRatio",
      transformPreset.aspectRatio,
    ),
    display: normalizeStyleValue("display", layoutPreset.display),
    flexDirection: normalizeStyleValue(
      "flexDirection",
      layoutPreset.flexDirection,
    ),
    alignItems: normalizeStyleValue("alignItems", layoutPreset.alignItems),
    justifyContent: normalizeStyleValue(
      "justifyContent",
      layoutPreset.justifyContent,
    ),
    flexWrap: normalizeStyleValue("flexWrap", layoutPreset.flexWrap),
    gap: normalizeStyleValue(
      "gap",
      layoutPreset.rowGap ?? layoutPreset.columnGap ?? layoutPreset.gap,
    ),
    padding: normalizeStyleValue(
      "padding",
      numToPx(layoutPreset.padding) ??
        uniform4Way(
          numToPx(layoutPreset.paddingTop),
          numToPx(layoutPreset.paddingRight),
          numToPx(layoutPreset.paddingBottom),
          numToPx(layoutPreset.paddingLeft),
        ),
    ),
    paddingTop: normalizeStyleValue(
      "paddingTop",
      numToPx(layoutPreset.paddingTop),
    ),
    paddingRight: normalizeStyleValue(
      "paddingRight",
      numToPx(layoutPreset.paddingRight),
    ),
    paddingBottom: normalizeStyleValue(
      "paddingBottom",
      numToPx(layoutPreset.paddingBottom),
    ),
    paddingLeft: normalizeStyleValue(
      "paddingLeft",
      numToPx(layoutPreset.paddingLeft),
    ),
    margin: normalizeStyleValue(
      "margin",
      numToPx(layoutPreset.margin) ??
        uniform4Way(
          numToPx(layoutPreset.marginTop),
          numToPx(layoutPreset.marginRight),
          numToPx(layoutPreset.marginBottom),
          numToPx(layoutPreset.marginLeft),
        ),
    ),
    marginTop: normalizeStyleValue(
      "marginTop",
      numToPx(layoutPreset.marginTop),
    ),
    marginRight: normalizeStyleValue(
      "marginRight",
      numToPx(layoutPreset.marginRight),
    ),
    marginBottom: normalizeStyleValue(
      "marginBottom",
      numToPx(layoutPreset.marginBottom),
    ),
    marginLeft: normalizeStyleValue(
      "marginLeft",
      numToPx(layoutPreset.marginLeft),
    ),
    backgroundColor: normalizeStyleValue(
      "backgroundColor",
      appearancePreset.backgroundColor,
    ),
    borderColor: normalizeStyleValue(
      "borderColor",
      appearancePreset.borderColor,
    ),
    borderWidth: normalizeStyleValue(
      "borderWidth",
      numToPx(appearancePreset.borderWidth),
    ),
    borderRadius: normalizeStyleValue(
      "borderRadius",
      numToPx(appearancePreset.borderRadius),
    ),
    fontFamily: normalizeStyleValue("fontFamily", typographyPreset.fontFamily),
    fontSize: normalizeStyleValue(
      "fontSize",
      numToPx(typographyPreset.fontSize),
    ),
    fontWeight: normalizeStyleValue("fontWeight", typographyPreset.fontWeight),
    lineHeight: normalizeStyleValue(
      "lineHeight",
      numToPx(typographyPreset.lineHeight),
    ),
    letterSpacing: normalizeStyleValue(
      "letterSpacing",
      numToPx(typographyPreset.letterSpacing),
    ),
  };
}

/**
 * Select-family sub-part(SelectValue / SelectIcon / DateInput)의 dirty/reset baseline.
 *
 * SelectTrigger 와 달리 이 3개 sub-part 는 **부모 컨텍스트마다 factory inline layout 이 다르다**
 * — CSS 레퍼런스 자체가 `.react-aria-Select .react-aria-SelectValue` 처럼 부모-한정 selector 로
 * layout(flex/display 등)을 정의하고(D3 정본), DateInput 은 RAC(D1) DOM 구조 차이(picker=`<Group>`
 * 래퍼 안 콘텐츠 / 단독=자기 box)에서 비롯된 정당한 분기다([[feedback-picker-dateinput-content-height-vs-datefield-box]]).
 * 따라서 `getDefaultProps(type)` 의 type 단일 baseline 으로는 한 그룹만 정합되고 다른 그룹이 깨진다.
 *
 * 판정 키는 부모(SelectTrigger / DateField …) + 조부모(picker 등) type 으로, layout 주입 분기
 * (`implicitStyles.ts` selecttrigger / datefield)·패널 표시 분기(`useTransformValues.ts`
 * `useIsPickerDateInput`)와 같은 컨텍스트 술어를 공유한다. 값은 factory definition 의 inline style
 * 미러 — 어긋나면 `useResetStyles.test.tsx` sub-part audit 이 FAIL(동기화 가드).
 *
 * NOTE: style 이 없는 컨텍스트(picker SelectIcon `{}`, NumberField ± SelectIcon `{}`)는 current
 * style 이 비어 dirty 판정에서 애초에 skip 되므로 항목 불필요.
 */
function resolveSubpartContextDefaultStyle(
  type: string,
  parentType: string | undefined,
  grandParentType: string | undefined,
): Record<string, unknown> {
  if (type === "DateInput") {
    // picker(부모 SelectTrigger → 조부모 DatePicker/DateRangePicker): SelectTrigger box 안 flex 콘텐츠.
    if (
      parentType === "SelectTrigger" &&
      (grandParentType === "DatePicker" ||
        grandParentType === "DateRangePicker")
    ) {
      return { flex: 1, minWidth: 0 };
    }
    // 단독(부모 DateField/TimeField): 자기 입력 box.
    if (parentType === "DateField" || parentType === "TimeField") {
      return { width: "100%" };
    }
    return {};
  }
  if (type === "SelectValue") {
    // NumberField: block 콘텐츠. 그 외 Select/ComboBox/SearchField: flex 콘텐츠.
    if (grandParentType === "NumberField") {
      return { display: "block", textAlign: "left" };
    }
    return { flex: 1, textAlign: "left" };
  }
  if (type === "SelectIcon") {
    // Select/ComboBox/SearchField/NumberField(검색·x 아이콘): 고정 18 글리프 box.
    //   picker·NumberField(증감 ±)는 factory 가 style 미주입(`{}`) → 위 NOTE 로 baseline 불필요.
    if (
      grandParentType === "Select" ||
      grandParentType === "ComboBox" ||
      grandParentType === "SearchField"
    ) {
      return { width: 18, height: 18, flexShrink: 0 };
    }
    return {};
  }
  return {};
}

function resolveResetBaseline(
  element: {
    type: string;
    props?: Readonly<Record<string, unknown>>;
  },
  context?: {
    parentType?: string;
    grandParentType?: string;
  },
): {
  legacyStyle: Record<string, unknown>;
  specStyle: Record<string, string | undefined>;
} {
  const defaultProps = getDefaultProps(element.type);
  const presetStyle = resolveAppliedPresetBaselineStyle(element);
  const subpartStyle = resolveSubpartContextDefaultStyle(
    element.type,
    context?.parentType,
    context?.grandParentType,
  );
  return {
    legacyStyle: {
      ...((defaultProps?.style || {}) as Record<string, unknown>),
      ...subpartStyle,
      ...presetStyle,
    },
    specStyle: resolveSpecStyleDefaults(element.type, element.props),
  };
}

function resolveAppliedPresetBaselineStyle(element: {
  type: string;
  props?: Readonly<Record<string, unknown>>;
}): Record<string, unknown> {
  if (element.type.toLowerCase() !== "body") {
    return {};
  }

  const appliedPreset =
    typeof element.props?.appliedPreset === "string"
      ? element.props.appliedPreset
      : undefined;
  if (!appliedPreset) {
    return {};
  }

  const preset = LAYOUT_PRESETS[appliedPreset];
  if (!preset) {
    return {};
  }

  return normalizeFramePresetContainerStyle(preset.containerStyle) as Record<
    string,
    unknown
  >;
}

function resolveTargetValue(
  prop: string,
  specStyle: Record<string, string | undefined>,
  legacyStyle: Record<string, unknown>,
): string {
  return specStyle[prop] ?? normalizeStyleValue(prop, legacyStyle[prop]) ?? "";
}

function resolveCurrentStyleValue(
  prop: string,
  currentStyle: Record<string, unknown>,
): string | undefined {
  if (prop === "gap") {
    return (
      normalizeStyleValue("rowGap", currentStyle.rowGap) ??
      normalizeStyleValue("columnGap", currentStyle.columnGap) ??
      normalizeStyleValue("gap", currentStyle.gap)
    );
  }
  return normalizeStyleValue(prop, currentStyle[prop]);
}

/**
 * 선택된 요소의 특정 속성들이 기본값과 다른지 확인하는 훅
 * 리셋 버튼 조건부 표시용
 */
export function useHasDirtyStyles(properties: string[]): boolean {
  const selectedId = useStore((state) => state.selectedElementId);
  const element = useCanonicalPropertyElement(selectedId ?? "");
  const elementsMap = useCanonicalPropertyElementsMap();
  return useMemo(() => {
    if (!element) return false;

    const currentStyle =
      (element.props?.style as Record<string, unknown>) || {};
    const parent = element.parent_id
      ? elementsMap.get(element.parent_id)
      : undefined;
    const grandParent = parent?.parent_id
      ? elementsMap.get(parent.parent_id)
      : undefined;
    const { legacyStyle, specStyle } = resolveResetBaseline(element, {
      parentType: parent?.type,
      grandParentType: grandParent?.type,
    });

    for (const prop of properties) {
      const currentValue = resolveCurrentStyleValue(prop, currentStyle);
      if (currentValue === undefined) continue;
      const resetValue = resolveTargetValue(prop, specStyle, legacyStyle);
      if (currentValue !== resetValue) return true;
    }
    return false;
  }, [element, elementsMap, properties]);
}

/**
 * resetStyles 함수만 반환하는 경량 훅
 * Section 래퍼 컴포넌트용
 *
 * Reset 시 컴포넌트의 기본 스타일 값으로 복원 (완전 삭제가 아님)
 */
export function useResetStyles() {
  const resetStyles = useCallback((properties: string[]) => {
    const state = useStore.getState();
    const selectedId = state.selectedElementId;
    if (!selectedId) return;

    const canonicalDocument = getActiveCanonicalResetDocument();
    const { elements: legacyElements } = state;
    const element = canonicalDocument
      ? getActiveCanonicalResetElement(selectedId)
      : legacyElements.find((candidate) => candidate.id === selectedId);
    if (!element) return;

    // 부모-컨텍스트 sub-part baseline(SelectValue/SelectIcon/DateInput) 정합을 위해 부모 체인 조회.
    //   reset 시 default layout 을 컨텍스트별로 복원해야(picker DateInput→flex:1/minWidth:0 등)
    //   dirty 판정(useHasDirtyStyles)과 동일 baseline 으로 일관 동작한다.
    const elementsMap = state.elementsMap;
    const selfNode = elementsMap.get(selectedId);
    const parentNode = selfNode?.parent_id
      ? elementsMap.get(selfNode.parent_id)
      : undefined;
    const grandParentNode = parentNode?.parent_id
      ? elementsMap.get(parentNode.parent_id)
      : undefined;

    const currentStyle =
      (element.props?.style as Record<string, unknown>) || {};
    const { legacyStyle, specStyle } = resolveResetBaseline(element, {
      parentType: parentNode?.type,
      grandParentType: grandParentNode?.type,
    });

    // 실제로 변경이 필요한 속성만 포함 (dirty check)
    const resetObj: Record<string, string> = {};
    properties.forEach((prop) => {
      const currentValue = resolveCurrentStyleValue(prop, currentStyle);
      if (currentValue === undefined) return;
      const targetValue = resolveTargetValue(prop, specStyle, legacyStyle);
      const resetValue =
        specStyle[prop] !== undefined
          ? ""
          : (normalizeStyleValue(prop, legacyStyle[prop]) ?? "");
      if (currentValue !== targetValue) {
        resetObj[prop] = resetValue;
      }
    });

    // 변경할 속성이 없으면 히스토리 기록 없이 조기 반환
    if (Object.keys(resetObj).length === 0) return;

    state.updateSelectedStyles(resetObj);
  }, []);

  return resetStyles;
}
