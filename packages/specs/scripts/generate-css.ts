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
    // ADR-912 단계5 step4 (2026-06-16): IllustratedMessage 의 `.alert-heading` 자식 CSS 가
    //   rule.sizes.headingFontSize 에서 emit 되도록 변환에 포함 (CSSGenerator.generateChildFontStyles
    //   가 size.headingFontSize 소비). 미정의 leaf 는 미emit.
    ...(s.headingFontSize !== undefined
      ? { headingFontSize: s.headingFontSize as SizeSpec["headingFontSize"] }
      : {}),
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
 * STRUCTURE_META 엔트리 — rule table 에 없는 "구조 정보"(archetype/element/containerStyles/
 * states/cssEmitMode/composition)만 담는다. 색상/사이즈/variant 는 getComponentRulesTable() 정본.
 *
 * ADR-912 단계5 step4 Phase 0 (2026-06-16): 기존 TextLeafMeta(배열, name 필드 포함) →
 * STRUCTURE_META(Map<name, StructureMeta>) 로 자료구조 전환. name 은 Map key 로 이동.
 * (generate-css 일반화 골격 — virtual emit 집합을 STRUCTURE_META 멤버십이 결정. spec import
 *  경로 56 은 그대로 유지 → 출력 집합 불변 diff 0.)
 */
type StructureMeta = {
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
  /**
   * indicatorMode 메타 (rule 에 없는 selection indicator 구조 — ToggleButtonGroup).
   * CSSGenerator.generateIndicatorModeCSS 가 `[data-indicator="true"]` SelectionIndicator
   * pill 의 위치/box-shadow/transition 을 emit. 색(--button-color/--button-text)은 parent
   * ToggleButton variant CSS 상속(하드코딩)이라 시각값(rule) 아닌 구조 메타로 분류.
   * boxShadow/transitionMs 만 generated CSS 에 반영(fill.base/selectedText/borderRadius 는
   * CSS 미반영). 미설정 시 indicator CSS 미emit.
   */
  indicatorMode?: ComponentSpec<unknown>["indicatorMode"];
};

// 원본 entry 배열 (name 필드 포함) — 아래 STRUCTURE_META Map 으로 파생.
//   ADR-912 Phase 0 (2026-06-16): name 을 Map key 로 옮기되, entry 본문은 보존(diff 0 안전).
const STRUCTURE_META_ENTRIES: (StructureMeta & { name: string })[] = [
  // ADR-912 단계5 step4 Phase 1 batch 1 (2026-06-16) — simple leaf side-blocker 0 (Avatar).
  //   catalog cutover 완료(FAMILY_1) + Skia escape 가 spec 파일 밖(skiaPrimitives.ts avatar primitive,
  //   replace 모드) + layout/text consumer 직접 import 0 → spec 삭제 side blocker 0. render.shapes
  //   (circle bg + image|initials)는 avatar primitive 가 대체하므로 삭제 무관. CSS 는 rule
  //   (COMPONENT_RULES_TABLE.Avatar) variant fill + sizes(fontSize/borderRadius/height)에서 재생성 → diff 0.
  //   archetype simple, states=disabled(opacity) 만 (Badge 동형). composition 불요.
  {
    name: "Avatar",
    archetype: "simple",
    element: "div",
    containerStyles: { display: "inline-flex", alignItems: "center" },
    states: { disabled: { opacity: 0.38 } },
  },
  // ADR-912 단계5 step4 Phase 1 batch 2 (2026-06-16) — simple 컨테이너 (DropZone, _hasChildren).
  //   cutover 완료(FAMILY_6_CUTOVER="catalog", binding 존재, isCatalogCutover true) → Skia 는 이미
  //   spec-free generic box(box+dashed border, skiaPrimitive 없음). render.shapes(bg+border+label)는
  //   삭제 무관. CSS 는 rule(COMPONENT_RULES_TABLE.DropZone) variant fill + sizes(paddingX/paddingY/gap
  //   2026-06-16 보강)에서 재생성 → diff 0.
  //   states = hover(빈) + disabled(opacity+pointerEvents) + focusVisible(focus-ring) (DropZoneSpec.states 미러).
  //   composition.rootSelectors = &[data-drop-target] (drop-target 활성 시 bg→inset/color→accent,
  //   DropZoneSpec.composition 미러 — Link rootSelectors 선례).
  //   layout(padding/gap) 컨테이너 배치 SSOT 는 factory props.style(ADR-907 Layer B — layout 엔진은
  //   rule import 0건). rule.sizes 의 paddingY/gap 은 DOM generated CSS emit 전용(Nav 동형 — 사용자
  //   "Nav 선례 정렬" 결정 2026-06-16).
  {
    name: "DropZone",
    archetype: "simple",
    element: "div",
    containerStyles: { display: "inline-flex", alignItems: "center" },
    states: {
      hover: {},
      disabled: { opacity: 0.38, pointerEvents: "none" },
      focusVisible: { focusRing: "{focus.ring.default}" },
    },
    composition: {
      rootSelectors: {
        "&[data-drop-target]": {
          styles: {
            background: "var(--bg-inset)",
            color: "var(--accent)",
          },
        },
      },
      delegation: [],
    },
  },
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
  // ADR-912 projection 3 catalog cutover (2026-06-15) — Tab (Tab.spec.ts 삭제 대상).
  //   archetype "default": inline-flex/center/center base emit. variant default(transparent bg +
  //   text/textHover)는 rule 파생. sizes(height/paddingX/paddingY/fontSize/borderRadius/fontWeight)는
  //   rule 에서 emit. selected accent indicator 는 수동 TabsIndicator.css 담당(애초 generated 부재) →
  //   virtual 미생성(시각 동일). states = disabled(opacity+pointerEvents) + focusVisible(focus-ring).
  {
    name: "Tab",
    archetype: "default",
    element: "button",
    states: {
      disabled: { opacity: 0.38, pointerEvents: "none" },
      focusVisible: { focusRing: "{focus.ring.default}" },
    },
  },
  // ADR-912 projection 3 catalog cutover (2026-06-15) — TabList (TabList.spec.ts 삭제 대상).
  //   원본 spec 은 composition.layout="flex-row" 보유 → base = COMPOSITION_LAYOUT_STYLES["flex-row"]
  //   (display:flex/flex-direction:row/align-items:center/box-sizing). archetype "default"(DEFAULT_BASE
  //   _STYLES inline-flex)가 아니라 composition base 라 archetype 무관(CSSGenerator:685 composition 우선).
  //   하단/우측 divider 는 tablist_divider escape(Skia) + 수동 TabsIndicator.css(DOM) 담당(애초 generated
  //   부재) → virtual 미생성. sizes(fontSize/borderRadius)는 rule emit. variants 없음(shell).
  {
    name: "TabList",
    archetype: "default",
    element: "div",
    containerStyles: { display: "flex", flexDirection: "row" },
    composition: { layout: "flex-row", delegation: [] },
    states: {
      disabled: { opacity: 0.38, pointerEvents: "none" },
    },
  },
  // ADR-912 projection 3 catalog cutover (2026-06-15) — Breadcrumb (Breadcrumb.spec.ts 삭제 대상).
  //   archetype "simple": inline-flex/center base emit + containerStyles 미러. variant default(base
  //   bg + text/textHover)는 rule 파생. sizes(height/fontSize/borderRadius)는 rule emit. separator(›)는
  //   breadcrumb_crumb escape(Skia) + RAC 보존(DOM, 애초 generated 부재) → virtual 미생성.
  //   states = hover + disabled + focusVisible(spec.states 미러).
  {
    name: "Breadcrumb",
    archetype: "simple",
    element: "li",
    containerStyles: { display: "inline-flex", alignItems: "center" },
    states: {
      hover: {},
      disabled: { opacity: 0.38, pointerEvents: "none" },
      focusVisible: { focusRing: "{focus.ring.default}" },
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
  // ADR-912 R7 G1-c (2026-06-15): Pagination 전환. factory 가 자식 Button×5 자동 생성 → 런타임 항상
  //   _hasChildren=true → spec render.shapes standalone 버튼군 dead, 컨테이너 box(flex row)만 live
  //   (AvatarGroup/CardView/TableView 동형 — 셋 다 SHELL_ONLY 미등록이나 factory 자식 자동생성으로
  //   childElements.length>0 → _hasChildren=true 경로 동일).
  //   • layout(display/flex-direction/gap)은 factory props.style SSOT(ADR-907 Layer B). 구 spec
  //     containerStyles 의 display:flex/flex-direction:column 은 factory props.style.flexDirection:row 가
  //     @layer 위로 덮어 dead 였음 → containerStyles 에서 제외(virtual 미emit = 정본).
  //   • --btn-* CSS 변수 3개는 layout 아니라 자식 Button cascade override(Button.css:18-23 이
  //     var(--btn-radius/--btn-font-size/--btn-transition) 읽음). factory props.style 에 없고 fallback
  //     값(--radius-md/--text-sm/none)과 다르므로(특히 font-size base vs sm) 제거 시 자식 Button 시각
  //     회귀 → containerStyles 에 --btn-* 만 보존(layout 키는 제외).
  //   • staticSelectors: 구 spec composition.staticSelectors 7개(.pagination-controls /
  //     .react-aria-Button[data-current] 활성 페이지 강조 등 자식 Button 대상 descendant CSS)는 box
  //     shell virtual 만으로 누락 → composition.staticSelectors meta 로 전달(Link rootSelectors 선례) →
  //     CSSGenerator emit(generate-css.ts:1540 staticSelectors 경로). virtual = 기존 Pagination.css 동형.
  //   • states = disabled(opacity 0.38) (spec.states.disabled.pointerEvents:none 는 archetype default
  //     표준 disabled 블록이 이미 emit). hover{} 빈 블록 noise 차단 위해 disabled 만 명시.
  {
    name: "Pagination",
    archetype: "default",
    element: "nav",
    containerStyles: undefined,
    states: { disabled: { opacity: 0.38 } },
    composition: {
      // 자식 Button cascade override 변수만 보존 (위 주석 참조). CSSGenerator base styles 경로는
      //   spec.composition 존재 시 spec.composition.containerStyles 를 읽으므로(generate-css 의 top-level
      //   containerStyles 가 아니라) 여기에 배치. layout(display/flex-direction)은 factory props.style SSOT.
      containerStyles: {
        "--btn-radius": "var(--radius-md)",
        "--btn-font-size": "var(--text-base)",
        "--btn-transition": "background-color 200ms, opacity 200ms",
      },
      staticSelectors: {
        ".pagination-controls": {
          display: "flex",
          "align-items": "center",
          gap: "6px",
        },
        ".pagination-info": {
          "font-size": "var(--text-base)",
          color: "var(--fg-muted)",
          "text-align": "center",
        },
        ".pagination-ellipsis": {
          color: "var(--fg-muted)",
        },
        '.react-aria-Button[data-current="true"]': {
          "background-color": "var(--accent)",
          color: "var(--fg-on-accent)",
        },
        '.react-aria-Button:not([data-current="true"])': {
          "background-color": "var(--bg-overlay)",
          color: "var(--fg)",
        },
        '.react-aria-Button:not([data-current="true"]):hover:not(:disabled)': {
          "background-color":
            "color-mix(in srgb, var(--bg-overlay) 92%, black)",
        },
        ".react-aria-Button:disabled": {
          opacity: "0.38",
        },
      },
      delegation: [],
    },
  },
  // ADR-912 R7 G1-c (2026-06-15): Toast 전환. factory 가 Heading/Description 자식 자동 생성 → 런타임
  //   항상 _hasChildren=true → 컨테이너 box(bg+border)만 live (Pagination/CardView 동형, box-shell).
  //   • archetype: alert — Toast = 알림 박스. ARCHETYPE_BASE_STYLES.alert(flex/flex-direction:column/
  //     align-items:flex-start/width:100%/font-family)는 button-like(cursor:pointer/transition:transform)
  //     없이 Toast factory props.style(flex column) 과 정합. 구 spec archetype "overlay"(position:fixed)는
  //     imperative 알림 portal 용 — element 배치 Toast 는 캔버스 일반 흐름이 정상. element="div".
  //   • 좌측 accent bar 제거(RAC 정본): 구 spec 좌측 accent bar(rect 3px)는 RAC 공식 Toast 미준수
  //     변형(react-aria.adobe.com/Toast 는 accent bar 없음) → 제거. composition 미사용 → CSSGenerator
  //     가 variant fill(info/positive/neutral/negative subtle 배경 + border)을 정상 emit(composition 있으면
  //     compositionOwnsContainerBox=true 로 variant emit skip 됨 — Toast 는 컨테이너 자체가 variant 배경 보유).
  //   • layout(display:flex/flex-direction:column/gap)은 factory props.style SSOT(ADR-907 Layer B).
  {
    name: "Toast",
    archetype: "alert",
    element: "div",
    containerStyles: undefined,
    states: { disabled: { opacity: 0.38 } },
  },
  // ADR-912 R7 G1-c (2026-06-15): ButtonGroup 전환 (AvatarGroup/CardView R7 G1-a/b 동형 — archetype
  //   default 투명 컨테이너 셸). spec render.shapes 는 _hasChildren=true 면 빈 shapes, false 면 box(flex)
  //   만 그리던 투명 컨테이너(variant default fill/border 전부 transparent). factory 가 자식 Button×2 를
  //   자동 생성하므로 standalone box 분기는 dead → 자식 Button 이 시각 담당. catalog rule
  //   (COMPONENT_RULES_TABLE.ButtonGroup, variant default transparent + sizes height:0/border-radius)
  //   기반 virtual. layout(flex/gap)은 factory props.style SSOT → containerStyles undefined (gap 미emit).
  //   states 기본(구 ButtonGroup.css [data-disabled] opacity 0.38; spec.states.disabled.pointerEvents:none
  //   는 archetype default 표준 disabled 블록이 이미 emit). composition 불요(자식 descendant CSS 없음).
  {
    name: "ButtonGroup",
    archetype: "default",
    element: "div",
    containerStyles: undefined,
    states: { disabled: { opacity: 0.38 } },
  },
  // ADR-912 단계5 step4 small-B (2026-06-16) — Modal (overlay archetype, Modal.spec.ts 삭제 대상).
  //   archetype "overlay": CSSGenerator 가 `position:fixed`+`box-sizing:border-box` base 자동 emit.
  //   variant default(transparent bg + text neutral)는 rule 파생. sizes.md(paddingX/paddingY/gap
  //   2026-06-16 rule 보강 + fontSize/borderRadius/height)는 rule emit. Skia 는 spec render.shapes=[]
  //   (시각 0) — catalog cutover generic box. composition 불요. states 미설정(default) — generated
  //   CSS 의 [data-disabled](opacity+cursor:not-allowed+pointer-events) + [data-focus-visible] +
  //   variant 내 hover/pressed(variant fill 파생)는 [data-variant] 블록에서 emit. root states 는
  //   spec.states={} 미러 — disabled/focus-visible 는 CSSGenerator 기본 emit, hover/pressed root
  //   빈 블록은 미생성(states:{} 라야 root [data-hovered]/[data-pressed] 빈 블록 0 = diff 0).
  {
    name: "Modal",
    archetype: "overlay",
    element: "div",
    containerStyles: undefined,
    states: {},
  },
  // ADR-912 단계5 step4 small-B (2026-06-16) — Section (default archetype, Section.spec.ts 삭제 대상).
  //   archetype "default": DEFAULT_BASE_STYLES(inline-flex/align/justify/box-sizing/cursor/user-select/
  //   transition/font-family) emit. variant 6종(default alpha:0/accent/neutral/purple/surface/outlined)
  //   는 rule 파생. sizes(paddingX/paddingY/gap 2026-06-16 rule 보강 + fontSize/borderRadius/height:0)
  //   는 rule emit. Skia 는 catalog cutover generic box. composition 불요. states 는 spec.states 미러
  //   (hover/pressed 빈 + disabled opacity+pointerEvents — focusVisible 없음).
  {
    name: "Section",
    archetype: "default",
    element: "section",
    containerStyles: undefined,
    states: {
      hover: {},
      pressed: {},
      disabled: { opacity: 0.38, pointerEvents: "none" },
    },
  },
  // ADR-912 단계5 step4 small-B (2026-06-16) — input-field 군 (TextField/SearchField/TextArea/
  //   NumberField/TimeField/ColorField). composition.layout=flex-column root 가 ownsContainerBox →
  //   padding 미emit, gap 만 rule.sizes 에서 재생성(rule gap 보강 완료). composition(containerVariants
  //   label-position/quiet + delegation)은 spec verbatim carry. states 는 spec.states 미러
  //   (disabled.pointerEvents:none 등 기본값과 달라 명시 필수). Skia 는 catalog cutover generic box.
  {
    name: "TextField",
    archetype: "default",
    element: "div",
    containerStyles: {
      display: "flex",
    },
    composition: {
      layout: "flex-column",
      gap: "var(--spacing-xs)",
      containerStyles: {
        width: "fit-content",
      },
      containerVariants: {
        "label-position": {
          side: {
            styles: {
              display: "grid",
              "grid-template-columns":
                "var(--form-label-width, max-content) minmax(0, 1fr)",
              "column-gap": "var(--form-field-gap, var(--spacing-md))",
              "row-gap": "var(--spacing-xs)",
              "align-items": "start",
              width: "100%",
            },
            nested: [
              {
                selector: "> .react-aria-Label",
                styles: {
                  "grid-column": "1",
                  "justify-self": "stretch",
                  "text-align": "var(--form-label-align, start)",
                },
              },
              {
                selector: "> :not(.react-aria-Label)",
                styles: { "grid-column": "2", "min-width": "0" },
              },
            ],
          },
        },
        quiet: {
          true: {
            styles: {
              "--tf-border": "transparent",
              "--tf-bg": "transparent",
            },
            nested: [
              {
                selector: ".react-aria-Input",
                styles: {
                  background: "transparent",
                  "border-color": "transparent",
                  "box-shadow": "none",
                  "border-radius": "0",
                  "border-bottom": "1px solid var(--border)",
                },
              },
              {
                selector: ".react-aria-Input:where([data-focused])",
                styles: {
                  outline: "none",
                  "border-bottom-color": "var(--accent)",
                },
              },
              {
                selector: ".react-aria-Input:where([data-invalid])",
                styles: {
                  "border-bottom-color": "var(--negative)",
                },
              },
            ],
          },
        },
      },
      delegation: [
        {
          childSelector: ".react-aria-Label",
          prefix: "tf-label",
          variables: {
            xs: {
              "--tf-label-size": "var(--text-2xs)",
              "--tf-label-margin": "0px",
            },
            sm: {
              "--tf-label-size": "var(--text-xs)",
              "--tf-label-margin": "0px",
            },
            md: {
              "--tf-label-size": "var(--text-sm)",
              "--tf-label-margin": "2px",
            },
            lg: {
              "--tf-label-size": "var(--text-base)",
              "--tf-label-margin": "4px",
            },
            xl: {
              "--tf-label-size": "var(--text-lg)",
              "--tf-label-margin": "6px",
            },
          },
          bridges: {
            "--label-font-size": "var(--tf-label-size)",
            "--label-font-weight": "600",
            "--label-margin": "var(--tf-label-margin)",
          },
        },
        {
          childSelector: ".react-aria-Input",
          prefix: "tf-input",
          variables: {
            xs: {
              "--tf-input-padding": "var(--spacing-3xs) var(--spacing-xs)",
              "--tf-input-size": "var(--text-2xs)",
              "--tf-input-line-height": "var(--text-2xs--line-height)",
            },
            sm: {
              "--tf-input-padding": "var(--spacing-2xs) var(--spacing-sm)",
              "--tf-input-size": "var(--text-xs)",
              "--tf-input-line-height": "var(--text-xs--line-height)",
            },
            md: {
              "--tf-input-padding": "var(--spacing-xs) var(--spacing-md)",
              "--tf-input-size": "var(--text-sm)",
              "--tf-input-line-height": "var(--text-sm--line-height)",
            },
            lg: {
              "--tf-input-padding": "var(--spacing-sm) var(--spacing-lg)",
              "--tf-input-size": "var(--text-base)",
              "--tf-input-line-height": "var(--text-base--line-height)",
            },
            xl: {
              "--tf-input-padding": "var(--spacing-md) var(--spacing-xl)",
              "--tf-input-size": "var(--text-lg)",
              "--tf-input-line-height": "var(--text-lg--line-height)",
            },
          },
          bridges: {
            "--input-padding": "var(--tf-input-padding)",
            "--input-font-size": "var(--tf-input-size)",
            "--input-line-height": "var(--tf-input-line-height)",
          },
          states: {
            "[data-hovered]:not([data-focused]):not([data-disabled])": {
              "border-color": "var(--border-hover)",
            },
            "[data-focused]": {
              outline: "2px solid var(--accent)",
              "outline-offset": "-1px",
              "border-color": "var(--accent)",
            },
            "[data-invalid]": {
              "border-color": "var(--negative)",
            },
            "[data-invalid][data-focused]": {
              "outline-color": "var(--negative)",
            },
            "[data-disabled]": {
              "border-color": "color-mix(in srgb, var(--fg) 12%, transparent)",
              color: "color-mix(in srgb, var(--fg) 38%, transparent)",
              cursor: "not-allowed",
              opacity: "0.38",
            },
          },
        },
        {
          childSelector: ".react-aria-FieldError",
          prefix: "tf-hint",
          variables: {
            xs: { "--tf-hint-size": "var(--text-2xs)" },
            sm: { "--tf-hint-size": "var(--text-xs)" },
            md: { "--tf-hint-size": "var(--text-sm)" },
            lg: { "--tf-hint-size": "var(--text-base)" },
            xl: { "--tf-hint-size": "var(--text-lg)" },
          },
          bridges: {
            "--error-font-size": "var(--tf-hint-size)",
          },
        },
        {
          childSelector: '[slot="description"]',
          bridges: {
            "font-size": "var(--tf-hint-size)",
            color: "var(--fg-muted)",
          },
        },
      ],
    },
    states: {
      hover: {},
      pressed: {},
      disabled: {
        opacity: 0.38,
        cursor: "not-allowed",
        pointerEvents: "none",
      },
      focusVisible: {
        focusRing: "{focus.ring.default}",
      },
    },
  },
  {
    name: "SearchField",
    archetype: "default",
    element: "div",
    containerStyles: undefined,
    composition: {
      layout: "flex-column",
      gap: "var(--spacing-xs)",
      containerStyles: {
        width: "fit-content",
      },
      containerVariants: {
        "label-position": {
          side: {
            styles: {
              display: "grid",
              "grid-template-columns":
                "var(--form-label-width, max-content) minmax(0, 1fr)",
              "column-gap": "var(--form-field-gap, var(--spacing-md))",
              "row-gap": "var(--spacing-xs)",
              "align-items": "start",
              width: "100%",
            },
            nested: [
              {
                selector: "> .react-aria-Label",
                styles: {
                  "grid-column": "1",
                  "justify-self": "stretch",
                  "text-align": "var(--form-label-align, start)",
                },
              },
              {
                selector: "> :not(.react-aria-Label)",
                styles: { "grid-column": "2", "min-width": "0" },
              },
            ],
          },
        },
        quiet: {
          true: {
            nested: [
              {
                selector: ".searchfield-container",
                styles: {
                  background: "transparent",
                  "border-color": "transparent",
                  "box-shadow": "none",
                  "border-radius": "0",
                  "border-bottom": "1px solid var(--border)",
                },
              },
              {
                selector:
                  ".searchfield-container:hover:not(:has([data-disabled])):not(:has([data-focused]))",
                styles: {
                  background: "transparent",
                  "border-color": "transparent",
                  "border-bottom-color": "var(--border-hover)",
                },
              },
              {
                selector: ".searchfield-container:has([data-focused])",
                styles: {
                  outline: "none",
                  background: "transparent",
                  "border-color": "transparent",
                  "border-bottom-color": "var(--accent)",
                },
              },
              {
                selector: ".searchfield-container:has([data-invalid])",
                styles: {
                  "border-color": "transparent",
                  "border-bottom-color": "var(--negative)",
                },
              },
            ],
          },
        },
        empty: {
          true: {
            nested: [
              {
                selector: ".react-aria-Button",
                styles: { display: "none" },
              },
            ],
          },
        },
      },
      delegation: [
        {
          childSelector: ".react-aria-Label",
          prefix: "sf-label",
          variables: {
            xs: { "--sf-label-size": "var(--text-2xs)" },
            sm: { "--sf-label-size": "var(--text-xs)" },
            md: { "--sf-label-size": "var(--text-sm)" },
            lg: { "--sf-label-size": "var(--text-base)" },
            xl: { "--sf-label-size": "var(--text-lg)" },
          },
          bridges: {
            "--label-font-size": "var(--sf-label-size)",
            "--label-font-weight": "600",
            "--label-margin": "0",
          },
        },
        {
          childSelector: ".react-aria-Input",
          prefix: "sf-input",
          variables: {
            xs: {
              "--sf-input-size": "var(--text-2xs)",
              "--sf-input-line-height": "var(--text-2xs--line-height)",
            },
            sm: {
              "--sf-input-size": "var(--text-xs)",
              "--sf-input-line-height": "var(--text-xs--line-height)",
            },
            md: {
              "--sf-input-size": "var(--text-sm)",
              "--sf-input-line-height": "var(--text-sm--line-height)",
            },
            lg: {
              "--sf-input-size": "var(--text-base)",
              "--sf-input-line-height": "var(--text-base--line-height)",
            },
            xl: {
              "--sf-input-size": "var(--text-lg)",
              "--sf-input-line-height": "var(--text-lg--line-height)",
            },
          },
          bridges: {
            flex: "1",
            "min-width": "0",
            padding: "0",
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--fg)",
            "font-size": "var(--sf-input-size)",
            "line-height": "var(--sf-input-line-height)",
          },
        },
        {
          childSelector: ".react-aria-FieldError",
          prefix: "sf-hint",
          variables: {
            xs: { "--sf-hint-size": "var(--text-2xs)" },
            sm: { "--sf-hint-size": "var(--text-xs)" },
            md: { "--sf-hint-size": "var(--text-xs)" },
            lg: { "--sf-hint-size": "var(--text-sm)" },
            xl: { "--sf-hint-size": "var(--text-base)" },
          },
          bridges: {
            "font-size": "var(--sf-hint-size)",
            color: "var(--negative)",
          },
        },
        {
          childSelector: '[slot="description"]',
          bridges: {
            "font-size": "var(--sf-hint-size)",
            color: "var(--fg-muted)",
          },
        },
        {
          childSelector: ".search-icon",
          prefix: "sf-icon",
          variables: {
            xs: { "--sf-icon-size": "10px" },
            sm: { "--sf-icon-size": "12px" },
            md: { "--sf-icon-size": "16px" },
            lg: { "--sf-icon-size": "18px" },
            xl: { "--sf-icon-size": "22px" },
          },
          bridges: {
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            "flex-shrink": "0",
            color: "var(--fg-muted)",
          },
        },
        {
          childSelector: ".search-icon svg",
          bridges: {
            width: "var(--sf-icon-size)",
            height: "var(--sf-icon-size)",
          },
        },
        {
          childSelector: ".react-aria-Button",
          prefix: "sf-btn",
          variables: {
            xs: { "--sf-btn-size": "10px" },
            sm: { "--sf-btn-size": "14px" },
            md: { "--sf-btn-size": "18px" },
            lg: { "--sf-btn-size": "22px" },
            xl: { "--sf-btn-size": "28px" },
          },
          bridges: {
            position: "static",
            flex: "0 0 auto",
            width: "var(--sf-btn-size)",
            height: "var(--sf-btn-size)",
            padding: "0",
            border: "none",
            background: "var(--bg-overlay)",
            color: "var(--fg)",
            "forced-color-adjust": "none",
            "box-shadow": "var(--shadow-sm)",
            cursor: "pointer",
          },
          states: {
            "[data-hovered]:not([data-disabled])": {
              background: "var(--accent-subtle)",
            },
            "[data-pressed]:not([data-disabled])": {
              background:
                "color-mix(in srgb, var(--fg) 12%, var(--bg-overlay))",
            },
            "[data-focus-visible]": {
              outline: "2px solid var(--accent)",
              "outline-offset": "2px",
            },
            "[data-disabled]": {
              background: "color-mix(in srgb, var(--fg) 12%, transparent)",
              color: "color-mix(in srgb, var(--fg) 38%, transparent)",
              cursor: "not-allowed",
            },
          },
        },
        {
          childSelector: ".react-aria-Button svg",
          bridges: {
            width: "var(--sf-icon-size)",
            height: "var(--sf-icon-size)",
          },
        },
        {
          childSelector: ".searchfield-container",
          prefix: "sf-container",
          variables: {
            xs: {
              "--sf-container-padding":
                "var(--spacing-3xs) var(--spacing-3xs) var(--spacing-3xs) var(--spacing-xs)",
            },
            sm: {
              "--sf-container-padding":
                "var(--spacing-2xs) var(--spacing-2xs) var(--spacing-2xs) var(--spacing-sm)",
            },
            md: {
              "--sf-container-padding":
                "var(--spacing-xs) var(--spacing-xs) var(--spacing-xs) var(--spacing-md)",
            },
            lg: {
              "--sf-container-padding":
                "var(--spacing-sm) var(--spacing-sm) var(--spacing-sm) var(--spacing-lg)",
            },
            xl: {
              "--sf-container-padding":
                "var(--spacing-md) var(--spacing-md) var(--spacing-md) var(--spacing-xl)",
            },
          },
          bridges: {
            display: "flex",
            "flex-direction": "row",
            "align-items": "center",
            width: "100%",
            gap: "var(--spacing-xs)",
            padding: "var(--sf-container-padding)",
            border: "1px solid var(--border)",
            "border-radius": "var(--radius-md)",
            background: "var(--bg-inset)",
            transition: "border-color 200ms ease, background-color 200ms ease",
            cursor: "text",
          },
          states: {
            ":hover:not(:has([data-disabled]))": {
              "border-color": "var(--border-hover)",
              background: "var(--bg-overlay)",
            },
            ":has([data-focused])": {
              "border-color": "var(--accent)",
              outline: "2px solid var(--accent)",
              "outline-offset": "-1px",
              background: "var(--bg-overlay)",
            },
            ":has([data-invalid])": {
              "border-color": "var(--negative)",
            },
            ":has([data-disabled])": {
              opacity: "0.38",
              cursor: "not-allowed",
              background: "var(--bg-muted)",
            },
          },
        },
      ],
    },
    states: {
      hover: {},
      pressed: {},
      disabled: {
        opacity: 0.38,
        cursor: "not-allowed",
        pointerEvents: "none",
      },
      focusVisible: {
        focusRing: "{focus.ring.default}",
      },
    },
  },
  {
    name: "TextArea",
    archetype: "input-base",
    element: "div",
    containerStyles: {
      display: "flex",
      alignItems: "center",
    },
    composition: {
      containerVariants: {
        "label-position": {
          side: {
            styles: {
              display: "grid",
              "grid-template-columns":
                "var(--form-label-width, max-content) minmax(0, 1fr)",
              "column-gap": "var(--form-field-gap, var(--spacing-md))",
              "row-gap": "var(--spacing-xs)",
              "align-items": "start",
              width: "100%",
            },
            nested: [
              {
                selector: "> .react-aria-Label",
                styles: {
                  "grid-column": "1",
                  "justify-self": "stretch",
                  "text-align": "var(--form-label-align, start)",
                },
              },
              {
                selector: "> :not(.react-aria-Label)",
                styles: {
                  "grid-column": "2",
                  "min-width": "0",
                },
              },
            ],
          },
        },
      },
      delegation: [
        {
          childSelector: ".react-aria-Label",
          prefix: "ta-label",
          variables: {
            xs: {
              "--ta-label-size": "var(--text-2xs)",
              "--ta-label-line-height": "var(--text-2xs--line-height)",
            },
            sm: {
              "--ta-label-size": "var(--text-xs)",
              "--ta-label-line-height": "var(--text-xs--line-height)",
            },
            md: {
              "--ta-label-size": "var(--text-sm)",
              "--ta-label-line-height": "var(--text-sm--line-height)",
            },
            lg: {
              "--ta-label-size": "var(--text-base)",
              "--ta-label-line-height": "var(--text-base--line-height)",
            },
            xl: {
              "--ta-label-size": "var(--text-lg)",
              "--ta-label-line-height": "var(--text-lg--line-height)",
            },
          },
          bridges: {
            "--label-font-size": "var(--ta-label-size)",
            "--label-line-height": "var(--ta-label-line-height)",
          },
        },
      ],
    },
    states: {
      hover: {},
      pressed: {},
      disabled: {
        opacity: 0.38,
        cursor: "not-allowed",
        pointerEvents: "none",
      },
      focusVisible: {
        focusRing: "{focus.ring.default}",
      },
    },
  },
  {
    name: "NumberField",
    archetype: "default",
    element: "div",
    containerStyles: {
      display: "flex",
    },
    composition: {
      layout: "flex-column",
      gap: "var(--spacing-xs)",
      containerStyles: {
        color: "var(--fg)",
      },
      containerVariants: {
        disabled: {
          true: {
            nested: [
              {
                selector: ".react-aria-Group",
                styles: {
                  background: "color-mix(in srgb, var(--fg) 4%, transparent)",
                  "border-color":
                    "color-mix(in srgb, var(--fg) 12%, transparent)",
                  opacity: "0.38",
                },
              },
            ],
          },
        },
        "label-position": {
          side: {
            styles: {
              display: "grid",
              "grid-template-columns":
                "var(--form-label-width, max-content) minmax(0, 1fr)",
              "column-gap": "var(--form-field-gap, var(--spacing-md))",
              "row-gap": "var(--spacing-xs)",
              "align-items": "start",
              width: "100%",
            },
            nested: [
              {
                selector: "> .react-aria-Label",
                styles: {
                  "grid-column": "1",
                  "justify-self": "stretch",
                  "text-align": "var(--form-label-align, start)",
                },
              },
              {
                selector: "> :not(.react-aria-Label)",
                styles: { "grid-column": "2", "min-width": "0" },
              },
            ],
          },
        },
        quiet: {
          true: {
            nested: [
              {
                selector: ".react-aria-Group",
                styles: {
                  background: "transparent",
                  "border-color": "transparent",
                  "box-shadow": "none",
                  "border-radius": "0",
                  "border-bottom": "1px solid var(--border)",
                },
              },
              {
                selector:
                  "&:has(.react-aria-Input[data-hovered]:not([data-focused]):not([data-disabled])) .react-aria-Group",
                styles: {
                  background: "transparent",
                  "border-color": "transparent",
                  "box-shadow": "none",
                  "border-bottom-color": "var(--border-hover)",
                },
              },
              {
                selector:
                  "&:has(.react-aria-Button[data-hovered]:not([data-disabled])) .react-aria-Group",
                styles: {
                  background: "transparent",
                  "border-color": "transparent",
                  "box-shadow": "none",
                  "border-bottom-color": "var(--border-hover)",
                },
              },
              {
                selector:
                  "&:has(.react-aria-Input[data-focused]:not([data-disabled])) .react-aria-Group",
                styles: {
                  outline: "none",
                  background: "transparent",
                  "border-color": "transparent",
                  "box-shadow": "none",
                  "border-bottom-color": "var(--accent)",
                },
              },
              {
                selector:
                  "&:has(.react-aria-Input[data-focus-within]:not([data-disabled])) .react-aria-Group",
                styles: {
                  outline: "none",
                  background: "transparent",
                  "border-color": "transparent",
                  "box-shadow": "none",
                  "border-bottom-color": "var(--accent)",
                },
              },
              {
                selector:
                  "&:has(.react-aria-Button[data-focus-visible]:not([data-disabled])) .react-aria-Group",
                styles: {
                  outline: "none",
                  background: "transparent",
                  "border-color": "transparent",
                  "box-shadow": "none",
                  "border-bottom-color": "var(--accent)",
                },
              },
              {
                selector: "&[data-invalid] .react-aria-Group",
                styles: {
                  "border-color": "transparent",
                  "border-bottom-color": "var(--negative)",
                },
              },
            ],
          },
        },
      },
      delegation: [
        {
          childSelector: ".react-aria-Label",
          prefix: "nf-label",
          variables: {
            xs: { "--nf-label-size": "var(--text-2xs)" },
            sm: { "--nf-label-size": "var(--text-xs)" },
            md: { "--nf-label-size": "var(--text-sm)" },
            lg: { "--nf-label-size": "var(--text-base)" },
            xl: { "--nf-label-size": "var(--text-lg)" },
          },
          bridges: {
            "--label-font-size": "var(--nf-label-size)",
            "--label-font-weight": "600",
            "--label-margin": "var(--spacing-xs)",
          },
        },
        {
          childSelector: ".react-aria-Group",
          prefix: "nf-group",
          bridges: {
            display: "flex",
            "align-items": "center",
            gap: "var(--spacing-xs)",
            width: "100%",
            border: "1px solid var(--border)",
            "border-radius": "var(--border-radius)",
            background: "var(--bg-inset)",
            overflow: "hidden",
            transition: "border-color 200ms ease, background-color 200ms ease",
            padding:
              "var(--spacing-xs) var(--spacing-xs) var(--spacing-xs) var(--spacing-md)",
          },
          states: {
            ":has(.react-aria-Input[data-hovered]:not([data-focused]):not([data-disabled]))":
              {
                "border-color": "var(--border-hover)",
                background: "var(--bg-overlay)",
              },
            ":has(.react-aria-Button[data-hovered]:not([data-disabled]))": {
              "border-color": "var(--border-hover)",
              background: "var(--bg-overlay)",
            },
            ":has(.react-aria-Input[data-focused])": {
              outline: "2px solid var(--accent)",
              "outline-offset": "-1px",
            },
            ":has(.react-aria-Input[data-focus-within])": {
              outline: "2px solid var(--accent)",
              "outline-offset": "-1px",
            },
            ":has(.react-aria-Button[data-focus-visible])": {
              outline: "2px solid var(--accent)",
              "outline-offset": "-1px",
            },
            ":has([data-invalid])": {
              "border-color": "var(--negative)",
            },
          },
        },
        {
          childSelector: ".react-aria-Input",
          prefix: "nf-input",
          variables: {
            xs: {
              "--nf-input-font-size": "var(--text-2xs)",
              "--nf-input-line-height": "var(--text-2xs--line-height)",
            },
            sm: {
              "--nf-input-font-size": "var(--text-xs)",
              "--nf-input-line-height": "var(--text-xs--line-height)",
            },
            md: {
              "--nf-input-font-size": "var(--text-sm)",
              "--nf-input-line-height": "var(--text-sm--line-height)",
            },
            lg: {
              "--nf-input-font-size": "var(--text-base)",
              "--nf-input-line-height": "var(--text-base--line-height)",
            },
            xl: {
              "--nf-input-font-size": "var(--text-lg)",
              "--nf-input-line-height": "var(--text-lg--line-height)",
            },
          },
          bridges: {
            flex: "1 1 auto",
            "min-width": "0",
            border: "none",
            "border-radius": "0",
            background: "transparent",
            outline: "none",
            "forced-color-adjust": "none",
            padding: "0",
            "font-size": "var(--nf-input-font-size)",
            "line-height": "var(--nf-input-line-height)",
            "--input-padding": "0",
            "--input-font-size": "var(--nf-input-font-size)",
            "--input-line-height": "var(--nf-input-line-height)",
          },
        },
        {
          childSelector: ".react-aria-Button",
          prefix: "nf-btn",
          variables: {
            xs: {
              "--nf-btn-size": "10px",
              "--nf-btn-icon-size": "10px",
            },
            sm: {
              "--nf-btn-size": "14px",
              "--nf-btn-icon-size": "12px",
            },
            md: {
              "--nf-btn-size": "18px",
              "--nf-btn-icon-size": "16px",
            },
            lg: {
              "--nf-btn-size": "22px",
              "--nf-btn-icon-size": "18px",
            },
            xl: {
              "--nf-btn-size": "28px",
              "--nf-btn-icon-size": "22px",
            },
          },
          bridges: {
            position: "static",
            flex: "0 0 auto",
            padding: "0",
            border: "none",
            "border-radius": "var(--radius-xs)",
            width: "var(--nf-btn-size)",
            height: "var(--nf-btn-size)",
            "min-width": "unset",
            "min-height": "unset",
            background: "var(--bg-overlay)",
            color: "var(--fg)",
            "forced-color-adjust": "none",
            "box-shadow": "var(--shadow-sm)",
          },
          states: {
            "[data-hovered]:not([data-disabled])": {
              background: "var(--accent-subtle)",
            },
            "[data-pressed]:not([data-disabled])": {
              background:
                "color-mix(in srgb, var(--fg) 12%, var(--bg-overlay))",
            },
            "[data-focus-visible]": {
              outline: "2px solid var(--accent)",
              "outline-offset": "2px",
            },
            "[data-disabled]": {
              background: "color-mix(in srgb, var(--fg) 12%, transparent)",
              color: "color-mix(in srgb, var(--fg) 38%, transparent)",
              cursor: "not-allowed",
            },
          },
        },
        {
          childSelector: ".react-aria-Button svg",
          bridges: {
            width: "var(--nf-btn-icon-size)",
            height: "var(--nf-btn-icon-size)",
          },
        },
        {
          childSelector: ".react-aria-FieldError",
          prefix: "nf-hint",
          variables: {
            xs: { "--nf-hint-size": "var(--text-2xs)" },
            sm: { "--nf-hint-size": "var(--text-xs)" },
            md: { "--nf-hint-size": "var(--text-xs)" },
            lg: { "--nf-hint-size": "var(--text-sm)" },
            xl: { "--nf-hint-size": "var(--text-base)" },
          },
          bridges: {
            "--error-font-size": "var(--nf-hint-size)",
            "--error-margin": "var(--spacing-xs)",
          },
        },
        {
          childSelector: '[slot="description"]',
          bridges: {
            "font-size": "var(--nf-hint-size)",
            color: "var(--fg-muted)",
          },
        },
      ],
    },
    states: {
      hover: {},
      pressed: {},
      disabled: {
        opacity: 0.38,
        cursor: "not-allowed",
        pointerEvents: "none",
      },
      focusVisible: {
        focusRing: "{focus.ring.default}",
      },
    },
  },
  {
    name: "TimeField",
    archetype: "default",
    element: "div",
    containerStyles: {
      display: "flex",
    },
    composition: {
      layout: "flex-column",
      gap: "var(--spacing-xs)",
      containerVariants: {
        "label-position": {
          side: {
            styles: {
              "flex-direction": "row",
              "align-items": "flex-start",
            },
          },
        },
        quiet: {
          true: {
            nested: [
              {
                selector: ".react-aria-DateInput",
                styles: {
                  background: "transparent",
                  "border-color": "transparent",
                  "box-shadow": "none",
                  "border-radius": "0",
                  "border-bottom": "1px solid var(--border)",
                },
              },
              {
                selector: ".react-aria-DateInput:where([data-focused])",
                styles: {
                  outline: "none",
                  "border-bottom-color": "var(--accent)",
                },
              },
              {
                selector: ".react-aria-DateInput:where([data-invalid])",
                styles: { "border-bottom-color": "var(--negative)" },
              },
            ],
          },
        },
      },
      delegation: [
        {
          childSelector: ".react-aria-Label",
          prefix: "time-field-label",
          variables: {
            xs: { "--time-field-label-size": "var(--text-2xs)" },
            sm: { "--time-field-label-size": "var(--text-xs)" },
            md: { "--time-field-label-size": "var(--text-sm)" },
            lg: { "--time-field-label-size": "var(--text-base)" },
            xl: { "--time-field-label-size": "var(--text-lg)" },
          },
          bridges: {
            "--label-font-size": "var(--time-field-label-size)",
            "--label-font-weight": "600",
            "--label-margin": "var(--spacing-xs)",
          },
        },
        {
          childSelector: ".react-aria-DateInput",
          prefix: "time-field-input",
          variables: {
            xs: {
              "--time-field-input-padding":
                "var(--spacing-3xs) var(--spacing-xs)",
              "--time-field-input-size": "var(--text-2xs)",
              "--time-field-input-line-height": "var(--text-2xs--line-height)",
              "--time-field-input-min-width": "100px",
            },
            sm: {
              "--time-field-input-padding":
                "var(--spacing-2xs) var(--spacing-sm)",
              "--time-field-input-size": "var(--text-xs)",
              "--time-field-input-line-height": "var(--text-xs--line-height)",
              "--time-field-input-min-width": "120px",
            },
            md: {
              "--time-field-input-padding":
                "var(--spacing-xs) var(--spacing-md)",
              "--time-field-input-size": "var(--text-sm)",
              "--time-field-input-line-height": "var(--text-sm--line-height)",
              "--time-field-input-min-width": "150px",
            },
            lg: {
              "--time-field-input-padding":
                "var(--spacing-sm) var(--spacing-lg)",
              "--time-field-input-size": "var(--text-base)",
              "--time-field-input-line-height": "var(--text-base--line-height)",
              "--time-field-input-min-width": "180px",
            },
            xl: {
              "--time-field-input-padding":
                "var(--spacing-md) var(--spacing-xl)",
              "--time-field-input-size": "var(--text-lg)",
              "--time-field-input-line-height": "var(--text-lg--line-height)",
              "--time-field-input-min-width": "220px",
            },
          },
          bridges: {
            display: "inline-flex",
            padding: "var(--time-field-input-padding)",
            border: "1px solid",
            "border-radius": "var(--border-radius)",
            width: "100%",
            "min-width": "var(--time-field-input-min-width)",
            "white-space": "nowrap",
            "forced-color-adjust": "none",
            "font-size": "var(--time-field-input-size)",
            "line-height": "var(--time-field-input-line-height)",
            transition: "border-color 200ms ease, background-color 200ms ease",
          },
        },
        {
          childSelector: ".react-aria-DateSegment",
          prefix: "time-field-segment",
          variables: {
            xs: { "--time-field-segment-size": "var(--text-2xs)" },
            sm: { "--time-field-segment-size": "var(--text-xs)" },
            md: { "--time-field-segment-size": "var(--text-sm)" },
            lg: { "--time-field-segment-size": "var(--text-base)" },
            xl: { "--time-field-segment-size": "var(--text-lg)" },
          },
          bridges: {
            padding: "0 2px",
            border: "none",
            background: "transparent",
            height: "auto",
            "font-variant-numeric": "tabular-nums",
            "text-align": "end",
            color: "var(--fg)",
            "border-radius": "var(--radius-xs)",
            "font-size": "var(--time-field-segment-size)",
            transition: "all 150ms ease",
          },
          states: {
            '[data-type="literal"]': { padding: "0" },
            "[data-placeholder]": {
              color: "var(--fg-muted)",
              opacity: "0.6",
            },
            ":focus": {
              color: "var(--fg)",
              background: "var(--accent-subtle)",
              outline: "none",
              "border-radius": "var(--radius-xs)",
              "caret-color": "transparent",
            },
            "[data-invalid]": { color: "var(--negative)" },
            "[data-invalid]:focus": {
              background:
                "color-mix(in srgb, var(--negative) 15%, transparent)",
              color: "var(--negative)",
            },
            "[data-disabled]": {
              color: "color-mix(in srgb, var(--fg) 38%, transparent)",
              cursor: "not-allowed",
            },
          },
        },
        {
          childSelector: ".react-aria-FieldError",
          prefix: "time-field-hint",
          variables: {
            xs: { "--time-field-hint-size": "var(--text-2xs)" },
            sm: { "--time-field-hint-size": "var(--text-xs)" },
            md: { "--time-field-hint-size": "var(--text-xs)" },
            lg: { "--time-field-hint-size": "var(--text-sm)" },
            xl: { "--time-field-hint-size": "var(--text-base)" },
          },
          bridges: {
            "--error-font-size": "var(--time-field-hint-size)",
            "--error-margin": "var(--spacing-xs)",
          },
        },
        {
          childSelector: '[slot="description"]',
          bridges: {
            "font-size": "var(--time-field-hint-size)",
            color: "var(--fg-muted)",
          },
        },
      ],
    },
    states: {
      hover: {},
      pressed: {},
      disabled: { opacity: 0.38 },
      focusVisible: {
        focusRing: "{focus.ring.default}",
      },
    },
  },
  {
    name: "ColorField",
    archetype: "default",
    element: "div",
    containerStyles: undefined,
    composition: {
      layout: "flex-column",
      gap: "var(--spacing-xs)",
      containerStyles: {
        width: "fit-content",
        color: "var(--fg)",
      },
      containerVariants: {
        "label-position": {
          side: {
            styles: {
              display: "grid",
              "grid-template-columns":
                "var(--form-label-width, max-content) minmax(0, 1fr)",
              "column-gap": "var(--form-field-gap, var(--spacing-md))",
              "row-gap": "var(--spacing-xs)",
              "align-items": "start",
              width: "100%",
            },
            nested: [
              {
                selector: "> .react-aria-Label",
                styles: {
                  "grid-column": "1",
                  "justify-self": "stretch",
                  "text-align": "var(--form-label-align, start)",
                },
              },
              {
                selector: "> :not(.react-aria-Label)",
                styles: { "grid-column": "2", "min-width": "0" },
              },
            ],
          },
        },
        "label-align": {
          center: { styles: { "--form-label-align": "center" } },
          end: { styles: { "--form-label-align": "end" } },
        },
        quiet: {
          true: {
            nested: [
              {
                selector: ".react-aria-Input",
                styles: {
                  background: "transparent",
                  "border-color": "transparent",
                  "box-shadow": "none",
                  "border-radius": "0",
                  "border-bottom": "1px solid var(--border)",
                },
              },
              {
                selector: ".react-aria-Input:where([data-focused])",
                styles: {
                  outline: "none",
                  "border-bottom-color": "var(--accent)",
                },
              },
              {
                selector: ".react-aria-Input:where([data-invalid])",
                styles: { "border-bottom-color": "var(--negative)" },
              },
            ],
          },
        },
      },
      delegation: [
        {
          childSelector: ".react-aria-Label",
          prefix: "cf-label",
          variables: {
            xs: { "--cf-label-size": "var(--text-2xs)" },
            sm: { "--cf-label-size": "var(--text-xs)" },
            md: { "--cf-label-size": "var(--text-sm)" },
            lg: { "--cf-label-size": "var(--text-base)" },
            xl: { "--cf-label-size": "var(--text-lg)" },
          },
          bridges: {
            "--label-font-size": "var(--cf-label-size)",
            "--label-font-weight": "600",
            "--label-margin": "var(--spacing-xs)",
          },
        },
        {
          childSelector: ".react-aria-Input",
          prefix: "cf-input",
          variables: {
            xs: {
              "--cf-input-padding": "var(--spacing-3xs) var(--spacing-xs)",
              "--cf-input-size": "var(--text-2xs)",
              "--cf-input-line-height": "var(--text-2xs--line-height)",
              "--cf-input-max-width": "9ch",
            },
            sm: {
              "--cf-input-padding": "var(--spacing-2xs) var(--spacing-sm)",
              "--cf-input-size": "var(--text-xs)",
              "--cf-input-line-height": "var(--text-xs--line-height)",
              "--cf-input-max-width": "10ch",
            },
            md: {
              "--cf-input-padding": "var(--spacing-xs) var(--spacing-md)",
              "--cf-input-size": "var(--text-sm)",
              "--cf-input-line-height": "var(--text-sm--line-height)",
              "--cf-input-max-width": "12ch",
            },
            lg: {
              "--cf-input-padding": "var(--spacing-sm) var(--spacing-lg)",
              "--cf-input-size": "var(--text-base)",
              "--cf-input-line-height": "var(--text-base--line-height)",
              "--cf-input-max-width": "14ch",
            },
            xl: {
              "--cf-input-padding": "var(--spacing-md) var(--spacing-xl)",
              "--cf-input-size": "var(--text-lg)",
              "--cf-input-line-height": "var(--text-lg--line-height)",
              "--cf-input-max-width": "16ch",
            },
          },
          bridges: {
            "--input-padding": "var(--cf-input-padding)",
            "--input-font-size": "var(--cf-input-size)",
            "--input-line-height": "var(--cf-input-line-height)",
            "border-radius": "var(--radius-sm)",
            "max-width": "var(--cf-input-max-width)",
            "box-sizing": "border-box",
          },
        },
        {
          childSelector: ".react-aria-FieldError",
          prefix: "cf-hint",
          variables: {
            xs: { "--cf-hint-size": "var(--text-2xs)" },
            sm: { "--cf-hint-size": "var(--text-2xs)" },
            md: { "--cf-hint-size": "var(--text-xs)" },
            lg: { "--cf-hint-size": "var(--text-sm)" },
            xl: { "--cf-hint-size": "var(--text-base)" },
          },
          bridges: {
            "--error-font-size": "var(--cf-hint-size)",
          },
        },
        {
          childSelector: '[slot="description"]',
          bridges: {
            "font-size": "var(--cf-hint-size)",
            color: "var(--fg-muted)",
          },
        },
      ],
    },
    states: {
      hover: {},
      pressed: {},
      disabled: {
        opacity: 0.38,
        cursor: "not-allowed",
        pointerEvents: "none",
      },
      focusVisible: {
        focusRing: "{focus.ring.default}",
      },
    },
  },
  // ADR-912 단계5 step4 small-B (2026-06-16) — shell-container 군 (FileTrigger/Toolbar/Form/
  //   CheckboxGroup/RadioGroup). composition(containerStyles/containerVariants/staticSelectors/
  //   delegation)이 ownsContainerBox → variant·padding skip(generated 정합), gap 만 rule.sizes 에서
  //   재생성. composition 은 spec verbatim carry. states 는 spec.states 미러. Skia 는 catalog
  //   cutover generic box. CheckboxGroup/RadioGroup propagation 은 propagationRegistry
  //   createPropagationOnlySpec 인라인 이관(아래 spec 삭제와 동반).
  {
    name: "FileTrigger",
    archetype: "button",
    element: "button",
    containerStyles: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "fit-content",
    },
    composition: {
      containerStyles: {
        display: "inline-block",
      },
      staticSelectors: {
        "input[type='file']": {
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: "0",
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          "white-space": "nowrap",
          border: "0",
        },
      },
      delegation: [],
    },
    states: {
      hover: {},
      pressed: {
        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.1)",
      },
      disabled: {
        opacity: 0.38,
        cursor: "not-allowed",
        pointerEvents: "none",
      },
      focusVisible: {
        focusRing: "{focus.ring.default}",
      },
    },
  },
  {
    name: "Toolbar",
    archetype: "default",
    element: "div",
    containerStyles: {
      display: "flex",
      alignItems: "center",
      width: "fit-content",
    },
    composition: {
      containerStyles: {
        display: "flex",
        "flex-wrap": "wrap",
        gap: "8px",
        width: "fit-content",
      },
      containerVariants: {
        orientation: {
          horizontal: {
            styles: {
              "flex-direction": "row",
            },
          },
          vertical: {
            styles: {
              "flex-direction": "column",
              "align-items": "start",
            },
          },
        },
      },
      staticSelectors: {
        ".react-aria-Group": {
          display: "contents",
        },
        ".react-aria-ToggleButton": {
          width: "32px",
        },
        ".react-aria-Separator": {
          "align-self": "stretch",
          "background-color": "var(--bg-muted)",
        },
        '.react-aria-Separator[aria-orientation="vertical"]': {
          width: "1px",
          margin: "0px 10px",
        },
        '.react-aria-Separator:not([aria-orientation="vertical"])': {
          border: "none",
          height: "1px",
          width: "100%",
          margin: "10px 0",
        },
      },
      delegation: [],
    },
    states: {
      disabled: {
        opacity: 0.38,
        pointerEvents: "none",
      },
      focusVisible: {
        focusRing: "{focus.ring.default}",
      },
    },
  },
  {
    name: "Form",
    archetype: "default",
    element: "form",
    containerStyles: undefined,
    composition: {
      layout: "flex-column",
      gap: "16px",
      containerStyles: {
        "align-items": "start",
        "--form-label-width": "auto",
        "--form-label-align": "start",
        "--form-field-gap": "var(--spacing-md)",
      },
      containerVariants: {
        "label-position": {
          side: {
            styles: {
              "--form-label-width": "11rem",
            },
          },
        },
        "label-align": {
          center: {
            styles: {
              "--form-label-align": "center",
            },
          },
          end: {
            styles: {
              "--form-label-align": "end",
            },
          },
        },
      },
      delegation: [],
    },
    states: {
      hover: {},
      pressed: {},
      disabled: {
        opacity: 0.38,
        pointerEvents: "none",
      },
      focusVisible: {},
    },
  },
  {
    name: "CheckboxGroup",
    archetype: "default",
    element: "div",
    containerStyles: {
      display: "flex",
    },
    composition: {
      layout: "flex-column",
      gap: "var(--spacing-xs)",
      containerStyles: {
        color: "var(--fg)",
        "--label-font-size": "var(--text-sm)",
        "--label-line-height": "var(--text-sm--line-height)",
        "--cb-items-gap": "12px",
        "--cb-hint-size": "var(--text-xs)",
      },
      containerVariants: {
        size: {
          sm: {
            styles: {
              "--label-font-size": "var(--text-xs)",
              "--label-line-height": "var(--text-xs--line-height)",
              "--cb-items-gap": "8px",
            },
          },
          lg: {
            styles: {
              "--label-font-size": "var(--text-base)",
              "--label-line-height": "var(--text-base--line-height)",
              "--cb-items-gap": "16px",
            },
          },
        },
        "label-position": {
          side: {
            styles: {
              "flex-direction": "row",
              "align-items": "flex-start",
            },
          },
        },
        orientation: {
          vertical: {
            nested: [
              {
                selector: ".checkbox-items",
                styles: {
                  display: "flex",
                  "flex-direction": "column",
                  gap: "var(--cb-items-gap, var(--spacing-md))",
                },
              },
            ],
          },
          horizontal: {
            nested: [
              {
                selector: ".checkbox-items",
                styles: {
                  display: "flex",
                  "flex-direction": "row",
                  "align-items": "center",
                  gap: "var(--cb-items-gap, var(--spacing-md))",
                },
              },
            ],
          },
        },
      },
      delegation: [
        {
          childSelector: '[slot="description"]',
          bridges: {
            "font-size": "var(--cb-hint-size)",
          },
        },
      ],
    },
    states: {
      hover: {},
      pressed: {},
      disabled: {
        opacity: 0.38,
        pointerEvents: "none",
      },
      focusVisible: {
        focusRing: "{focus.ring.default}",
      },
    },
  },
  {
    name: "RadioGroup",
    archetype: "default",
    element: "div",
    containerStyles: {
      display: "flex",
    },
    composition: {
      layout: "flex-column",
      gap: "var(--spacing-xs)",
      containerStyles: {
        color: "var(--fg)",
        "--label-font-size": "var(--text-sm)",
        "--label-line-height": "var(--text-sm--line-height)",
        "--radio-items-gap": "12px",
        "--rg-hint-size": "var(--text-xs)",
      },
      containerVariants: {
        size: {
          sm: {
            styles: {
              "--label-font-size": "var(--text-xs)",
              "--label-line-height": "var(--text-xs--line-height)",
              "--radio-items-gap": "8px",
            },
          },
          lg: {
            styles: {
              "--label-font-size": "var(--text-base)",
              "--label-line-height": "var(--text-base--line-height)",
              "--radio-items-gap": "16px",
            },
          },
        },
        "label-position": {
          side: {
            styles: {
              "flex-direction": "row",
              "align-items": "flex-start",
            },
          },
        },
        orientation: {
          vertical: {
            nested: [
              {
                selector: ".radio-items",
                styles: {
                  display: "flex",
                  "flex-direction": "column",
                  gap: "var(--radio-items-gap, var(--spacing-md))",
                },
              },
            ],
          },
          horizontal: {
            nested: [
              {
                selector: ".radio-items",
                styles: {
                  display: "flex",
                  "flex-direction": "row",
                  "align-items": "center",
                  gap: "var(--radio-items-gap, var(--spacing-md))",
                },
              },
            ],
          },
        },
      },
      delegation: [
        {
          childSelector: '[slot="description"]',
          bridges: {
            "font-size": "var(--rg-hint-size)",
          },
        },
      ],
    },
    states: {
      hover: {},
      pressed: {},
      disabled: {
        opacity: 0.38,
        pointerEvents: "none",
      },
      focusVisible: {
        focusRing: "{focus.ring.default}",
      },
    },
  },
  // ADR-912 단계5 step4 type-augment 그룹 (2026-06-16) — IllustratedMessage (alert archetype,
  //   IllustratedMessage.spec.ts 삭제 대상). alert archetype base(flex-column/align-flex-start/
  //   box-sizing/font-family) + containerStyles(spec 미러) emit. variant default(transparent fill +
  //   neutral text) + sizes(fontSize/borderRadius/height/paddingX/paddingY/gap/headingFontSize 2026-06-16
  //   rule 보강)는 rule 파생. `.alert-heading` 자식 CSS 는 headingFontSize 가 ruleSizeToSizeSpec 경유로
  //   virtual.sizes 에 실려 CSSGenerator.generateChildFontStyles 가 emit. composition 불요(spec 에 없음).
  //   states={}: spec.states={} 미러 — disabled/focus-visible 는 CSSGenerator 기본 emit(현 generated 와 동일),
  //   hover/pressed root 빈 블록은 variant default 의 hover/pressed transparent 가 [data-variant] 블록에서
  //   이미 emit 되므로 states 기본값(hover/pressed:{}) 사용 시 root 빈 블록 추가 → diff. states={} 로 차단.
  {
    name: "IllustratedMessage",
    archetype: "alert",
    element: "div",
    containerStyles: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      width: "100%",
    },
    states: {},
  },
  // ADR-912 단계5 step4 type-augment 그룹 (2026-06-16) — ToggleButtonGroup (default archetype,
  //   ToggleButtonGroup.spec.ts 삭제 대상). containerStyles(flex/align-center, spec 미러) emit.
  //   variant default(transparent fill + neutral text + transparent border) + sizes(fontSize/borderRadius/
  //   height:0)는 rule 파생 — borderRadius(xs=sm/sm=md/md=lg/lg=xl/xl=xl)가 rule 과 일치하므로 rule 보강 불요.
  //   gap=0(rule)이라 gap 줄 미emit. composition.delegation(--btn-border-radius sm/md/lg) + indicatorMode
  //   (SelectionIndicator pill box-shadow/transition — 색은 --button-color 하드코딩이라 구조 메타)는
  //   spec verbatim carry. states 는 spec.states 미러(focusVisible 만 — disabled 는 CSSGenerator 기본 emit).
  {
    name: "ToggleButtonGroup",
    archetype: "default",
    element: "div",
    containerStyles: {
      display: "flex",
      alignItems: "center",
    },
    composition: {
      layout: "flex-row",
      containerStyles: {
        width: "fit-content",
      },
      delegation: [
        {
          childSelector: ".react-aria-ToggleButton",
          variables: {
            sm: { "--btn-border-radius": "var(--radius-sm)" },
            md: { "--btn-border-radius": "var(--radius-md)" },
            lg: { "--btn-border-radius": "var(--radius-lg)" },
          },
        },
      ],
    },
    indicatorMode: {
      fill: { base: "{color.layer-1}" },
      selectedText: "{color.on-accent}",
      borderRadius: "{radius.sm}",
      boxShadow: "{shadow.sm}",
      transitionMs: 200,
    },
    states: {
      focusVisible: {
        focusRing: "{focus.ring.default}",
      },
    },
  },
];

/**
 * STRUCTURE_META — virtual CSS emit 대상의 "구조 정보" lookup map (name → StructureMeta).
 *
 * ADR-912 단계5 step4 Phase 0 (2026-06-16): generate-css 일반화 골격. virtual emit 집합을 이 Map
 * 의 멤버십이 결정하고(emit allowlist), 색상/사이즈/variant 는 getComponentRulesTable() 에서 읽는다
 * (구조 vs 시각값 source 분리). spec import 경로 56 은 그대로 유지 → 현 출력 집합(virtual 45) 불변.
 *
 * Phase 1 에서 spec 파일을 삭제하며 그 컴포넌트를 이 Map 에 추가하는 방식으로 spec→virtual 이관.
 * (= "rule table 기반 단일 수렴" 의 점진 경로. 한 컴포넌트씩이 아니라 archetype 변환 패턴별 일괄.)
 */
const STRUCTURE_META: Map<string, StructureMeta> = new Map(
  STRUCTURE_META_ENTRIES.map(({ name, ...meta }) => [name, meta]),
);

/**
 * STRUCTURE_META 에 등재된 컴포넌트를 rule(getComponentRulesTable) + 구조 메타 기반으로
 * virtual ComponentSpec 배열로 합성. spec 파일 존재 여부와 무관 — emit 집합은 STRUCTURE_META 가 정함.
 */
function buildVirtualSpecs(): ComponentSpec<unknown>[] {
  const table = getComponentRulesTable();
  const result: ComponentSpec<unknown>[] = [];

  for (const [name, meta] of STRUCTURE_META) {
    const rule = table[name];
    if (!rule) {
      console.warn(`  ⚠ virtual: no rule for ${name}, skipping`);
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
      name,
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
      // indicatorMode: ToggleButtonGroup 의 selection indicator 구조. 미설정 시 미emit.
      ...(meta.indicatorMode ? { indicatorMode: meta.indicatorMode } : {}),
      render: {
        shapes: () => [],
      },
    };

    result.push(virtualSpec);
    console.log(`  ✓ Synthesized virtual spec: ${name} (from rule table)`);
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
    // ADR-912 단계5 step4: STRUCTURE_META 등재 컴포넌트는 virtual spec 이 우선 — dedup
    //   (spec 파일과 virtual 이 일시 공존하면 virtual override → 이중 emit 방지. 현재 spec 파일 ∩
    //    STRUCTURE_META = 0 이라 매칭 없음 = no-op 이지만, Phase 1 spec→virtual 이관 중 dedup 키로 동작.)
    const specs: ComponentSpec<unknown>[] = [];

    for (const file of specFiles) {
      // STRUCTURE_META 등재: spec 파일이 존재해도 virtual input 으로 대체 — 파일 스캔 결과에서 제외
      const componentName = file.replace(".spec.ts", "");
      if (STRUCTURE_META.has(componentName)) {
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

    // STRUCTURE_META virtual specs 추가 (rule+구조 메타 기반 합성)
    const virtualSpecs = buildVirtualSpecs();
    specs.push(...virtualSpecs);

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
