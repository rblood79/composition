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
    // verticalAlign:"middle" — factory(DateColorComponents) inline 미러(2026-07-02 전수조사).
    //   Skia datefield_segments segment text 세로 중앙 + Style 패널 Typography Vertical Align
    //   동기화. factory 4곳(picker/DateField/TimeField DateInput) 모두 주입하므로 baseline 도 동일.
    // picker(부모 SelectTrigger → 조부모 DatePicker/DateRangePicker): SelectTrigger box 안 flex 콘텐츠.
    if (
      parentType === "SelectTrigger" &&
      (grandParentType === "DatePicker" ||
        grandParentType === "DateRangePicker")
    ) {
      return { flex: 1, minWidth: 0, verticalAlign: "middle" };
    }
    // 단독(부모 DateField/TimeField): 자기 입력 box.
    if (parentType === "DateField" || parentType === "TimeField") {
      return { width: "100%", verticalAlign: "middle" };
    }
    return {};
  }
  if (type === "CalendarHeader") {
    // factory(DateColorComponents)가 CalendarHeader 에 주입하는 5개 style 미러.
    //   verticalAlign 은 ContainerStyles 스키마에 없는 필드(Typography 훅이
    //   element.props.style.verticalAlign 만 읽음)라 catalog specStyle 로 못 덮는다 →
    //   여기 baseline 이 유일 source. 나머지 flex 4개는 specStyle 이 공급하나 factory 와
    //   동일 값이므로 미러에 함께 둬도 무해(DateInput 선례). 부모 무관(Calendar/RangeCalendar
    //   공통)이라 컨텍스트 분기 없음. Why: 8c1578075 가 factory inline 만 넣고 baseline 을
    //   누락해 신규 DatePicker/DateRangePicker 의 Vertical Align 이 false dirty 였다.
    return {
      display: "flex",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      verticalAlign: "middle",
    };
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
  // ── 2026-06-23 전수 정정 — 부모 컨텍스트별 factory inline 이 다른 sub-part 추가 ──
  if (type === "Input") {
    // TextField/TextArea(필드 입력) vs ColorField(hex 입력 80px).
    if (parentType === "ColorField") {
      return { display: "block", width: "80px" };
    }
    if (parentType === "TextArea") {
      return { width: "100%", height: 80 };
    }
    if (parentType === "TextField") {
      return { width: "100%" };
    }
    return {};
  }
  if (type === "ColorSwatch") {
    // ColorField/ColorSwatchPicker 둘 다 28 칩. createDefault(display/borderWidth)에 합쳐짐.
    //   2026-06-24: ColorField 미리보기를 24/4px→28/9999px(catalog md = RAC 정본)으로 정합.
    //   height:28/borderRadius:full 은 catalog specStyle 이 채우나 width:28 은 catalog 미보유 →
    //   여기가 유일 baseline. ColorSwatchPicker(28)와 동일 값으로 수렴.
    if (parentType === "ColorField" || parentType === "ColorSwatchPicker") {
      return { width: 28, height: 28, borderRadius: "9999px" };
    }
    return {};
  }
  if (type === "Card" && parentType === "CardView") {
    // CardView 안 고정 카드(200×160). 단독 Card 는 createDefaultCardProps(width:100%) baseline.
    return { width: 200, height: 160, padding: 16 };
  }
  if (type === "Avatar" && parentType === "AvatarGroup") {
    // AvatarGroup 안 겹침 배치(marginLeft:-8). createDefault(width/height:32)에 합쳐짐.
    return { marginLeft: -8 };
  }
  // ── 2026-06-24 결정론적 전수조사 추가 정정 — 실제 factory definition 생성 트리 기준 ──
  if (type === "FieldError") {
    // 모든 field(TextField/TextArea/NumberField/DateField/TimeField) 자식 FieldError 는 에러 없을 때
    //   숨김(display:none) inline. catalog FieldError 는 display:"inline-flex"(에러 표시 시 레이아웃)라
    //   specStyle 이 그것을 채워 false dirty. display:none 은 "초기 숨김" 동작이라 부모 무관 동일 → baseline 등록.
    return { display: "none" };
  }
  if (type === "ProgressBarValue" || type === "MeterValue") {
    // ProgressBar/Meter grid 의 value 셀(우측 정렬, content 폭). specStyle.width=undefined(grid 자식
    //   width 미보유) → subpart 미등록 시 false dirty. grid placement 키는 Panel 미검사라 width/justifySelf 만.
    return { width: "fit-content", justifySelf: "end" };
  }
  if (type === "ProgressBarTrack" || type === "MeterTrack") {
    // track 셀(전체 폭). specStyle.width=undefined → baseline 등록 필요.
    return { width: "100%" };
  }
  if (type === "ColorField" && parentType === "ColorPicker") {
    // ColorPicker 안 ColorField 는 hex 입력 단순화로 display:block (단독 ColorField 는 flex).
    //   catalog ColorField display=flex 가 specStyle 로 채워져 block 이 false dirty → 컨텍스트 baseline.
    return { display: "block" };
  }
  if (type === "Heading" && parentType === "CardHeader") {
    // Card 헤더 레이아웃 — margin:0(제목 여백 제거). specStyle 미보유 키라 baseline 등록.
    //   flex:1 은 Panel 미검사(flex shorthand) 라 제외. fontWeight 600 은 Heading 가드 별도 흡수.
    return { margin: "0" };
  }
  if (type === "Description" && parentType === "CardContent") {
    // Card 본문 설명 — color #49454f(catalog text 토큰 미정합으로 inline 유지, typography scope 외 보류).
    //   값 정정(catalog 토큰 정합)은 별도 사안이나 dirty 만 해소하도록 factory inline 미러 등록.
    return { color: "#49454f" };
  }
  // ── 2026-06-24 reusable composite origin(ADR-912 R-5) 자식 baseline — origin 템플릿 style 미러 ──
  if (type === "Separator" && parentType === "Toolbar") {
    // Toolbar origin 안 세로 구분선(1×20). 단독 Separator 는 createDefaultSeparatorProps(height:1) baseline.
    //   width/height 가 부모 컨텍스트별 정본이라 subpart 로 분리(type-only baseline 에 박으면 단독 깨짐).
    return { width: "1px", height: "20px" };
  }
  if (type === "FormField" && parentType === "Form") {
    // Form origin 안 FormField(세로 스택, 전체 폭). FormField 는 getDefaultProps 미등록(baseline {}) +
    //   catalog 가 display/flexDirection/gap 을 채우지 않아 Transform/Layout false dirty → origin 미러 등록.
    return {
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      width: "100%",
    };
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
  subpartStyle: Record<string, unknown>;
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
    // subpartStyle 을 별도 반환 — resolveTargetValue 가 specStyle 보다 우선 적용한다.
    //   Why: subpart 는 "부모 컨텍스트별 정본"(예: CardView 안 Card width:200, TextArea 안
    //   Input height:80)이라 type-only specStyle(부모 무관, Card width:"100%"/Input height:30)보다
    //   구체적이다. legacyStyle 병합만으로는 specStyle[prop] ?? legacyStyle 순서 탓에 specStyle 이
    //   채운 transform 축(width/height)을 subpart 가 못 덮어 false dirty (2026-06-24 전수조사).
    subpartStyle,
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
  subpartStyle: Record<string, unknown>,
): string {
  // subpart override (specStyle 보다 우선) — 부모 컨텍스트별 명시 정본이 type-only specStyle 을 덮음.
  //   예: CardView 안 Card width:200 (specStyle Card width:"100%" 덮음), TextArea 안 Input height:80
  //   (specStyle Input height:30 덮음). subpart 에 키가 명시된 경우만 우선, 그 외엔 기존 동작 보존.
  const subpartVal = normalizeStyleValue(prop, subpartStyle[prop]);
  if (subpartVal !== undefined) return subpartVal;

  // gap 은 resolveCurrentStyleValue 가 rowGap ?? columnGap ?? gap 으로 읽으므로(store longhand
  //   정책) baseline 도 동일 fallback 해야 비대칭이 없다. legacyStyle 이 rowGap/columnGap longhand
  //   만 보유(예: frame {rowGap:0,columnGap:0})하면 legacyStyle["gap"]=undefined → 항상 dirty 였음
  //   (2026-06-23 정정). specStyle.gap 은 이미 layoutPreset rowGap ?? columnGap ?? gap 로 채워짐.
  if (prop === "gap") {
    return (
      specStyle.gap ??
      normalizeStyleValue("rowGap", legacyStyle.rowGap) ??
      normalizeStyleValue("columnGap", legacyStyle.columnGap) ??
      normalizeStyleValue("gap", legacyStyle.gap) ??
      ""
    );
  }
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
 * Style Panel 4섹션(Transform / Layout / Appearance / Typography)이 `useHasDirtyStyles` 로 검사하는
 * prop 의 합집합 — reset 버튼 표시 범위의 SSOT.
 *
 * Why: "modify N" 뱃지·Modified Styles 패널(`useDirtyStyleProps`)은 이 범위로만 modified 를 세야
 * reset 버튼과 정합한다. 이 union 밖 키(grid placement: gridColumnStart/End/gridRowStart/End/gridArea,
 * flex shorthand, objectFit 등)는 어느 섹션도 reset 으로 편집하지 않으므로 — modify 가 전 키를 세면
 * grid 자식(ProgressBarValue 등)이 "modify 5" 인데 reset 버튼은 0인 비대칭이 생긴다(2026-06-24).
 * 각 섹션의 {TRANSFORM,LAYOUT,APPEARANCE,TYPOGRAPHY}_PROPS 와 동일 — 섹션 PROPS 변경 시 동반 갱신.
 */
export const PANEL_STYLE_PROPS: readonly string[] = [
  // Transform
  "width",
  "height",
  "top",
  "left",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "alignSelf",
  "justifySelf",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "aspectRatio",
  // Typography
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "color",
  "textAlign",
  "textDecoration",
  "textTransform",
  "verticalAlign",
  "whiteSpace",
  "wordBreak",
  "overflowWrap",
  "textOverflow",
  // Layout
  "display",
  "flexDirection",
  "flexWrap",
  "alignItems",
  "justifyContent",
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
  // Appearance
  "backgroundColor",
  "borderColor",
  "borderWidth",
  "borderRadius",
  "borderStyle",
  "boxShadow",
  "overflow",
];

/**
 * element(+부모 컨텍스트)의 style 중 baseline(factory default / spec preset / subpart)과 **다른**
 * prop 만 반환하는 순수 함수.
 *
 * Why: "Modified Styles" 패널·"modify N" 뱃지(`useStyleSource.getModifiedProperties` /
 * `StylesPanel.modifiedCount`)가 과거엔 `Object.keys(style)` 즉 **inline style 키 존재만**으로
 * modified 를 판정했다. composition 은 factory 가 layout 을 `props.style` 에 직접 주입하므로
 * (예: Form `{display:flex, flexDirection:column, gap:16px, width:100%}`) 신규 요소가 손대지 않아도
 * 4~5개가 "modified" 로 표시됐다 — reset 버튼(`useHasDirtyStyles`)은 baseline 비교로 dirty=false 라
 * 숨겨지는데 Modified 패널엔 뜨는 **비대칭**(사용자 보고 2026-06-24). 본 함수는 reset 판정과 **동일한
 * baseline 비교**(`resolveCurrentStyleValue` vs `resolveTargetValue`)를 공유해 두 뷰를 정합시킨다.
 *
 * @param properties 검사 대상 prop 목록. 미지정 시 currentStyle 의 모든 키.
 */
export function computeDirtyStyleProps(
  element: {
    type: string;
    props?: Readonly<Record<string, unknown>>;
  },
  context?: {
    parentType?: string;
    grandParentType?: string;
  },
  properties?: string[],
): string[] {
  const currentStyle = (element.props?.style as Record<string, unknown>) || {};
  const { legacyStyle, specStyle, subpartStyle } = resolveResetBaseline(
    element,
    context,
  );

  // properties 미지정 시 현재 style 의 모든 키(+gap longhand 정규화) 검사.
  const keys = properties ?? Object.keys(currentStyle);
  const dirty: string[] = [];
  for (const prop of keys) {
    const currentValue = resolveCurrentStyleValue(prop, currentStyle);
    if (currentValue === undefined) continue;
    const resetValue = resolveTargetValue(
      prop,
      specStyle,
      legacyStyle,
      subpartStyle,
    );
    if (currentValue !== resetValue) dirty.push(prop);
  }
  return dirty;
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

    const parent = element.parent_id
      ? elementsMap.get(element.parent_id)
      : undefined;
    const grandParent = parent?.parent_id
      ? elementsMap.get(parent.parent_id)
      : undefined;

    return (
      computeDirtyStyleProps(
        element,
        {
          parentType: parent?.type,
          grandParentType: grandParent?.type,
        },
        properties,
      ).length > 0
    );
  }, [element, elementsMap, properties]);
}

/**
 * 선택된 요소의 "실제로 변경된(baseline 과 다른)" style prop 목록을 반환하는 훅.
 *
 * Modified Styles 패널 / "modify N" 뱃지가 reset 버튼(`useHasDirtyStyles`)과 동일 baseline 비교를
 * 공유하도록 한다. element 와 부모 체인을 store 에서 읽어 `computeDirtyStyleProps` 에 위임.
 */
export function useDirtyStyleProps(): string[] {
  const selectedId = useStore((state) => state.selectedElementId);
  const element = useCanonicalPropertyElement(selectedId ?? "");
  const elementsMap = useCanonicalPropertyElementsMap();
  return useMemo(() => {
    if (!element) return [];

    const parent = element.parent_id
      ? elementsMap.get(element.parent_id)
      : undefined;
    const grandParent = parent?.parent_id
      ? elementsMap.get(parent.parent_id)
      : undefined;

    // PANEL_STYLE_PROPS 로 제한 — Style Panel 4섹션이 reset 으로 편집하는 범위와 동일.
    //   grid placement 등 패널 미편집 키를 modify 가 세면 reset 버튼과 비대칭(ProgressBarValue
    //   "modify 5" ↔ reset 0, 2026-06-24).
    return computeDirtyStyleProps(
      element,
      {
        parentType: parent?.type,
        grandParentType: grandParent?.type,
      },
      [...PANEL_STYLE_PROPS],
    );
  }, [element, elementsMap]);
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
    const { legacyStyle, specStyle, subpartStyle } = resolveResetBaseline(
      element,
      {
        parentType: parentNode?.type,
        grandParentType: grandParentNode?.type,
      },
    );

    // 실제로 변경이 필요한 속성만 포함 (dirty check)
    const resetObj: Record<string, string> = {};
    properties.forEach((prop) => {
      const currentValue = resolveCurrentStyleValue(prop, currentStyle);
      if (currentValue === undefined) return;
      const targetValue = resolveTargetValue(
        prop,
        specStyle,
        legacyStyle,
        subpartStyle,
      );
      // reset 값 우선순위: subpart 명시 키는 그 값을 store 에 명시 기록 (specStyle 처럼 ""로 지우면
      //   specStyle 값으로 되돌아가 부모 컨텍스트 정본이 깨짐). 그 외엔 기존 동작(specStyle 있으면
      //   "" 삭제 → specStyle fallback, 없으면 legacyStyle 값).
      const subpartReset = normalizeStyleValue(prop, subpartStyle[prop]);
      const resetValue =
        subpartReset !== undefined
          ? subpartReset
          : specStyle[prop] !== undefined
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
