/**
 * CSS Generation Script
 *
 * 모든 Component Spec에서 CSS 파일 생성
 *
 * Usage: pnpm generate:css
 */

import { generateAllCSS } from "../src/renderers/CSSGenerator";
import type { ComponentVisualRule } from "../src/renderers/utils/resolveComponentVisual";
import type { ComponentSpec } from "../src/types";
import {
  validateDelegationPrefixes,
  formatViolations,
} from "../src/runtime/validateDelegationPrefixes";
// ADR-912 ②-6-A (1A-(a)): DOM variant 색상 base source = 정본 table (Skia 와 same-source).
//   build script 는 패키지 경계 밖이라 shared 의 정본 table 을 직접 import 할 수 있다(과거 generate-rules.ts
//   도 같은 경계 외 직접 import 패턴이었고 단계 5 step 3 에서 삭제됨 — 본 generate-css 가 그 직접 import 패턴 유지).
import {
  getComponentRulesTable,
  type ComponentRuleVariant,
} from "../../shared/src/index";
import type { SizeSpec, VariantSpec } from "../src/types";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMPONENTS_DIR = path.join(__dirname, "../src/components");
const OUTPUT_DIR = path.join(
  __dirname,
  "../../shared/src/components/styles/generated",
);

/**
 * shared ComponentRuleVariant(string) → specs ComponentVisualRule(TokenRef). 런타임 동형 캐스팅.
 * (builder 의 ruleVariantToVisual 과 동일 로직 — 패키지 경계상 builder import 불가라 build script 에 복제.
 *  단계 5 에서 spec seam 제거 후 shared hoisting 통합 검토.)
 */
function ruleVariantToVisual(v: ComponentRuleVariant): ComponentVisualRule {
  const c = v.colors ?? {};
  return {
    fill: v.fill as unknown as ComponentVisualRule["fill"],
    text: c.text as ComponentVisualRule["text"],
    textHover: c.textHover as ComponentVisualRule["textHover"],
    textWeight: v.textWeight,
    border: c.border as ComponentVisualRule["border"],
    borderHover: c.borderHover as ComponentVisualRule["borderHover"],
    borderStyle: v.borderStyle,
    outlineText: c.outlineText as ComponentVisualRule["outlineText"],
    outlineBorder: c.outlineBorder as ComponentVisualRule["outlineBorder"],
    subtleText: c.subtleText as ComponentVisualRule["subtleText"],
    selectedText: c.selectedText as ComponentVisualRule["selectedText"],
    selectedBorder: c.selectedBorder as ComponentVisualRule["selectedBorder"],
    emphasizedSelectedText:
      c.emphasizedSelectedText as ComponentVisualRule["emphasizedSelectedText"],
    emphasizedSelectedBorder:
      c.emphasizedSelectedBorder as ComponentVisualRule["emphasizedSelectedBorder"],
  };
}

/**
 * 컴포넌트 type → { variantName: ComponentVisualRule } 맵 (정본 table 파생). rule 미존재(컨테이너 shell
 * 등)면 undefined → generateCSS 가 spec fallback.
 */
function variantSourceFor(
  specName: string,
): Record<string, ComponentVisualRule> | undefined {
  const rule = getComponentRulesTable()[specName];
  if (!rule || !rule.variants) return undefined;
  const map: Record<string, ComponentVisualRule> = {};
  for (const [name, variant] of Object.entries(rule.variants)) {
    map[name] = ruleVariantToVisual(variant);
  }
  return map;
}

// ─── TEXT_LEAF virtual spec 합성 ─────────────────────────────────────────────
//
// ADR-912 단계5 step4: TEXT_LEAF 5개(Text/Heading/Paragraph/Code/Kbd) spec 파일을 삭제하기 전에
// spec 없이도 동일한 CSS 가 재생성되도록 rule+메타상수에서 virtual ComponentSpec input 을 합성한다.
//
// - 메타상수: name / archetype / element(placeholder) / containerStyles / cssEmitMode
// - sizes / variants / defaultVariant / defaultSize: getComponentRulesTable() 에서 읽어 변환
// - generateCSS 본체 로직 불변 — 입력 모양만 ComponentSpec 과 동형
//
// ComponentRuleSize → SizeSpec 변환: ComponentRuleSize 는 모두 optional 이므로
// 누락 필드(paddingX/paddingY/height/fontSize/borderRadius)를 0/"" 기본값으로 채워
// `as unknown as SizeSpec` 동형 캐스팅(builder 의 ruleSizeToSizeSpec 과 동일 패턴).

/**
 * ComponentRuleSize → SizeSpec 변환 (TEXT_LEAF 용).
 * paddingX/paddingY/height/fontSize/borderRadius 필수 필드를 기본값으로 채워 캐스팅.
 */
function ruleSizeToSizeSpec(
  s: Record<string, unknown>,
  paddingX = 0,
  paddingY = 0,
): SizeSpec {
  return {
    height: (s.height as number) ?? 0,
    paddingX: (s.paddingX as number) ?? paddingX,
    paddingY: (s.paddingY as number) ?? paddingY,
    fontSize:
      (s.fontSize as SizeSpec["fontSize"]) ?? ("" as SizeSpec["fontSize"]),
    borderRadius:
      (s.borderRadius as SizeSpec["borderRadius"]) ??
      ("" as SizeSpec["borderRadius"]),
    ...(s.lineHeight !== undefined
      ? { lineHeight: s.lineHeight as SizeSpec["lineHeight"] }
      : {}),
    ...(s.borderWidth !== undefined
      ? { borderWidth: s.borderWidth as number }
      : {}),
    ...(s.gap !== undefined ? { gap: s.gap as number } : {}),
    // ADR-912 collection item leaf (2026-06-14): ListBoxItem 의 `min-height` (virtual/short 콘텐츠
    //   축소 하한, line-box 최소) 가 rule.sizes.minHeight 에서 emit 되도록 변환에 포함. 미정의 leaf 는 미emit.
    ...(s.minHeight !== undefined ? { minHeight: s.minHeight as number } : {}),
    // ADR-912 collection item leaf (2026-06-14): ListBoxItem label `font-weight: 600` (semibold)
    //   가 rule.sizes.fontWeight 에서 emit 되도록 변환에 포함. 미정의 leaf 는 미emit (CSSGenerator
    //   가 size.fontWeight 미존재 시 font-weight 줄 자체를 skip).
    ...(s.fontWeight !== undefined
      ? { fontWeight: s.fontWeight as number }
      : {}),
    // ADR-912 box+text leaf 군 (2026-06-11): Button/ToggleButton/Icon 의 --icon-size/--icon-gap
    //   CSS 변수가 rule.sizes.iconSize/iconGap 에서 emit 되도록 변환에 포함. 미정의 leaf 는 미emit.
    ...(s.iconSize !== undefined ? { iconSize: s.iconSize as number } : {}),
    ...(s.iconGap !== undefined ? { iconGap: s.iconGap as number } : {}),
  } as SizeSpec;
}

/**
 * ComponentRuleVariant → VariantSpec 변환 (TEXT_LEAF 용).
 * variantSourceFor 가 이미 색상을 override 하므로, 순회 키 + fill 구조만 맞추면 됨.
 */
function ruleVariantToVariantSpec(v: ComponentRuleVariant): VariantSpec {
  return {
    fill: v.fill as unknown as VariantSpec["fill"],
    text: (v.colors?.text ?? "{color.neutral}") as VariantSpec["text"],
    ...(v.colors?.border !== undefined
      ? { border: v.colors.border as VariantSpec["border"] }
      : {}),
  } as VariantSpec;
}

/**
 * TEXT_LEAF 메타상수 — CSS 생성에 필요한 최소 정보만.
 * (name / archetype / element placeholder / containerStyles)
 */
// catalog virtual CSS 군 — spec 삭제 후 rule+메타 virtual input 으로 CSS 재생성.
// TEXT_LEAF(Text/Heading/Paragraph/Code/Kbd, step4) + field/form box+text leaf(Description/FieldError, step5)
//   + Link(box+text, underline composition) + ProgressCircle(progress archetype, virtual 일반화 proof).
// shape 모양으로 묶은 동형 변환 — 컴포넌트 이름이 아니라 변환 패턴(archetype) 단위.
// ADR-912 generate-css virtual 일반화(2026-06-09): TEXT_LEAF(text/simple/button archetype) →
//   progress archetype 확장. ARCHETYPE_BASE_STYLES["progress"] 가 grid-template-areas/.bar/[slot=value]
//   를 자동 emit 하므로 composition 메타 없이 archetype 값만 맞추면 CSS 재생성됨.
const TEXT_LEAF_NAMES = new Set([
  "Text",
  "Heading",
  "Paragraph",
  "Code",
  "Kbd",
  "Description",
  "FieldError",
  "Link",
  "ProgressCircle",
  "ProgressBarTrack",
  "MeterTrack",
  "SliderTrack",
  "Nav",
  // ADR-912 box+text leaf 군 일괄 (2026-06-11): catalog 발효 완료 leaf 8개 중 CSS 생성 7개.
  //   Label 은 skipCSSGeneration:true (base.css --label-font-size 상속 보존) → virtual 불요.
  "Button",
  "ToggleButton",
  "Badge",
  "Separator",
  "Skeleton",
  "Icon",
  "StatusLight",
  "TabPanel",
  "TabPanels",
  "MenuItem",
  // ADR-912 value-label 군 (2026-06-11): Meter/ProgressBar/Slider 의 value text leaf.
  //   MeterValue/ProgressBarValue = progress archetype(grid label/value/track),
  //   SliderOutput = simple archetype. 부모가 children=formatted value 주입,
  //   자식이 buildCatalogShapes text 로 그림. spec 삭제 대상.
  "MeterValue",
  "ProgressBarValue",
  "SliderOutput",
  // ADR-912 6 registry collapse — Color leaf box-only cutover (2026-06-11): ColorSwatch/TailSwatch 는
  //   skipCSSGeneration:false (simple archetype, generated CSS source). spec 삭제 후에도 DOM CSS 가
  //   사라지지 않도록 catalog rule(COMPONENT_RULES_TABLE) 기반 virtual 로 재생성. ColorArea/Wheel/
  //   Slider 는 skipCSSGeneration:true (Skia 전용 gradient/circle) → CSS 미생성이라 virtual 불요.
  "ColorSwatch",
  "TailSwatch",
  // ADR-912 collection item leaf cutover (2026-06-14): ListBoxItem 은 ListBox.spec childSpecs 경로로
  //   `generated/ListBox.css` 에 inline emit 됐으나(ADR-078), catalog cutover(listbox_item escape)로
  //   spec body 삭제 대비 → 독립 `generated/ListBoxItem.css` virtual 로 분리(MenuItem 선례 동형, flat
  //   selector 라 시각 동일). ListBox.spec.childSpecs 는 [HeaderSpec] 만 유지(Header 는 삭제 대상 아님).
  "ListBoxItem",
  // ADR-912 childSpec→catalog cutover (2026-06-15): DialogFooter 는 Dialog.spec childSpecs 경로로
  //   `generated/Dialog.css` 에 inline embed(ADR-078) 됐으나, catalog cutover 로 spec body 삭제 대비
  //   → 독립 `generated/DialogFooter.css` virtual 로 분리(ListBoxItem 선례 동형, flat selector 라 시각
  //   동일). Dialog.spec.childSpecs 제거(DialogFooter 가 유일 멤버) → Dialog.css embedded 블록 사라짐.
  "DialogFooter",
  // ADR-912 childSpec→catalog cutover (2026-06-15): FormField 는 Form.spec childSpecs 경로로
  //   `generated/Form.css` 에 inline embed(ADR-078, embedMode 가 skipCSSGeneration:true 우회) 됐으나,
  //   catalog cutover 로 spec body 삭제 대비 → 독립 `generated/FormField.css` virtual 로 분리
  //   (DialogFooter 선례 동형, flat selector 라 시각 동일). Form.spec.childSpecs 제거(FormField 가
  //   유일 멤버) → Form.css embedded 블록 사라짐.
  "FormField",
  // ADR-912 childSpec→catalog cutover (2026-06-15): Card 4 자식 슬롯 컨테이너 일괄. 각 spec 은
  //   Card.spec childSpecs 경로로 `generated/Card.css` 에 inline embed 됐으나, catalog cutover 로
  //   spec body 삭제 대비 → 독립 `generated/{CardHeader,CardContent,CardFooter,CardPreview}.css`
  //   virtual 로 분리(FormField/DialogFooter 선례 동형). Card.spec.childSpecs 제거(4 자식 전부) →
  //   Card.css embedded 블록 사라짐. layout(display/flexDirection/width)은 containerStyles meta 로
  //   DOM base emit + factory props.style 가 Skia/Taffy SSOT.
  "CardHeader",
  "CardContent",
  "CardFooter",
  "CardPreview",
  // ADR-912 R6 (2026-06-15): Card 본체 S2 재설계 cutover. Card.spec(skipCSSGeneration:false → 자체
  //   `generated/Card.css`)을 삭제하므로 catalog rule(COMPONENT_RULES_TABLE.Card, variants 4종 fill)
  //   기반 virtual 로 재생성 — 자식과 달리 본체는 embed 가 아니라 독립 Card.css 였음. virtual 출력은
  //   기존 Card.css 보다 풍부(variant 별 [data-variant] 배경 emit) — 구 spec 은 variant 부재였으므로
  //   diff≠0 이 정본(catalog rule SSOT 정정, feedback-css-rule-virtual-input-not-fixture).
  "Card",
  // ADR-912 R7 G1-a (2026-06-15): AvatarGroup 컨테이너 전환. spec.render.shapes=()=>[] (Skia 0,
  //   자식 Avatar 가 self-draw) + skipCSSGeneration:false → 자체 `generated/AvatarGroup.css` (archetype
  //   default 컨테이너 base + variant transparent + size height/border-radius). catalog rule
  //   (COMPONENT_RULES_TABLE.AvatarGroup) 기반 virtual 로 재생성. layout(flex row)은 factory props.style
  //   SSOT (Skia/Taffy 직접 read, ADR-907 Layer B). Card 본체(R6) 동형 — archetype default 컨테이너.
  "AvatarGroup",
  // ADR-912 R7 G1-b (2026-06-15): CardView 컨테이너 전환 (AvatarGroup R7 G1-a 동형 — archetype default
  //   빈 셸). spec.render.shapes=()=>[] (Skia 0) — 자식 Card 가 self-draw. variant 1종(transparent),
  //   sizes sm/md/lg(borderRadius 0, height auto, gap). layout(grid/columns)은 factory props.style SSOT.
  //   catalog rule(COMPONENT_RULES_TABLE.CardView) 기반 virtual. 시각 분기 부재 → diff 0 예상.
  "CardView",
  // ADR-912 R7 G1-b (2026-06-15): TableView 컨테이너 전환. spec.render.shapes 는 roundRect(bg)+border 2
  //   shape 를 실제 렌더하나, 그 시각값(default: layer-1 fill + 1px border / quiet: transparent +
  //   transparent border)이 catalog rule variants(default/quiet) 로 이미 표현됨 → archetype default 가
  //   [data-variant] 별 배경/border 자동 emit. isQuiet boolean 은 `variant: "quiet"` 로 흡수(S2 정본
  //   variant 모델, feedback-catalog-unrepresentable-is-nonstandard-variant). layout 은 factory props.style
  //   SSOT. virtual 출력 vs 기존 TableView.css 동형(2 variant + border + radius.md) → diff 0 예상.
  "TableView",
]);

type TextLeafMeta = {
  name: string;
  archetype: ComponentSpec<unknown>["archetype"];
  element: string;
  containerStyles: ComponentSpec<unknown>["containerStyles"];
  /**
   * CSS emit 모드 (rule 에 없는 구조 정보). Button/ToggleButton 의 `"button-base"` 처럼
   * variant 색을 `--button-color` 변수 + `.button-base` utility color-mix 자동 파생으로
   * emit 하는 군은 명시. 미설정 시 `"direct"`(CSSGenerator 기본 — Link 처럼 background/color
   * 직접 emit).
   */
  cssEmitMode?: ComponentSpec<unknown>["cssEmitMode"];
  /**
   * CSS selector 메타 (rule 에 없는 구조 정보). Link 의 underline 처럼 rootSelectors 기반
   * text-decoration 등 — virtualSpec.composition 으로 전달되어 CSSGenerator 가 emit.
   */
  composition?: ComponentSpec<unknown>["composition"];
  /**
   * states 메타 (rule 에 없는 상태별 CSS). 미설정 시 기본
   * `{ disabled: { opacity: 0.38 } }` (text/simple leaf 공통). ProgressBarTrack 처럼
   * `pointerEvents: "none"` 등 추가 disabled 속성이 필요한 군은 명시.
   */
  states?: ComponentSpec<unknown>["states"];
};

const TEXT_LEAF_META: TextLeafMeta[] = [
  {
    name: "Text",
    archetype: "text",
    element: "p",
    containerStyles: { display: "block", width: "100%" },
  },
  {
    name: "Heading",
    archetype: "text",
    element: "p", // element 는 CSS selector 생성에 미사용 — name 기반. placeholder.
    containerStyles: { display: "block", width: "100%" },
  },
  {
    name: "Paragraph",
    archetype: "text",
    element: "p",
    containerStyles: { display: "block", width: "100%" },
  },
  {
    name: "Code",
    archetype: "simple",
    element: "code",
    containerStyles: { display: "inline-flex", alignItems: "center" },
  },
  {
    name: "Kbd",
    archetype: "simple",
    element: "kbd",
    containerStyles: { display: "inline-flex", alignItems: "center" },
  },
  // ADR-912 단계5 step5 — field/form box+text leaf (Description.spec.ts / FieldError.spec.ts 삭제 대상)
  {
    name: "Description",
    archetype: "text",
    element: "span", // RAC <Text slot="description"> → span
    containerStyles: { display: "block", width: "100%" },
  },
  {
    name: "FieldError",
    archetype: "simple",
    element: "span", // RAC <Text slot="errorMessage"> → span
    containerStyles: { display: "inline-flex", alignItems: "center" },
  },
  // ADR-912 단계5 step5 — Link box+text leaf (Link.spec.ts 삭제 대상).
  //   underline 은 rule 에 없는 CSS selector 구조 → composition.rootSelectors 메타로 전달.
  //   (Skia 는 catalog rule textDecoration:"underline" 으로 재현 — 이미 land)
  {
    name: "Link",
    archetype: "button",
    element: "a",
    containerStyles: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "fit-content",
    },
    composition: {
      rootSelectors: {
        "&": {
          styles: { "text-decoration": "underline" },
        },
        "&[data-hovered]": {
          styles: { "text-decoration-thickness": "1.5px" },
        },
      },
      delegation: [],
    },
  },
  // ADR-912 generate-css virtual 일반화 proof — ProgressCircle (progress archetype, ProgressCircle.spec.ts 삭제 대상).
  //   value-fill 군의 progress archetype 확장 첫 사례. composition 불요 —
  //   ARCHETYPE_BASE_STYLES["progress"](grid-template-areas/.bar/[slot=value])가 자동 emit.
  //   diameter/strokeWidth 는 Skia escape(value_fill_arc) + DOM adapter 전용(CSS 미생성)이라 META 불요.
  {
    name: "ProgressCircle",
    archetype: "progress",
    element: "div",
    containerStyles: { display: "grid" },
  },
  // ADR-912 단계5 value-fill-track proof — ProgressBarTrack (progress archetype, ProgressBarTrack.spec.ts 삭제 대상).
  //   catalog 발효 완료(FAMILY_3_CUTOVER) → Skia 는 value_fill_bar escape. DOM CSS 는
  //   ARCHETYPE_BASE_STYLES["progress"] grid 구조 + rule.variants(fill=neutral-subtle).
  //   states 는 disabled 에 pointerEvents:none 가 추가라 meta.states 로 명시.
  {
    name: "ProgressBarTrack",
    archetype: "progress",
    element: "div",
    containerStyles: { display: "grid" },
    states: {
      hover: {},
      pressed: {},
      disabled: { opacity: 0.38, pointerEvents: "none" },
      focusVisible: {},
    },
  },
  // ADR-912 단계5 value-fill-track 동형 확장 — MeterTrack (ProgressBarTrack 와 동일 구조,
  //   MeterTrack.spec.ts 삭제 대상). archetype/element/containerStyles/states 전부 동형.
  //   Skia 는 value_fill_bar escape, DOM 은 ARCHETYPE_BASE_STYLES["progress"] grid 구조.
  {
    name: "MeterTrack",
    archetype: "progress",
    element: "div",
    containerStyles: { display: "grid" },
    states: {
      hover: {},
      pressed: {},
      disabled: { opacity: 0.38, pointerEvents: "none" },
      focusVisible: {},
    },
  },
  // ADR-912 단계5 value-fill-track 확장 — SliderTrack (SliderTrack.spec.ts 삭제 대상).
  //   archetype "slider": ARCHETYPE_BASE_STYLES["slider"] 가 .slider-track-bg/.slider-fill/
  //   .react-aria-SliderThumb 커스텀 마크업 CSS 를 emit (spec 비의존). Skia 는 slider_fill_bar
  //   escape(track+fill+thumb replace). containerStyles 는 gridTemplateAreas 미보유 →
  //   isTrackOwningGridContainer = track leaf 판정 → grid track 행 height 유지(트랙 높이).
  //   position:relative 는 자식 SliderThumb absolute 배치 기준(ADR-089). size 별 trackHeight/
  //   thumbSize 는 부모 Slider.spec.sizes.indicator 에서 generateSliderSizeMetrics 가 생성.
  //   states 는 disabled 에 cursor:not-allowed + pointerEvents:none 추가.
  {
    name: "SliderTrack",
    archetype: "slider",
    element: "div",
    containerStyles: { display: "grid", position: "relative" },
    states: {
      hover: {},
      pressed: {},
      disabled: { opacity: 0.38, cursor: "not-allowed", pointerEvents: "none" },
      focusVisible: {},
    },
  },
  // ADR-912 container shell catalog 완결 — Nav (Nav.spec.ts 삭제 대상).
  //   archetype "default": ARCHETYPE_BASE_STYLES 미정의 → DEFAULT_BASE_STYLES(display:inline-flex
  //   /align-items:center/transition/font-family) emit. underline 류 특수 selector 없어 composition
  //   불요. rule.sizes 의 paddingY/gap(2026-06-11 보강)으로 padding 세로축 + gap 재생성.
  //   Skia 는 이미 spec-free(isCatalogSkiaCutover) generic box. states 는 disabled 에
  //   pointerEvents:none 추가라 meta.states 로 명시(NavSpec.states 미러).
  {
    name: "Nav",
    archetype: "default",
    element: "nav",
    containerStyles: undefined,
    states: {
      hover: {},
      pressed: {},
      disabled: { opacity: 0.38, pointerEvents: "none" },
    },
  },
  // ADR-912 box+text leaf 군 일괄 (2026-06-11) — catalog 발효 완료 leaf 7개 (Label 제외).
  //   shape 동형(box+text/icon) — Text/Link 와 동일 변환 경로. archetype/element/containerStyles
  //   /cssEmitMode 는 각 *.spec.ts 에서 추출. Skia 는 이미 spec-free(isCatalogSkiaCutover 또는
  //   skiaPrimitive escape). 측정은 specTextStyle 가 catalog rule 기반(spec 끊김).
  // Button/ToggleButton: cssEmitMode "button-base" (변수 + .button-base color-mix 파생).
  //   states.pressed.scale:0.95 (press-scale, ADR-140 DD1) — 기본 states 는 scale 미emit 이라 명시.
  {
    name: "Button",
    archetype: "button",
    element: "button",
    cssEmitMode: "button-base",
    containerStyles: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "fit-content",
    },
    states: {
      hover: {},
      pressed: { scale: 0.95 },
      disabled: { opacity: 0.38, cursor: "not-allowed", pointerEvents: "none" },
      focusVisible: { focusRing: "{focus.ring.default}" },
    },
  },
  {
    name: "ToggleButton",
    archetype: "button",
    element: "button",
    cssEmitMode: "button-base",
    containerStyles: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "fit-content",
    },
    states: {
      hover: {},
      pressed: { scale: 0.95 },
      disabled: { opacity: 0.38, cursor: "not-allowed", pointerEvents: "none" },
      focusVisible: { focusRing: "{focus.ring.default}" },
    },
  },
  // Badge/StatusLight: archetype "simple", states = disabled(opacity) 만 (hover/pressed 미emit).
  {
    name: "Badge",
    archetype: "simple",
    element: "span",
    containerStyles: { display: "inline-flex", alignItems: "center" },
    states: { disabled: { opacity: 0.38 } },
  },
  // Separator/Skeleton: states 없음 (spec states:{} — 어떤 data-* 블록도 미emit).
  {
    name: "Separator",
    archetype: "simple",
    element: "hr",
    containerStyles: { display: "inline-flex", alignItems: "center" },
    states: {},
  },
  {
    name: "Skeleton",
    archetype: "simple",
    element: "div",
    containerStyles: { display: "inline-flex", alignItems: "center" },
    states: {},
  },
  // Icon: archetype "simple", states = hover/pressed(빈) + disabled(opacity) + focusVisible(빈).
  {
    name: "Icon",
    archetype: "simple",
    element: "span",
    containerStyles: { display: "inline-flex", alignItems: "center" },
    states: {
      hover: {},
      pressed: {},
      disabled: { opacity: 0.38 },
      focusVisible: {},
    },
  },
  // StatusLight: dot+label leaf. Skia 는 status_light escape(replace). CSS 는 simple archetype
  //   + rule.variants(status 색) — DOM 은 INTERNAL_RENDERERS["statuslight"] 어댑터가 dot+label 마크업.
  //   states = disabled(opacity) 만.
  {
    name: "StatusLight",
    archetype: "simple",
    element: "div",
    containerStyles: { display: "inline-flex", alignItems: "center" },
    states: { disabled: { opacity: 0.38 } },
  },
  // ADR-912 collection catalog 발효 — TabPanel (TabPanel.spec.ts 삭제 대상).
  //   archetype "collection": ARCHETYPE_BASE_STYLES["collection"](display:flex/column/box-sizing)
  //   자동 emit. Skia 는 shapes=[] — spec 시각 0, Taffy padding 정보만. DOM CSS 는
  //   padding(sm=8/md=12/lg=16) + fontSize + borderRadius 가 sizes 에서 emit.
  //   states = disabled(opacity+pointerEvents) + focusVisible(focus-ring).
  //   spec.containerStyles={ display:"flex", flexDirection:"column" } 미러.
  {
    name: "TabPanel",
    archetype: "collection",
    element: "div",
    containerStyles: { display: "flex", flexDirection: "column" },
    // TabPanel.spec.ts states 미러: hover/pressed 미emit (TabPanel 은 클릭/hover 상태 불필요).
    // disabled(opacity+pointerEvents) + focusVisible(focus-ring) 만.
    states: {
      disabled: { opacity: 0.38, pointerEvents: "none" },
      focusVisible: { focusRing: "{focus.ring.default}" },
    },
  },
  // ADR-912 collection catalog 발효 — TabPanels (TabPanels.spec.ts 삭제 대상).
  //   archetype "collection": ARCHETYPE_BASE_STYLES["collection"](display:flex/column/box-sizing)
  //   자동 emit. Skia 는 shapes=[] — spec 시각 0. DOM CSS 는
  //   paddingX/paddingY(sm=8/md=12/lg=16) + fontSize 가 sizes 에서 emit.
  //   spec.containerStyles={ display:"flex", flexDirection:"column" } 미러.
  {
    name: "TabPanels",
    archetype: "collection",
    element: "div",
    containerStyles: { display: "flex", flexDirection: "column" },
    states: {
      disabled: { opacity: 0.38, pointerEvents: "none" },
    },
  },
  // ADR-912 simple catalog 발효 — MenuItem (MenuItem.spec.ts 삭제 대상).
  //   archetype "simple": ARCHETYPE_BASE_STYLES["simple"](display:inline-flex/center/box-sizing)
  //   자동 emit. Skia shapes=[] — CSS 전용. paddingX/paddingY/gap 은 rule sizes 에서 emit.
  //   states = hover(background:{color.layer-1}) + focusVisible(focus-ring) + disabled(opacity+pointerEvents).
  //   spec.containerStyles={ display:"inline-flex", alignItems:"center" } 미러.
  {
    name: "MenuItem",
    archetype: "simple",
    element: "div",
    containerStyles: { display: "inline-flex", alignItems: "center" },
    // MenuItem.spec.ts states 미러: hover(background), focusVisible, disabled.
    states: {
      hover: { background: "{color.layer-1}" },
      focusVisible: { focusRing: "{focus.ring.default}" },
      disabled: { opacity: 0.38, pointerEvents: "none" },
    },
  },
  // ADR-912 collection item leaf cutover (2026-06-14) — ListBoxItem (ListBoxItem.spec.ts 삭제 대상).
  //   archetype "simple": ARCHETYPE_BASE_STYLES["simple"](display:inline-flex/center/box-sizing) 자동 emit.
  //   containerStyles 4키(display:flex/flexDirection:column/alignItems:flex-start/justifyContent:center)가
  //   base override. padding/font/line-height/font-weight/min-height/gap/border-radius 는 rule.sizes.md 에서
  //   emit (min-height 20 = rule 보강분, MenuItem 과 달리 cursor:not-allowed disabled). hover background
  //   {color.layer-1}(→--bg-overlay)는 MenuItem 동형. ListBoxItem.spec.ts states 미러.
  {
    name: "ListBoxItem",
    archetype: "simple",
    element: "div",
    containerStyles: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      justifyContent: "center",
    },
    states: {
      hover: { background: "{color.layer-1}" },
      focusVisible: { focusRing: "{focus.ring.default}" },
      disabled: { opacity: 0.38, cursor: "not-allowed", pointerEvents: "none" },
    },
  },
  // ADR-912 value-label 군 (2026-06-11) — Meter/ProgressBar 의 value text leaf.
  //   progress archetype: ARCHETYPE_BASE_STYLES["progress"](grid label/value/track)가 자동 emit.
  //   variant 4색 transparent bg + text color 는 rule.variants 가 제공(states 메타 불요 —
  //   hover/pressed transparent 는 variant 블록에서 파생). MeterValue/ProgressBarValue.spec.ts 삭제 대상.
  {
    name: "MeterValue",
    archetype: "progress",
    element: "output",
    containerStyles: { display: "grid" },
  },
  {
    name: "ProgressBarValue",
    archetype: "progress",
    element: "output",
    containerStyles: { display: "grid" },
  },
  // SliderOutput — simple archetype(inline-flex). Slider 부모가 명시 자식으로 value 위임.
  //   SliderOutput.spec.ts 삭제 대상.
  {
    name: "SliderOutput",
    archetype: "simple",
    element: "output",
    containerStyles: { display: "inline-flex", alignItems: "center" },
  },
  // ADR-912 6 registry collapse — Color leaf box-only cutover (2026-06-11): ColorSwatch/TailSwatch
  //   (simple archetype, generated CSS source). 동적 색/gradient/wheel/thumb 정교 시각은 빌더 완성
  //   후 ProgressCircle 구조로 복원 — 지금은 box 영역(rule variant fill/border)만. catalog rule
  //   (COMPONENT_RULES_TABLE) 단일 source 파생이라 spec 삭제 후에도 DOM CSS 보존.
  {
    name: "ColorSwatch",
    archetype: "simple",
    element: "div",
    containerStyles: { display: "inline-flex", alignItems: "center" },
    // 원본 ColorSwatch.spec states: disabled pointerEvents:none + focusVisible focusRing.
    states: {
      hover: {},
      pressed: {},
      disabled: { opacity: 0.38, pointerEvents: "none" },
      focusVisible: { focusRing: "{focus.ring.default}" },
    },
  },
  {
    name: "TailSwatch",
    archetype: "simple",
    element: "div",
    containerStyles: { display: "inline-flex", alignItems: "center" },
    // 원본 TailSwatch.spec states: {} (상태 CSS 미emit). 기본 states override 로 빈 처리.
    states: {},
  },
  // ADR-912 childSpec→catalog cutover (2026-06-15) — DialogFooter (DialogFooter.spec.ts 삭제 대상).
  //   archetype "simple": DialogFooter.spec.ts 는 containerStyles 미정의(sizes 만) → undefined →
  //   ARCHETYPE base(inline-flex/align-items/box-sizing)만 emit(Code 처럼 containerStyles 중복 라인
  //   없음). states 미설정 → 기본 focus-visible(outline) + disabled(opacity/cursor/pointer-events) emit
  //   — DialogFooterSpec.states.focusVisible + CSSGenerator 기본 disabled 와 동형. Dialog.css embedded
  //   블록(ADR-078)과 flat selector 시각 동일. footer layout(flex/gap)은 factory props.style SSOT
  //   (rule sizes 의 gap/padding=0 은 base fallback). Skia 는 catalog generic box shell(투명 — fill 없음).
  {
    name: "DialogFooter",
    archetype: "simple",
    element: "div",
    containerStyles: undefined,
  },
  // ADR-912 childSpec→catalog cutover (2026-06-15) — FormField (FormField.spec.ts 삭제 대상,
  //   DialogFooter 동형). archetype "simple": FormField.spec.ts 는 containerStyles 미정의(sizes 만)
  //   → undefined → ARCHETYPE base(inline-flex/align-items/box-sizing)만 emit. states 미설정 → 기본
  //   focus-visible(outline) + disabled(opacity/cursor/pointer-events) emit — FormFieldSpec.states.
  //   focusVisible + CSSGenerator 기본 disabled 와 동형. Form.css embedded 블록(ADR-078)과 flat
  //   selector 시각 동일. 필드 그룹 layout(flex column/gap)은 factory props.style SSOT(rule sizes 의
  //   gap/padding=0 은 base fallback). Skia 는 catalog generic box shell(투명 — fill 없음).
  {
    name: "FormField",
    archetype: "simple",
    element: "div",
    containerStyles: undefined,
  },
  // ADR-912 childSpec→catalog cutover (2026-06-15) — Card 4 자식 (Card{Header,Content,Footer,Preview}
  //   .spec.ts 삭제 대상, FormField/DialogFooter 동형). FormField 와 달리 spec 원본에 containerStyles
  //   (display/flexDirection/alignItems/justifyContent/width)가 있었으므로 meta 에 명시 → virtual CSS
  //   가 DOM base layout 을 emit(Card.css embedded 블록과 동일). 단 layout 의 실 SSOT 는 factory
  //   props.style(Skia/Taffy 직접 read, ADR-907 Layer B) — containerStyles 는 DOM base/일관성용.
  //   CardPreview 는 spec 에 containerStyles 미정의였으나 다른 Card 자식과 동일 컨테이너 패턴으로 명시.
  //   states 미설정 → 기본 focus-visible + disabled emit. Skia 는 catalog generic box shell(투명).
  {
    name: "CardHeader",
    archetype: "simple",
    element: "div",
    containerStyles: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
    },
  },
  {
    name: "CardContent",
    archetype: "simple",
    element: "div",
    containerStyles: {
      display: "flex",
      flexDirection: "column",
      width: "100%",
    },
  },
  {
    name: "CardFooter",
    archetype: "simple",
    element: "div",
    containerStyles: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      width: "100%",
    },
  },
  {
    name: "CardPreview",
    archetype: "simple",
    element: "div",
    containerStyles: {
      display: "flex",
      flexDirection: "column",
      width: "100%",
    },
  },
  // ADR-912 R6 (2026-06-15): Card 본체 S2 재설계 cutover. 자식과 달리 본체는 자체 generated/Card.css
  //   였으므로(skipCSSGeneration:false) virtual 로 재생성. archetype "default"(Nav 동형 컨테이너 base).
  //   containerStyles undefined — Card layout(flex column/gap/padding)은 factory props.style SSOT
  //   (ADR-907 Layer B, Skia/Taffy 직접 read). virtual CSS 는 rule variants 4종 → [data-variant] 별
  //   배경 + base archetype 만 emit. 구 Card.css 는 variant 부재 + 버튼형 base 였으므로 diff 발생(정본).
  {
    name: "Card",
    archetype: "default",
    element: "div",
    containerStyles: undefined,
  },
  // ADR-912 R7 G1-a (2026-06-15): AvatarGroup 컨테이너 전환 (Card 본체 R6 동형 — archetype default).
  //   spec.render.shapes=()=>[] (Skia 0) — 자식 Avatar×3 은 factory 자동생성 + self-draw. layout(flex
  //   row/alignItems)은 factory props.style SSOT (ADR-907 Layer B, Skia/Taffy 직접 read) → containerStyles
  //   undefined. virtual CSS 는 rule variants(transparent/alpha 0) + sizes(height/border-radius, padding 0)
  //   + archetype default base(inline-flex/center) emit. states = disabled(opacity 0.38) 만 (spec.states 미러).
  {
    name: "AvatarGroup",
    archetype: "default",
    element: "div",
    containerStyles: undefined,
    states: { disabled: { opacity: 0.38 } },
  },
  // ADR-912 R7 G1-b (2026-06-15): CardView 전환 (AvatarGroup 동형 — archetype default 빈 셸).
  //   spec.render.shapes=()=>[] (Skia 0) — 자식 Card 가 self-draw. layout(grid/columns/gap)은 factory
  //   props.style SSOT → containerStyles undefined. virtual CSS 는 rule variant(transparent) + sizes
  //   (sm/md/lg, borderRadius 0, padding 0) + archetype default base emit.
  //   • catalog rule.sizes 는 gap 미보유 → virtual 이 size별 gap(구 spec 12/16/20) 미emit = ADR-907
  //     Layer B 정본 (container gap 은 factory props.style SSOT, factory CardView.props.style.gap=16).
  //   • states = disabled(opacity 0.38) 만 (AvatarGroup 동형). 미설정 시 virtual 기본 states 가
  //     [data-hovered]{}/[data-pressed]{} 빈 블록 emit → 구 CardView.css(spec.states {} 빈) 와 noise diff.
  {
    name: "CardView",
    archetype: "default",
    element: "div",
    containerStyles: undefined,
    states: { disabled: { opacity: 0.38 } },
  },
  // ADR-912 R7 G1-b (2026-06-15): TableView 전환. spec.render.shapes 는 box+border 를 실제 렌더하나 그
  //   시각값이 catalog rule variants(default: layer-1+border / quiet: transparent+transparent)로 표현됨
  //   → archetype default 가 [data-variant] 배경/border 자동 emit. layout 은 factory props.style SSOT →
  //   containerStyles undefined. states 기본 사용(구 TableView.css [data-disabled] opacity 0.38 와 동일;
  //   spec.states.disabled 의 pointerEvents:none 는 archetype default 표준 disabled 블록이 이미 emit).
  {
    name: "TableView",
    archetype: "default",
    element: "div",
    containerStyles: undefined,
  },
];

/**
 * TEXT_LEAF 5개를 rule+메타 기반으로 virtual ComponentSpec 배열로 합성.
 * spec 파일이 아직 존재하더라도 이 경로를 우선(dedup 은 호출처에서 처리).
 */
function buildTextLeafVirtualSpecs(): ComponentSpec<unknown>[] {
  const table = getComponentRulesTable();
  const result: ComponentSpec<unknown>[] = [];

  for (const meta of TEXT_LEAF_META) {
    const rule = table[meta.name];
    if (!rule) {
      console.warn(`  ⚠ TEXT_LEAF virtual: no rule for ${meta.name}, skipping`);
      continue;
    }

    // sizes: rule.sizes 의 각 entry 를 SizeSpec 으로 변환
    const sizes: Record<string, SizeSpec> = {};
    for (const [sizeName, ruleSize] of Object.entries(rule.sizes)) {
      sizes[sizeName] = ruleSizeToSizeSpec(ruleSize as Record<string, unknown>);
    }

    // variants: rule.variants 의 각 entry 를 VariantSpec 으로 변환
    const variants: Record<string, VariantSpec> = {};
    for (const [variantName, ruleVariant] of Object.entries(rule.variants)) {
      variants[variantName] = ruleVariantToVariantSpec(ruleVariant);
    }

    const virtualSpec: ComponentSpec<unknown> = {
      name: meta.name,
      archetype: meta.archetype,
      element: meta.element as ComponentSpec<unknown>["element"],
      containerStyles: meta.containerStyles,
      defaultVariant: rule.defaultVariant,
      defaultSize: rule.defaultSize ?? "md",
      variants,
      sizes,
      // states: 기본 hover/pressed/disabled(opacity)/focusVisible. meta.states 설정 시 override
      //   (ProgressBarTrack 처럼 disabled 에 pointerEvents:none 추가 필요한 군).
      states: meta.states ?? {
        hover: {},
        pressed: {},
        disabled: { opacity: 0.38 },
        focusVisible: {},
      },
      // cssEmitMode: Button/ToggleButton 의 button-base(변수 + color-mix 파생). 미설정 시 direct.
      ...(meta.cssEmitMode ? { cssEmitMode: meta.cssEmitMode } : {}),
      // composition: rule 에 없는 CSS selector 메타(Link underline 등). 미설정 시 미적용.
      ...(meta.composition ? { composition: meta.composition } : {}),
      render: {
        shapes: () => [],
      },
    };

    result.push(virtualSpec);
    console.log(`  ✓ Synthesized virtual spec: ${meta.name} (from rule table)`);
  }

  return result;
}

async function main(): Promise<void> {
  console.log("🔄 Starting CSS generation...\n");

  try {
    // 출력 디렉토리 생성
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // components 디렉토리에서 모든 .spec.ts 파일 찾기
    const files = await fs.readdir(COMPONENTS_DIR).catch(() => []);
    const specFiles = files.filter((f) => f.endsWith(".spec.ts"));

    if (specFiles.length === 0) {
      console.log("⚠️  No spec files found in", COMPONENTS_DIR);
      console.log("   Spec files will be added in Phase 1");
      return;
    }

    // 각 spec 파일 로드
    // ADR-912 단계5 step4: TEXT_LEAF 5개는 virtual spec 이 우선 — dedup
    const specs: ComponentSpec<unknown>[] = [];

    for (const file of specFiles) {
      // TEXT_LEAF: spec 파일이 아직 존재해도 virtual input 으로 대체 — 파일 스캔 결과에서 제외
      const componentName = file.replace(".spec.ts", "");
      if (TEXT_LEAF_NAMES.has(componentName)) {
        console.log(`  → Skipped (virtual override): ${file}`);
        continue;
      }

      const filePath = path.join(COMPONENTS_DIR, file);
      const module = await import(filePath);

      // default export 또는 *Spec export 찾기
      const specName = file.replace(".spec.ts", "") + "Spec";
      const spec = module.default || module[specName];

      if (spec && typeof spec === "object" && "name" in spec) {
        specs.push(spec as ComponentSpec<unknown>);
        console.log(`  ✓ Loaded: ${file}`);
      } else {
        console.warn(`  ⚠ Skipped: ${file} (no valid spec export)`);
      }
    }

    // TEXT_LEAF virtual specs 추가 (rule+메타 기반 합성)
    const textLeafVirtuals = buildTextLeafVirtualSpecs();
    specs.push(...textLeafVirtuals);

    if (specs.length === 0) {
      console.log("\n⚠️  No valid specs found");
      return;
    }

    // ADR-059 v2 Pre-Phase 0-D: delegation prefix SSOT 검증
    const violations = validateDelegationPrefixes(specs);
    if (violations.length > 0) {
      console.error("\n" + formatViolations(violations));
      process.exit(1);
    }
    console.log(`\n✓ Delegation prefix 검증 통과 (${specs.length} specs)`);

    // CSS 생성
    console.log("\n📝 Generating CSS files...\n");
    await generateAllCSS(specs, OUTPUT_DIR, variantSourceFor);

    console.log(`\n✅ Generated ${specs.length} CSS files in ${OUTPUT_DIR}`);
  } catch (error) {
    console.error("❌ CSS generation failed:", error);
    process.exit(1);
  }
}

main();
