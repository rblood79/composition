/**
 * ADR-142 #5 — generic box+text 시각 생성기 (component-agnostic).
 *
 * **정본 범위 (사용자 정정 2026-05-31)**: 모든 frame 이 공유하는 **보편 box+text 시각**만
 * generic 처리한다 — bg roundRect + border + text. 색/크기/형태는 `variants[variant].fill`
 * (ADR-908 `resolveFillTokens`) + `sizes[size]` + `props.style` 에서 읽되, **컴포넌트 식별
 * 분기를 두지 않는다**. fill/outline/subtle/selected 축은 모든 frame 이 가질 수 있는 보편
 * 상태축(CSS data-* 와 동형)이라 여기서 fill 색 결정에 쓴다.
 *
 * **비-DOM-trivial primitive(원/선/아이콘 등)는 본 함수가 그리지 않는다** —
 * `PrimitiveBinding.skiaPrimitive` draw module(`renderers/skiaPrimitives.ts`)이 담당하고,
 * dispatch(buildSpecNodeData)가 `binding.skiaPrimitive` 유무로 갈린다. `if (isDot)/if (divider)/
 * if (iconName)` 같은 컴포넌트 식별 분기를 본 함수에 인라인하면 컴포넌트 N++ 복제가 된다(금지).
 *
 * **전환기**: spec 의 ADR-908 FillTokenSpec 을 직접 읽음(#8 theme adapter 와 동일 패턴,
 * 목표는 theme/tokens data-* rules). 출력은 기존 `specShapesToSkia` 가 그대로 소비.
 *
 * 설계: docs/adr/design/142-starter-spec-component-system-cutover-breakdown.md §"#5 Skia backend" + §3 skiaPrimitive
 */

import { parseBorderWidth, parsePxValue } from "../primitives";
import { fontFamily } from "../primitives/typography";
import type {
  BorderStyleValue,
  ComponentState,
  Shape,
  SizeSpec,
  TokenRef,
} from "../types";
import { resolveSpecFontSize } from "./utils/resolveSpecFontSize";
import { measureSpecTextWidth } from "./utils/measureText";
import type { ComponentVisualRule } from "./utils/resolveComponentVisual";

/**
 * tree depth 들여쓰기 offset(px) — ADR-912 R1 후속 TreeItem catalog cutover.
 *
 * `_treeLevel`(buildSpecNodeData 가 parent 체인으로 주입, 1-based) × `size.indentPerLevel`.
 * text(buildCatalogShapes)와 leading icon(`leading_icon` skiaPrimitive) 양쪽이 **동일 helper**
 * 를 호출해 들여쓰기를 일치시킨다(컴포넌트별 if 아님 — `_treeLevel`/`indentPerLevel` 데이터 유무로만
 * 분기, ADR-142 §3). TreeItem 외 type 은 `_treeLevel`/`indentPerLevel` 미주입 → 0 반환(무영향).
 */
export function resolveTreeIndent(
  props: Record<string, unknown>,
  size: SizeSpec,
): number {
  const level = props._treeLevel;
  const indentPerLevel = size.indentPerLevel;
  if (
    typeof level !== "number" ||
    level <= 1 ||
    typeof indentPerLevel !== "number" ||
    indentPerLevel <= 0
  ) {
    return 0;
  }
  return (level - 1) * indentPerLevel;
}

/**
 * segmented control four-corner radius — ToggleButtonGroup 안 ToggleButton 의 위치별
 * 코너 radius 산출 (reference react-aria-starter ToggleButtonGroup.css:32-67 동형).
 *
 * `props._groupPosition`({ orientation, isFirst, isLast, isOnly }) 데이터 키 유무로만 분기
 * (ADR-142 §3 — 컴포넌트 식별 `if(type==="ToggleButton")` 금지, `resolveTreeIndent` 의 `_treeLevel`
 * 동형). `_groupPosition` 은 buildSpecNodeData.resolveToggleGroupContext 가 주입.
 *
 * **density=regular 은 대상이 아니다 (2026-08-21)**: Spectrum ActionGroup 규정상 버튼이
 * 연결되는 것은 **compact density 의 성질**이고(`"The action buttons also become connected"`),
 * regular 은 버튼이 분리돼 각자 균등 radius 를 유지한다. 그래서 regular 이면 `isOnly` 와
 * 같이 null 을 반환한다 — DOM 축의 `[data-density="compact"]` gate 와 같은 판정
 * (generated ToggleButtonGroup.css: regular 에는 코너 override 규칙이 emit 되지 않는다).
 *
 * 위치별 코너(reference 공식, [tl, tr, br, bl]):
 * - isOnly / density=regular(또는 미주입): null 반환 → caller 가 균등 radius 유지.
 * - horizontal: first=[r,0,0,r] / last=[0,r,r,0] / middle=[0,0,0,0].
 * - vertical:   first=[r,r,0,0] / last=[0,0,r,r] / middle=[0,0,0,0].
 *
 * CSS 경로(generated ToggleButtonGroup.css [data-orientation] > .react-aria-ToggleButton)와
 * 시각 대칭. r = caller 의 균등 borderRadius(size별, --btn-border-radius 와 동일 값).
 *
 * `radius` 는 number 또는 TokenRef string(`"{radius.md}"`) 모두 허용한다. ToggleButton catalog
 * sizes[*].borderRadius 는 TokenRef 이므로(ruleSizeToSizeSpec 값 변환 없이 cast) number 로
 * 강제하면 segmented 분배가 skip 된다(2026-06-27 버그). TokenRef 는 위치별 배열에 그대로 배치하고,
 * builder specShapeConverter.resolveRadius 가 배열 각 요소(TokenRef 포함)를 런타임 number 해소한다.
 * radius 자리에 0(직각)은 항상 number — TokenRef 가 아닌 코너는 0 으로 둔다.
 */
export function resolveSegmentedRadius(
  props: Record<string, unknown>,
  radius: number | string,
): [number | string, number | string, number | string, number | string] | null {
  const pos = props._groupPosition as
    | {
        orientation?: string;
        isFirst?: boolean;
        isLast?: boolean;
        isOnly?: boolean;
        density?: string;
      }
    | undefined;
  if (!pos || pos.isOnly) return null;
  // density 미주입(구 데이터/미배선 경로)은 종전 동작인 연결 유지 — 명시적으로 regular 일
  //   때만 분리한다. 신규 주입 경로는 항상 값을 싣는다(buildSpecNodeData).
  if (pos.density === "regular") return null;

  const vertical = pos.orientation === "vertical";
  if (pos.isFirst) {
    return vertical ? [radius, radius, 0, 0] : [radius, 0, 0, radius];
  }
  if (pos.isLast) {
    return vertical ? [0, 0, radius, radius] : [0, radius, radius, 0];
  }
  return [0, 0, 0, 0]; // middle — 전부 직각
}

/**
 * leading icon glyph 이름 해석 — rule 의 정적 `name` 과 행 데이터 `nameProp` 을 합성한다.
 *
 * `nameProp` 이 있으면 `props[nameProp]`(예: Tag chip 의 `icon`)이 우선이고, 값이 없으면
 * rule 의 `name` 으로 폴백한다. 둘 다 없으면 **아이콘 없음** — 호출부는 glyph 도 그리지 않고
 * text shift 도 하지 않아야 한다(아이콘 없는 항목의 폭이 커지는 것을 막는다).
 *
 * 컴포넌트 식별 분기가 아니라 rule 데이터 기반 게이팅이다 (ADR-142 §3, trailingIcon 의
 * `showProp` 과 같은 idiom). buildCatalogShapes(폭 shift)와 `leading_icon` skiaPrimitive
 * (glyph)가 **같은 함수**를 써야 둘이 어긋나지 않는다.
 */
export function resolveLeadingIconName(
  leadingIcon:
    | { name?: string; nameProp?: string; gap?: number; color?: TokenRef }
    | undefined,
  props: Record<string, unknown>,
): string | null {
  if (!leadingIcon) return null;
  if (leadingIcon.nameProp) {
    const fromProps = props[leadingIcon.nameProp];
    if (typeof fromProps === "string" && fromProps.length > 0) return fromProps;
  }
  return leadingIcon.name && leadingIcon.name.length > 0
    ? leadingIcon.name
    : null;
}

/** selection checkbox 슬롯 해석 결과 (행 맨 앞 — leading 슬롯보다 앞선다). */
export interface SelectionSlotResolution {
  /** 정사각형 한 변(px) */
  size: number;
  /** 체크박스 ↔ 다음 슬롯 간격(px) */
  gap: number;
  /** 뒤따르는 모든 것이 밀리는 폭 = size + gap */
  width: number;
  /** 체크 표시 여부 */
  isSelected: boolean;
}

/**
 * 행 맨 앞 selection checkbox 슬롯 — `showProp` boolean 이 true 일 때만 선다.
 *
 * leading 슬롯(icon/avatar)과 **배타가 아니다**: DOM 실측상 Tree 행은
 * `checkbox → chevron → label` 순서라 둘 다 서고 폭이 **가산**된다. 그래서
 * `resolveLeadingSlot` 과 별개 helper 이고, 호출부는 둘을 더한다.
 *
 * 가시성 신호(`_showSelectionCheckbox`)는 builder 가 부모 컬렉션의 selectionMode·
 * selectionStyle 을 해석해 주입한다 — 여기서 컴포넌트를 식별하지 않는다(ADR-142 §3).
 */
export function resolveSelectionSlot(
  visual: ComponentVisualRule | undefined,
  props: Record<string, unknown>,
): SelectionSlotResolution | null {
  const sc = visual?.selectionCheckbox;
  if (!sc) return null;
  const showKey = sc.showProp ?? "_showSelectionCheckbox";
  if (props[showKey] !== true) return null;
  const size = sc.size ?? 20;
  const gap = sc.gap ?? 2;
  return {
    size,
    gap,
    width: size + gap,
    isSelected: props.isSelected === true,
  };
}

/** 좌측 슬롯 해석 결과 — icon(폰트 glyph) 또는 avatar(원형 이미지) 중 하나. */
export type LeadingSlotResolution =
  | {
      kind: "icon";
      /** lucide glyph 이름 */
      name: string;
      /** glyph 크기(px) */
      size: number;
      /** slot ↔ text 간격(px) */
      gap: number;
      /** text 우측 shift 폭 = size + gap */
      width: number;
    }
  | {
      kind: "avatar";
      /** 이미지 URL */
      src: string;
      /** 원 지름(px) */
      size: number;
      gap: number;
      width: number;
      /** 이미지 로드 전/실패 시 원 배경 */
      fallbackFill: TokenRef | undefined;
    };

/**
 * 텍스트 **좌측 슬롯** 단일 판정 — avatar(이미지) > icon(glyph) > 없음.
 *
 * 좌측 슬롯은 하나뿐이라 두 채널이 동시에 그려지면 폭·시각이 모두 어긋난다. 판정을 여기
 * 한 곳에 모아 두 소비자가 같은 결론을 공유한다:
 *   - `buildCatalogShapes` — text x shift 폭
 *   - `leading_icon` / `leading_avatar` skiaPrimitive — 실제 glyph/이미지 생성
 * 갈리면 "폭은 밀렸는데 아무것도 안 그려진다"(또는 반대)가 된다 — Tag icon 슬라이스에서
 * stale dist 로 실제 재현된 증상.
 *
 * 두 채널 모두 **행 데이터 게이팅**(`nameProp`/`srcProp`)을 지원한다: 값이 비면 그 항목은
 * 슬롯이 없는 것으로 보고 shift 도 하지 않는다(컴포넌트 식별 분기 아님 — ADR-142 §3).
 */
export function resolveLeadingSlot(
  visual: ComponentVisualRule | undefined,
  props: Record<string, unknown>,
  size: SizeSpec,
  fontSize: number,
): LeadingSlotResolution | null {
  const la = visual?.leadingAvatar;
  if (la) {
    let src: string | null = null;
    if (la.srcProp) {
      const fromProps = props[la.srcProp];
      if (typeof fromProps === "string" && fromProps.length > 0)
        src = fromProps;
    }
    if (!src && la.src && la.src.length > 0) src = la.src;
    if (src) {
      const diameter = la.size ?? 16;
      const gap = la.gap ?? 4;
      return {
        kind: "avatar",
        src,
        size: diameter,
        gap,
        width: diameter + gap,
        fallbackFill: la.fallbackFill,
      };
    }
  }

  const iconName = resolveLeadingIconName(visual?.leadingIcon, props);
  if (!iconName) return null;
  const iconSize =
    typeof size.iconSize === "number" && size.iconSize > 0
      ? size.iconSize
      : Math.round(fontSize * 1.1);
  const gap = visual!.leadingIcon!.gap ?? 6;
  return {
    kind: "icon",
    name: iconName,
    size: iconSize,
    gap,
    width: iconSize + gap,
  };
}

/**
 * generic box+text 시각 생성기 (ADR-142 G2(b) B — spec-free).
 *
 * **데이터 소스 (B swap)**: 더 이상 `spec` 을 읽지 않는다. variant 색상(`visual`) + size(`size`)
 * + text-decoration(`textDecoration`)을 caller(builder buildSpecNodeData)가 rule 테이블
 * (`resolveComponentRule`)에서 해소해 주입한다. 패키지 경계(`specs ← shared`)상 본 함수(specs)는
 * shared rule 테이블을 import 못 하므로 builder 가 주입 책임을 진다. spec runtime 참조 0(#8).
 *
 * @param visual variant 시각 규칙(rule.variants[v] 투영). variant 없는 컨테이너 shell 은 undefined.
 * @param textDecoration underline 등 D3 text-decoration 메타(Link). 미지정 시 미적용.
 */
export function buildCatalogShapes(
  visual: ComponentVisualRule | undefined,
  props: Record<string, unknown>,
  size: SizeSpec,
  state: ComponentState = "default",
  textDecoration?: string,
): Shape[] {
  const style = props.style as Record<string, unknown> | undefined;

  const fill = visual?.fill;

  const scalarRadius = parsePxValue<string>(
    style?.borderRadius,
    size.borderRadius as string,
  );
  // segmented control(ToggleButtonGroup 안 ToggleButton): _groupPosition 데이터 키가 있으면
  //   위치별 four-corner radius 로 치환(reference 동형, CSS [data-orientation] segmented 와 대칭).
  //   없으면(단독/타 컴포넌트) 균등 scalar 유지. ADR-142 §3 — 데이터 키 분기(컴포넌트 식별 아님).
  //   scalarRadius 는 number 또는 TokenRef("{radius.md}") — 둘 다 segmented 분배 대상.
  //   ToggleButton catalog borderRadius 는 TokenRef 라, number 게이트가 있으면 분배가 skip 되어
  //   Skia segmented 가 균등 radius 로 발산했다(2026-06-27 fix). TokenRef 요소는 배열에 보존되고
  //   specShapeConverter.resolveRadius 가 런타임 해소한다.
  const segmentedRadius = resolveSegmentedRadius(props, scalarRadius);
  // shape.radius 타입은 number | [4] (TokenRef 미허용) — TokenRef 는 specShapeConverter.resolveRadius
  //   가 런타임 해소하므로 cast(기존 `as unknown` 패턴 동형). 배열(TokenRef 요소 포함)은 보존.
  const borderRadius = (segmentedRadius ?? scalarRadius) as unknown as
    number | [number, number, number, number];
  // border-width: 사용자 style 우선, 없으면 size.borderWidth(보편 D3 속성), 최종 fallback 1.
  const borderWidth = parseBorderWidth(
    style?.borderWidth,
    size.borderWidth ?? 1,
  );

  // fillStyle 별 fill state subset — outline/subtle 은 Partial(미정의 시 fallback).
  const fillStyleProp = (props.fillStyle as string | undefined) ?? "fill";
  const isOutline = fillStyleProp === "outline";
  const isSubtle = fillStyleProp === "subtle";
  // quiet preset (2026-08-21) — boolean prop `isQuiet` 이 고르는 fill 축. **정의된 경우에만**
  //   분기해 quiet 미정의 컴포넌트의 기존 동작을 보존한다(정의 없이 켜면 배경이 통째 사라짐).
  //   fillStyle 과 동시 지정 시 quiet 우선 — 다만 현재 두 축을 함께 노출하는 컴포넌트는 없다
  //   (quiet 보유 = ToggleButton/TextArea/field 계열, fillStyle 보유 = Button/Badge 계열).
  const isQuiet = props.isQuiet === true && fill?.quiet != null;
  const fillStates = isQuiet
    ? fill?.quiet
    : isOutline
      ? fill?.outline
      : isSubtle
        ? fill?.subtle
        : fill?.default;

  // selected 축 (ToggleButton 류) — props.isSelected + isEmphasized.
  // state(default/hover/pressed)와 직교하는 selection 차원. spec.variant.fill.default.
  // selected/emphasizedSelected + variant.selectedText/selectedBorder 데이터에서 읽는다.
  const isSelected = props.isSelected === true;
  const isEmphasized = props.isEmphasized === true;
  // TagGroup maxRows "Show all" chip — 투명 배경 + accent 텍스트(테두리 없음). RSP/삭제된
  //   TagList.spec 시각 사양(fill:transparent, text:{color.accent}). 데이터 분기(ADR-142 §3).
  const isShowAllChip = props._isShowAll === true;

  const stateBg = isSelected
    ? isEmphasized
      ? (fill?.default.emphasizedSelected ?? fill?.default.selected)
      : fill?.default.selected
    : state === "hover"
      ? (fillStates?.hover ?? fillStates?.base)
      : state === "pressed"
        ? (fillStates?.pressed ?? fillStates?.base)
        : fillStates?.base;

  // staticColor (RSP S2 D2 prop — Link/Button/ToggleButton 공유): theme 무관 고정 흑백 스킴.
  //   black/white 외(auto·undefined)는 미적용(variant 색 경로 유지). 2026-08-20 Button 채택으로
  //   텍스트 단독 → 스킴 확장:
  //   - opaque bg 채널 보유 + fill: bg=static, text=역상(흑↔백), border=static — CSS Button.css
  //     `[data-static-color]:not([data-fill-style="outline"])` 와 대칭.
  //   - outline/subtle 또는 bg 시각 부재(Link 형 transparent base/alpha 0): text·border=static,
  //     역상 미적용 (기존 Link text-only 동작 보존).
  //   우선순위는 사용자 명시가 항상 위: style.backgroundColor/color/borderColor > static > variant.
  //   컴포넌트 식별 분기 아님 — staticColor prop + bg 채널 데이터 유무로만 분기 (ADR-142 §3).
  const staticColorProp = props.staticColor as string | undefined;
  const staticHex =
    staticColorProp === "black"
      ? "#000000"
      : staticColorProp === "white"
        ? "#ffffff"
        : undefined;
  const staticOnOpaqueBg =
    staticHex != null &&
    !isOutline &&
    !isSubtle &&
    stateBg != null &&
    stateBg !== "{color.transparent}" &&
    (fill?.alpha ?? 1) !== 0;
  // value-fill track(over background, §2-F 2026-08-21): rule 이 fillBar 채널을 보유한
  //   컴포넌트(ProgressBarTrack 류)의 static bg 는 Button 형 solid 반전이 아니라 **25% wash**
  //   — fill 막대(value_fill_bar solid static)와의 대비가 스킴의 본질. 데이터 분기
  //   (visual.fillBar 유무 — 컴포넌트 식별 아님, ADR-142 §3). DOM 수동 ProgressBar.css
  //   `--track-color: rgb(.../0.25)` 와 동일 상수.
  const staticTrackWash = staticOnOpaqueBg && visual?.fillBar != null;
  const staticTextColor =
    staticHex == null
      ? undefined
      : staticOnOpaqueBg && !staticTrackWash
        ? staticHex === "#000000"
          ? "#ffffff"
          : "#000000"
        : staticHex;

  // 상태별 배경색 (사용자 스타일 우선). outline 은 base 미정의 시 transparent.
  //   Show all chip 은 투명 배경(테두리도 없음 — 아래 borderColor override).
  const bgColor = isShowAllChip
    ? ("{color.transparent}" as unknown as string)
    : ((style?.backgroundColor as string | undefined) ??
      (staticOnOpaqueBg ? staticHex : undefined) ??
      stateBg ??
      (isOutline ? ("{color.transparent}" as unknown as string) : undefined));

  // 텍스트색: selected→selectedText/emphasizedSelectedText, outline→outlineText,
  // subtle→subtleText, 그 외 hover textHover / text. (visual = resolveComponentVisual 어댑터)
  const textColor = isShowAllChip
    ? ("{color.accent}" as unknown as string)
    : ((style?.color as string | undefined) ??
      staticTextColor ??
      (isSelected
        ? isEmphasized
          ? (visual?.emphasizedSelectedText ?? visual?.selectedText)
          : visual?.selectedText
        : isOutline
          ? (visual?.outlineText ?? visual?.text)
          : isSubtle
            ? (visual?.subtleText ?? visual?.text)
            : state === "hover" && visual?.textHover
              ? visual.textHover
              : visual?.text));

  // 테두리색: selected→selectedBorder/emphasizedSelectedBorder, outline→outlineBorder,
  // 그 외 hover borderHover / border. static 은 variant border 채널이 있을 때만 대체
  // (채널 없는 컴포넌트에 테두리를 새로 만들지 않음 — Link 보존).
  const variantBorderColor = isSelected
    ? isEmphasized
      ? (visual?.emphasizedSelectedBorder ?? visual?.selectedBorder)
      : visual?.selectedBorder
    : isOutline
      ? (visual?.outlineBorder ?? visual?.border)
      : state === "hover" && visual?.borderHover
        ? visual.borderHover
        : visual?.border;
  // static 이 테두리를 **대체**하는 조건 = 그 컴포넌트가 실제로 테두리를 그리는가.
  //   border 채널이 `{color.transparent}` 인 컴포넌트는 두 부류로 갈린다:
  //   - ToggleButton: transparent + `sizes[size].borderWidth: 1` → DOM 도 border-width 1px
  //     위에 `--button-border` 를 칠하므로 static 흑백 테두리가 보인다 (대칭 유지 필요).
  //   - ToggleButtonGroup 류 컨테이너: transparent + borderWidth 채널 자체가 없음 → DOM 은
  //     border-width 0 이라 border-color 를 무엇으로 줘도 안 보인다. 여기서 static 을 실으면
  //     Skia 만 `borderWidth ?? 1` fallback 으로 검은 사각형을 그려 **새 비대칭**이 생긴다
  //     (그룹 staticColor 는 자식 상속 채널 — 2026-08-21 §축③).
  //   따라서 "border-width 채널 보유" 를 데이터 기준으로 쓴다 (컴포넌트 식별 아님, ADR-142 §3).
  const hasBorderWidthChannel =
    size.borderWidth != null || style?.borderWidth != null;
  const staticBorderEligible =
    variantBorderColor != null &&
    (variantBorderColor !== "{color.transparent}" || hasBorderWidthChannel);
  const borderColor = isShowAllChip
    ? undefined
    : ((style?.borderColor as string | undefined) ??
      (staticHex != null && staticBorderEligible
        ? staticHex
        : variantBorderColor));

  const text =
    (props.label as string | undefined) ||
    (props.text as string | undefined) ||
    (props.children as string | undefined) ||
    // ADR-912 R1 (2026-06-12): placeholder 는 보편 RAC prop — 값이 비었을 때 DOM 이
    //   placeholder 를 표시하듯 Skia 도 동일 text 로 그린다 (SelectValue/Input 류 field leaf).
    //   컴포넌트 식별 분기 아님 — 데이터 유무로만 분기 (ADR-142 §3).
    (props.placeholder as string | undefined);

  // 비-DOM-trivial primitive(원/선/아이콘 등 box+text 로 표현 안 되는 도형)는 여기서
  // 그리지 않는다 — `PrimitiveBinding.skiaPrimitive` draw module(renderers/skiaPrimitives.ts)이
  // 담당한다. dispatch(buildSpecNodeData)가 binding.skiaPrimitive 유무로 갈라, 있으면 그
  // draw module 로, 없으면 본 함수(box+text 보편 frame)로 보낸다. 컴포넌트 식별 분기(isDot/
  // divider/iconName)를 본 함수 안에 인라인하지 않는다(정본: 데이터 분기, ADR-142 §3 skiaPrimitive).

  // 보이지 않는 배경 생략 (Link 류 text-only leaf / variant 없는 컨테이너 shell):
  //   채울 배경색(bgColor)도 테두리(borderColor)도 없으면 그릴 box 가 없으므로 생략한다.
  //   - Link: fill.alpha===0 → bgColor 가 transparent 가 아니어도 alpha 0 이면 투명 box 무의미.
  //   - field/Slider 등 variant 없는 컨테이너: variant 없음 → fill/bgColor undefined →
  //     `_hasChildren` 자식이 배경 담당, 부모는 빈 shell(legacy render.shapes 빈 배열 parity).
  //   backgroundColor 가 명시되면 사용자 의도이므로 box 를 그린다.
  const hasVisibleBg =
    style?.backgroundColor != null ||
    (bgColor != null && (fill?.alpha ?? 1) !== 0) ||
    !!borderColor;

  // Background(fills) 합성 alpha (hex alpha × fill.opacity) — builder
  // (buildSpecNodeData)가 hex6 backgroundColor + `_fillBgAlpha` 로 분해 주입.
  // 색 문자열 채널은 hex6 전용(hex8 은 hexStringToNumber 채널 시프트가 어긋남)
  // 이라 alpha 는 본 데이터 키로만 운반된다 (ADR-142 §3 데이터 분기).
  const fillBgAlpha =
    typeof props._fillBgAlpha === "number" ? props._fillBgAlpha : 1;

  const shapes: Shape[] = [];
  if (hasVisibleBg) {
    shapes.push({
      id: "bg",
      type: "roundRect",
      x: 0,
      y: 0,
      width: "auto",
      height: "auto" as unknown as number,
      radius: borderRadius,
      fill: bgColor,
      // staticTrackWash: value-fill track 의 static bg 25% (위 §2-F 분기 주석 참조).
      fillAlpha:
        (fill?.alpha ?? 1) * fillBgAlpha * (staticTrackWash ? 0.25 : 1),
    });
    // border-style 은 보편 D3 속성(CSS border-style 동형). 3경로 공통 우선순위:
    //   사용자 style.borderStyle → catalog visual.borderStyle → (미지정 시)
    //   specShapeConverter 가 "solid" fallback(style 키 생략 → solid).
    //   "none" 은 테두리 숨김 의도 — border shape 자체를 생성하지 않는다(DOM border-style:none 대칭).
    const borderStyle =
      (style?.borderStyle as string | undefined) ?? visual?.borderStyle;
    if (borderColor && borderStyle !== "none") {
      shapes.push({
        type: "border",
        target: "bg",
        borderWidth,
        color: borderColor,
        radius: borderRadius,
        ...(borderStyle ? { style: borderStyle as BorderStyleValue } : {}),
      });
    }
  }

  // Child Composition: 자식 Element 가 있으면 shell(box) 만 반환
  if (props._hasChildren) return shapes;

  if (text) {
    // ADR-912 paddingX 데이터 갭 (2026-06-05): `size.paddingX ?? 0` — text-bearing box type
    //   (Button/ToggleButton/Badge 등)은 componentRulesTable.sizes.paddingX 가 의도된 x 를 제공하고,
    //   inline text leaf(Text/Heading/Label/Description, paddingX 의미상 0)는 rule 에 paddingX 미정의 →
    //   `?? 0` 으로 left 정렬 x=0 확정. **Why**: 미정의 시 parsePxValue 가 undefined 반환 → 하류
    //   nodeRendererText `paddingLeft + textIndent` 가 NaN 전파 → drawX=NaN → 텍스트 미표시.
    //   본 `?? 0` 은 NaN 방지 안전장치이며 데이터 보강(rule paddingX)을 대체하지 않는다 — box type 의
    //   비-0 paddingX 는 rule 데이터가 제공하고, 0 fallback 은 inline text 의 올바른 값일 뿐.
    const paddingX =
      parsePxValue(
        style?.paddingLeft ?? style?.paddingRight ?? style?.padding,
        size.paddingX ?? 0,
      ) + resolveTreeIndent(props, size);
    const fontSize = resolveSpecFontSize(
      (style?.fontSize as string | number | undefined) ?? size.fontSize,
      16,
    );
    // leading icon (ADR-912 (B+icon)): visual.leadingIcon 존재 시 text 를 icon 폭 + gap 만큼
    //   우측 shift (icon 은 leading_icon skiaPrimitive 가 좌측 paddingX 에 그림 — text 중복 없음).
    //   컴포넌트별 if 아님 — visual.leadingIcon 데이터 유무로만 분기(ADR-142 §3). icon glyph 크기 =
    //   size.iconSize(rule, size 별). 미정의 시 fontSize*1.1 fallback(leading_icon module 과 동형).
    //   `nameProp`(행 데이터 게이팅, 2026-08-21): glyph 이름을 props 에서 읽는 rule 은 그 값이
    //   비어 있으면 **shift 도 하지 않는다** — 아이콘 없는 chip 까지 좌측 여백이 생기면 폭이
    //   어긋난다(Tag chip 은 fit-content 라 폭 = 시각). leading_icon module 의 게이팅과 동일 식.
    //   `leadingAvatar`(2026-08-21): 같은 좌측 슬롯의 이미지 표현. avatar 가 우선이고
    //   폭도 avatar 기준(지름 + gap) — 판정은 `resolveLeadingSlot` 단일 helper.
    const leadingSlot = resolveLeadingSlot(visual, props, size, fontSize);
    //   selection checkbox(2026-08-21)는 leading 슬롯 **앞**에 서므로 폭이 가산된다 —
    //   DOM Tree 행 실측 `checkbox(8..28) → chevron(30..46) → label(52)` 과 같은 누적.
    const selectionSlot = resolveSelectionSlot(visual, props);
    const leadingIconWidth =
      (selectionSlot?.width ?? 0) + (leadingSlot?.width ?? 0);
    const textX = paddingX + leadingIconWidth;
    // font-weight: 사용자 style 우선, 없으면 visual.textWeight(variant 시각 — DropZone 400 등),
    // 최종 fallback 500. textWeight 는 보편 D3 속성(CSS font-weight 동형).
    const fwRaw = style?.fontWeight;
    const fw =
      fwRaw != null
        ? typeof fwRaw === "number"
          ? fwRaw
          : parseInt(String(fwRaw), 10) || 500
        : (visual?.textWeight ?? 500);
    // font-family: 사용자 style 우선, 없으면 visual.fontFamily(variant 시각 — Code/Kbd mono),
    // 최종 fallback sans. fontFamily 는 보편 D3 속성(CSS font-family 동형, textWeight 와 동형 패턴).
    const ff =
      (style?.fontFamily as string) || visual?.fontFamily || fontFamily.sans;

    // inline text leaf (size.height===0, 예: Link/TEXT_LEAF/Label) 는 top/left, box 는 middle/center.
    // ADR-912 선행-6(2026-06-04): align/baseline 판정은 **보이는(opaque) 배경** 기준이어야 한다.
    //   `hasVisibleBg`(box 그리기 게이트)는 `{color.transparent}` fill 도 true(레이아웃 box 보존)
    //   라서, 그대로 쓰면 transparent-fill inline text leaf(TEXT_LEAF/Label)가 box 로 오판되어
    //   align center/baseline middle drift(spec render.shapes 는 left/top|middle). bgColor 가
    //   transparent 토큰이거나 fill.alpha===0 이면 시각상 배경 없음 → inline 으로 간주.
    //   box 그리기 자체(L141 hasVisibleBg)는 미변경 → transparent 레이아웃 box(컨테이너) 회귀 0.
    // box archetype 판정은 **rule 기반** 배경(stateBg)/테두리로만 한다 — 사용자가 inline text
    //   leaf(Text/Heading/Label 등, size.height===0)에 추가한 배경(fills → style.backgroundColor)은
    //   box archetype 신호가 아니다. DOM `<span>` 에 background 를 줘도 inline flow 라 text-align
    //   left / vertical top 을 유지하므로 Skia 도 동일해야 parity(2026-07-21 사용자 보고: Text 에
    //   배경색 추가 시 텍스트가 center/middle 로 오정렬). box archetype(Button/Badge 등)은 rule
    //   변형 fill 이 opaque(stateBg ≠ transparent)이거나 border 를 가져 그대로 center/middle 로
    //   가고, height>0 box 는 아래 size.height 조건이 이미 center 로 보낸다. 이전 `bgColor` 기반
    //   판정은 bgColor 가 style.backgroundColor(user)를 흡수(L182)해 text leaf 를 box 로 오판했다.
    const hasOpaqueBg =
      (stateBg != null &&
        stateBg !== "{color.transparent}" &&
        (fill?.alpha ?? 1) !== 0) ||
      !!borderColor;
    const isInlineText = size.height === 0 && !hasOpaqueBg;
    // 정렬 우선순위: 사용자 명시 style.textAlign > rule 명시 visual.textAlign > leadingIcon left >
    //   input field placeholder left > inline/box 기본.
    // - leading icon (ADR-912 (B+icon)): icon 옆 text 는 항상 left-align(box 기본 center 가 아님).
    //   DisclosureHeader 처럼 transparent box(height>0) 라도 leading icon 동반 text 는 좌측 정렬.
    // - visual.textAlign (2026-06-18): rule entry 가 명시적으로 정렬을 줄 수 있는 경로(미래 확장 대비).
    //   resolveSkiaVisualRule:56 이 v.textAlign 을 visual 로 전달 — 본 우선순위 추가가 소비 경로 연결.
    // - props.placeholder (2026-06-18): input field value/placeholder text(Input/SelectValue/TextField/
    //   SearchField/TextArea/Select/ComboBox/DatePicker)는 box(height>0 + opaque bg/border 또는
    //   variant 없는 shell)라 isInlineText=false → 기본 center 로 오정렬됐다. DOM `<input>`/
    //   `.react-aria-SelectValue`(starter Select.css `text-align: start`)는 좌측 정렬이 parity.
    //   `props.placeholder != null` = "사용자 입력값을 표시하는 field leaf" 의 데이터 신호 — placeholder
    //   는 정확히 input field 군 binding 만 accepts(Button/Badge/Tag/CalendarHeader/Pagination 등 center
    //   가 맞는 box 는 placeholder 미보유 → 오염 0). 컴포넌트 식별 if 아님(ADR-142 §3 — 데이터 분기).
    //   TextField 는 variants:{} 라 visual=undefined → visual.textAlign 경로로는 못 잡음, placeholder
    //   신호가 단일 진입점.
    const textAlign =
      (style?.textAlign as "left" | "center" | "right") ||
      visual?.textAlign ||
      (leadingSlot || selectionSlot
        ? "left"
        : props.placeholder != null
          ? "left"
          : isInlineText
            ? "left"
            : "center");

    // underline 등 text-decoration 은 caller 가 rule 메타로 주입(Link.spec composition
    // rootSelectors text-decoration 의 거울). spec 직접 읽기 제거(#8).

    // line-height: rule size.lineHeight(TokenRef 또는 px) 를 그대로 전달 — Skia 경로는
    //   specShapeConverter, layout 측정 경로는 resolveShapeLineHeight 가 resolve.
    //   **TEXT_LEAF(height=0) catalog 전환 필수**: 미전달 시 measure 가 fontSize*1.5 fallback
    //   으로 떨어져 size 별 typography lineHeight 와 drift(예: text-base 24 vs 16*1.5=24 우연
    //   일치, text-xs 16 vs 18 drift). render.shapes 의 `lineHeight: size.lineHeight` 와 동형.
    //   box형(height>0)은 TEXT_LEAF_TAGS 비멤버라 measure 경로 비진입 → 측정 무영향(Skia 정렬만 동일).
    const lineHeightVal = (size as { lineHeight?: unknown }).lineHeight;

    shapes.push({
      type: "text",
      x: textX,
      y: 0,
      text,
      fontSize,
      fontFamily: ff,
      fontWeight: fw,
      fill: textColor,
      align: textAlign,
      baseline: isInlineText ? "top" : "middle",
      ...(lineHeightVal != null
        ? { lineHeight: lineHeightVal as unknown as number }
        : {}),
      ...(textDecoration ? { textDecoration } : {}),
    });

    // trailing icon (ADR-912 영역 B (A) Tag remove X): visual.trailingIcon 데이터로 text 우측에
    //   icon_font glyph 를 덧그린다 (Tag.spec 의 X line×2 직접 그리기를 Lucide "x" glyph 로 교체 —
    //   SearchField clear / DOM Button slot=remove 와 동일 icon 데이터). 컴포넌트별 if 아님 — 가시성
    //   조건도 데이터(ti.showProp: 어떤 boolean prop 이 true 일 때 그릴지)로 표현 → generic 렌더러는
    //   Tag 전용 prop 이름("allowsRemoving")을 모름(ADR-142 §3 — 컴포넌트 식별 분기 금지). showProp
    //   미지정 시 항상 그림(leading_icon 동형). 위치: _containerWidth(CONTAINER_DIMENSION 주입) 우측
    //   절대 배치 — 미주입(non-CONTAINER_DIMENSION_TAGS) 시 text 우측 측정 fallback.
    const ti = visual?.trailingIcon;
    if (ti && (!ti.showProp || props[ti.showProp] === true)) {
      const tiGap = ti.gap ?? 2;
      const iconSize =
        typeof size.iconSize === "number" && size.iconSize > 0
          ? size.iconSize
          : Math.round(fontSize * 0.75);
      const containerWidth =
        typeof props._containerWidth === "number" ? props._containerWidth : 0;
      const containerHeight =
        typeof props._containerHeight === "number"
          ? props._containerHeight
          : typeof size.height === "number" && size.height > 0
            ? size.height
            : fontSize + 8;
      // trailing icon 우측 여백 = **paddingY + insetRight**. trailing icon 이 chip 우측을 차지하는
      //   컴포넌트(Tag remove X)는 CSS 실측(md chip 94px)상 icon 우측 → chip 경계 = 7px =
      //   paddingY(4) + remove버튼 padding(2) + chip border(1). paddingY 는 상하 여백과 대칭이고,
      //   나머지 3px(remove버튼 padding + border)은 rule 데이터 `trailingIcon.insetRight` 로 표현
      //   (Tag=3). 구 `size.paddingX`(md 12)는 X 를 안쪽으로 당겨 label 침범, paddingY(4) 단독은
      //   CSS 7px 보다 작아 X 가 우측 경계에 붙음(사용자 관찰 2026-07-02). 사용자 명시 style.paddingRight
      //   는 존중. 컴포넌트 식별 if 아님 — trailingIcon 데이터로 진입한 블록의 우측 여백 규칙(ADR-142 §3).
      const insetRight = typeof ti.insetRight === "number" ? ti.insetRight : 0;
      const paddingRight =
        parsePxValue(
          style?.paddingRight ?? style?.padding,
          size.paddingY ?? size.paddingX ?? 0,
        ) + (style?.paddingRight != null ? 0 : insetRight);
      // icon 중앙 x: container width 있으면 우측 절대(우측 여백 = paddingY + insetRight), 없으면
      //   text 우측(측정 기반) fallback. 두 경로 모두 layout 모델(text | iconGap | glyph | 우측여백)과 정합.
      const iconCx =
        containerWidth > 0
          ? containerWidth - paddingRight - iconSize / 2
          : textX +
            measureSpecTextWidth(text, fontSize, ff) +
            tiGap +
            iconSize / 2;
      shapes.push({
        type: "icon_font",
        iconName: ti.name,
        x: iconCx,
        y: containerHeight / 2,
        fontSize: iconSize,
        fill: ti.color ?? textColor,
        strokeWidth: 2,
      });
    }
  }

  return shapes;
}
