/**
 * ADR-142 — `componentCatalog`: 6개 레지스트리(Component Panel / Factory / rendererMap /
 * getDefaultProps / BASE_TAG_SPEC_MAP / builder TAG_SPEC_MAP)를 대체하는 **단일 등록 SSOT**.
 *
 * - `kind: "primitive"` — leaf RAC/internal primitive. `binding` 으로 정의.
 * - `kind: "reusable"` — 조합 컴포넌트. `reusableId` → canonical reusable 문서. (family ① 없음)
 *
 * `family` + `cutover` 가 family 단위 atomic cutover 의 SSOT 축. 한 family 의 모든 entry 는
 * `cutover` 를 함께 거치며(legacy → cutting-over → catalog), 같은 family 안 혼재 금지(불변식 D).
 *
 * cutover 게이트(`cutover.ts::isCatalogCutover`)는 본 catalog 의 `cutover === "catalog"` entry
 * 에서 파생된다 — 단일 SSOT. family flip 은 여기 `cutover` 값을 바꾸는 것으로 발효.
 *
 * 설계: docs/adr/design/142-starter-spec-component-system-cutover-breakdown.md §3
 */

import { getPrimitiveBinding } from "./bindings";
import type {
  ComponentCatalogEntry,
  CutoverState,
  PrimitiveBinding,
} from "./types";

/**
 * family ①(primitives/actions) 8 primitive entry.
 *
 * 전부 leaf primitive — reusable 문서 없음. Badge 는 inventory §3 "reusable" 분류를 실측으로
 * 정정한 internal source leaf(단일 styled box+text). Icon/Badge 는 internal source(RAC 아님).
 *
 * `cutover: "legacy"` — family ① flip(Phase 6) 시점에 일괄 `"catalog"` 로 전환(불변식 D atomic).
 */
function primitiveEntry(
  type: string,
  family: ComponentCatalogEntry["family"],
  cutover: CutoverState,
  panel: { category: string; label: string; icon: string },
): Extract<ComponentCatalogEntry, { kind: "primitive" }> {
  const binding = getPrimitiveBinding(type) as PrimitiveBinding;
  return {
    kind: "primitive",
    type,
    family,
    cutover,
    binding,
    panel: { ...panel, placeable: true },
  };
}

/**
 * ADR-142 family ① cutover 상태. **flip 발효 지점** — "catalog" 로 전환하면 8 type 이
 * CATALOG_CUTOVER_TYPES 에 들어가 DOM/Skia/Inspector 가 catalog generic 경로로 동시 발효
 * (불변식 D atomic). cross-check 통과 후 flip.
 */
const FAMILY_1_CUTOVER: CutoverState = "catalog";

const FAMILY_1_ENTRIES: ComponentCatalogEntry[] = [
  primitiveEntry("Button", "primitives", FAMILY_1_CUTOVER, {
    category: "buttons",
    label: "button",
    icon: "MousePointer",
  }),
  primitiveEntry("ToggleButton", "primitives", FAMILY_1_CUTOVER, {
    category: "buttons",
    label: "toggle button",
    icon: "ToggleLeft",
  }),
  primitiveEntry("ToggleButtonGroup", "primitives", FAMILY_1_CUTOVER, {
    category: "buttons",
    label: "toggle button group",
    icon: "GroupIcon",
  }),
  primitiveEntry("Toolbar", "primitives", FAMILY_1_CUTOVER, {
    category: "buttons",
    label: "toolbar",
    icon: "Settings",
  }),
  primitiveEntry("Link", "primitives", FAMILY_1_CUTOVER, {
    category: "layout",
    label: "link",
    icon: "Link",
  }),
  primitiveEntry("Separator", "primitives", FAMILY_1_CUTOVER, {
    category: "content",
    label: "separator",
    icon: "SeparatorHorizontal",
  }),
  primitiveEntry("Icon", "primitives", FAMILY_1_CUTOVER, {
    category: "content",
    label: "icon",
    icon: "Smile",
  }),
  primitiveEntry("Badge", "primitives", FAMILY_1_CUTOVER, {
    category: "content",
    label: "badge",
    icon: "Star",
  }),
  // ADR-912 위험군 해소(선행-3/4 deletion-risk → catalog 등록, 2026-06-04): TEXT_LEAF 순수 텍스트.
  //   rule(COMPONENT_RULES_TABLE.Text, fontSize+lineHeight 완비) + buildCatalogShapes generic 으로
  //   시각·측정 이전 → spec.render.shapes 의존 끊기. DOM 은 generic fallthrough(<p> + react-aria-Text).
  primitiveEntry("Text", "primitives", FAMILY_1_CUTOVER, {
    category: "content",
    label: "text",
    icon: "Type",
  }),
  // ADR-912 위험군 해소(선행-4): TEXT_LEAF 동형(Text). rule textWeight 700(제목) / 400(본문) 완비.
  primitiveEntry("Heading", "primitives", FAMILY_1_CUTOVER, {
    category: "content",
    label: "heading",
    icon: "Heading",
  }),
  primitiveEntry("Paragraph", "primitives", FAMILY_1_CUTOVER, {
    category: "content",
    label: "paragraph",
    icon: "Pilcrow",
  }),
  // ADR-912 위험군 해소(선행-4): TEXT_LEAF box형 mono. rule fontFamily(mono) + textWeight 400.
  primitiveEntry("Code", "primitives", FAMILY_1_CUTOVER, {
    category: "content",
    label: "code",
    icon: "Code",
  }),
  primitiveEntry("Kbd", "primitives", FAMILY_1_CUTOVER, {
    category: "content",
    label: "keyboard key",
    icon: "Keyboard",
  }),
  // ADR-912 위험군 해소(선행-6): field/form 라벨 leaf. TEXT_LEAF 동형(box+text generic),
  //   부모 의존 4단계 변형(label/necessity/align/nowrap)은 dispatch 이전 specProps 단이라 직교.
  //   rule textWeight 600 + lineHeight 완비로 drift 0.
  primitiveEntry("Label", "primitives", FAMILY_1_CUTOVER, {
    category: "forms",
    label: "label",
    icon: "Tag",
  }),
  // ADR-912 위험군 해소(선행-6): compound 보조 설명 leaf. TEXT_LEAF 동형(box+text generic),
  //   spec render.shapes 가 props 만 읽어 부모 변형 0 (Label 보다 단순). rule textWeight 400(보조
  //   텍스트 normal weight) + lineHeight 완비로 drift 0. 측정 결합(implicitStyles/ADR-147)은 측정
  //   layer 라 catalog 등록과 직교.
  primitiveEntry("Description", "primitives", FAMILY_1_CUTOVER, {
    category: "forms",
    label: "description",
    icon: "AlignLeft",
  }),
  // ADR-912 위험군 해소(선행-6): field/form validation 에러 메시지 leaf. TEXT_LEAF 동형(box+text
  //   generic), spec render.shapes 가 props 만 읽어 부모 데이터(invalid 상태) 의존 0 (Description 동형).
  //   rule textWeight 400 + negative 색 + height:0(isInlineText top/left) + lineHeight 완비로 drift 0.
  //   measure 는 부모 height 분기(utils.ts:2298)로 처리(TEXT_LEAF_TAGS 비멤버, catalog 직교).
  primitiveEntry("FieldError", "primitives", FAMILY_1_CUTOVER, {
    category: "forms",
    label: "field error",
    icon: "AlertCircle",
  }),
  // ADR-912 위험군 해소(선행-6): field 입력 영역 자식 leaf. rac source(RAC <Input> 이 부모 TextField
  //   controller slot 소비) → catalog cutover 후에도 DOM 은 <RAC.Input> 유지, Skia 는 buildCatalogShapes
  //   box+text. createInput 단독 factory 없음(field 자식 sub-part 전용). rule paddingX 보강(NaN/drift 방지).
  primitiveEntry("Input", "primitives", FAMILY_1_CUTOVER, {
    category: "forms",
    label: "input",
    icon: "TextCursorInput",
  }),
  // ADR-912 단계 5 선행-1: button-like RAC leaf (box+text generic, value-dependent 시각 없음)
  primitiveEntry("FileTrigger", "primitives", FAMILY_1_CUTOVER, {
    category: "forms",
    label: "file trigger",
    icon: "Upload",
  }),
  // ADR-912 단계 5 선행-1: loading placeholder internal leaf (box generic, skeletonVariant 빌더 미노출)
  primitiveEntry("Skeleton", "primitives", FAMILY_1_CUTOVER, {
    category: "content",
    label: "skeleton",
    icon: "Loader",
  }),
  // ADR-912 container shell 3 (2026-06-04): box형 시맨틱 컨테이너 leaf (internal source).
  //   catalog 등록으로 spec.render.shapes Skia fallback 제거 — 시각은 rule(COMPONENT_RULES_TABLE)
  //   + buildCatalogShapes generic box. DOM 은 generic fallback 경로(INTERNAL_RENDERERS 미등록)
  //   유지라 generated CSS diff 0. List 는 샘플 text 3줄 때문에 별도 보류(후속 판정).
  primitiveEntry("body", "primitives", FAMILY_1_CUTOVER, {
    category: "layout",
    label: "body",
    icon: "Layout",
  }),
  primitiveEntry("Section", "primitives", FAMILY_1_CUTOVER, {
    category: "layout",
    label: "section",
    icon: "RectangleHorizontal",
  }),
  primitiveEntry("Nav", "primitives", FAMILY_1_CUTOVER, {
    category: "layout",
    label: "nav",
    icon: "Menu",
  }),
  // ADR-912 internal 4 slice (2026-06-04): 인라인 알림 box leaf (internal source). catalog 등록으로
  //   spec.render.shapes Skia fallback 제거 — 시각은 rule(COMPONENT_RULES_TABLE.InlineAlert, 5 variant)
  //   + buildCatalogShapes generic box+border(shell, render.shapes 가 text 0 → 자식 Element 가
  //   heading/desc 담당). DOM 은 generic fallback(rendererMap 제거) + staticAttrs role="alert".
  primitiveEntry("InlineAlert", "primitives", FAMILY_1_CUTOVER, {
    category: "content",
    label: "inline alert",
    icon: "AlertCircle",
  }),
  // ADR-912 진로 1번 IllustratedMessage proof slice (2026-06-06): 빈 상태(empty state) internal leaf.
  //   catalog 등록으로 spec.render.shapes Skia fallback 제거 — Skia 는 skiaPrimitive
  //   "illustrated_message" escape(placeholder+heading+description, append), DOM 은 INTERNAL_RENDERERS
  //   ["illustrated"](IllustratedMessage.tsx, props.heading/description 직접 소비). heading/description
  //   이 자식 Element 아닌 props(factory children:[]) → generic fallback 미적용, 어댑터 필수.
  primitiveEntry("IllustratedMessage", "primitives", FAMILY_1_CUTOVER, {
    category: "content",
    label: "illustrated message",
    icon: "ImageOff",
  }),
  // ADR-912 진로 1번 StatusLight proof slice (2026-06-06): 상태 표시 dot+label internal leaf.
  //   Skia 는 skiaPrimitive "status_light" escape(dot circle + text, replace — box 무의미),
  //   DOM 은 INTERNAL_RENDERERS["statuslight"](StatusLight.tsx, props.variant/size/children 소비).
  //   기존 dot primitive(isDot gate, Checkbox/Radio)와 별개 escape.
  primitiveEntry("StatusLight", "primitives", FAMILY_1_CUTOVER, {
    category: "content",
    label: "status light",
    icon: "Circle",
  }),
  // ADR-912 진로 1번 Avatar proof slice (2026-06-06): 사용자 아바타 circle+image internal leaf.
  //   Skia 는 skiaPrimitive "avatar" escape(circle bg + image|initials, replace — buildCatalogShapes
  //   image 미지원), DOM 은 INTERNAL_RENDERERS["avatar"](Avatar.tsx, props.src/initials/size 소비).
  //   src/initials 가 자식 Element 아닌 props(factory children:[]) → generic fallback 미적용, 어댑터 필수.
  primitiveEntry("Avatar", "primitives", FAMILY_1_CUTOVER, {
    category: "content",
    label: "avatar",
    icon: "User",
  }),
  // ADR-912 진로 1번 ProgressCircle proof slice (value-fill, 2026-06-06): 원형 진행률 internal leaf.
  //   Skia 는 skiaPrimitive "value_fill_arc" escape(track arc 360° + value 비례 indicator arc, replace —
  //   buildCatalogShapes arc 미지원), DOM 은 INTERNAL_RENDERERS["progresscircle"](ProgressCircle.tsx,
  //   props.value/size/isIndeterminate 소비, SVG circle stroke-dasharray). value/size 가 자식 Element 아닌
  //   props(factory children:[]) → generic fallback 미적용, 어댑터 필수(Avatar circle escape 동형).
  primitiveEntry("ProgressCircle", "primitives", FAMILY_1_CUTOVER, {
    category: "content",
    label: "progress circle",
    icon: "Loader",
  }),
  // ADR-912 (B+icon) DisclosureHeader proof slice (leadingIcon append, 2026-06-08): Disclosure
  //   헤더 leaf(leading chevron + title). Skia 는 buildCatalogShapes box+text + skiaPrimitive
  //   "leading_icon" escape(append — base text 위 좌측 chevron, text 는 iconSize 만큼 우측 shift),
  //   DOM 은 부모 Disclosure(catalog 미등록 legacy rendererMap)가 self-compose(renderDisclosure
  //   가 title 흡수 + contentChildren 제외) → DisclosureHeader DOM 독립 노드 0(catalog 등록 후에도
  //   DOM 변화 없음, Skia spec.render.shapes fallback 제거가 목적). palette 비노출(ComponentList
  //   별도 목록 — Disclosure 자식, 단독 배치 안 함). leading_icon 채널은 후속 CalendarHeader 가
  //   trailing param 으로 확장.
  primitiveEntry("DisclosureHeader", "primitives", FAMILY_1_CUTOVER, {
    category: "structure",
    label: "disclosure header",
    icon: "ChevronRight",
  }),
];

/**
 * ADR-142 family ②(fields) cutover 상태. 7 RAC-backed primitive(inventory §2-1).
 * field 는 RAC 가 Label/Input slot 을 합성하는 leaf primitive — 자식 Element(Label/Input)는
 * canonical children 트리, Skia 는 `buildCatalogShapes` 의 `_hasChildren` 빈 box shell 로 흡수.
 */
const FAMILY_2_CUTOVER: CutoverState = "catalog";

const FAMILY_2_ENTRIES: ComponentCatalogEntry[] = [
  primitiveEntry("TextField", "fields", FAMILY_2_CUTOVER, {
    category: "forms",
    label: "text field",
    icon: "RectangleEllipsis",
  }),
  // ADR-912 단계 5 선행-1: multi-line field RAC leaf (box+text generic, _hasChildren shell)
  primitiveEntry("TextArea", "fields", FAMILY_2_CUTOVER, {
    category: "forms",
    label: "text area",
    icon: "RectangleEllipsis",
  }),
  primitiveEntry("NumberField", "fields", FAMILY_2_CUTOVER, {
    category: "forms",
    label: "number field",
    icon: "Hash",
  }),
  primitiveEntry("SearchField", "fields", FAMILY_2_CUTOVER, {
    category: "forms",
    label: "search field",
    icon: "Search",
  }),
  primitiveEntry("DateField", "fields", FAMILY_2_CUTOVER, {
    category: "forms",
    label: "date field",
    icon: "CalendarCheck",
  }),
  primitiveEntry("TimeField", "fields", FAMILY_2_CUTOVER, {
    category: "forms",
    label: "time field",
    icon: "ChevronDown",
  }),
  primitiveEntry("ColorField", "fields", FAMILY_2_CUTOVER, {
    category: "forms",
    label: "color field",
    icon: "Palette",
  }),
  primitiveEntry("Form", "fields", FAMILY_2_CUTOVER, {
    category: "forms",
    label: "form",
    icon: "GroupIcon",
  }),
];

/**
 * ADR-142 family ③(selection) cutover 상태. Checkbox/Radio/Switch/Slider + Group 6개.
 * Checkbox/Radio/Switch 는 indicator(box/circle/track+thumb)를 `skiaPrimitive` draw module 로
 * 그린다(box+text 표현 불가). Slider 는 track/thumb 을 자식 SliderTrack/Thumb sub-part 가
 * 그리므로 skiaPrimitive 불필요. Group 은 자식 옵션 컨테이너(_hasChildren 빈 box shell).
 */
const FAMILY_3_CUTOVER: CutoverState = "catalog";

const FAMILY_3_ENTRIES: ComponentCatalogEntry[] = [
  primitiveEntry("Checkbox", "selection", FAMILY_3_CUTOVER, {
    category: "forms",
    label: "checkbox",
    icon: "SquareCheck",
  }),
  primitiveEntry("CheckboxGroup", "selection", FAMILY_3_CUTOVER, {
    category: "forms",
    label: "checkbox group",
    icon: "GroupIcon",
  }),
  primitiveEntry("Radio", "selection", FAMILY_3_CUTOVER, {
    category: "forms",
    label: "radio",
    icon: "Circle",
  }),
  primitiveEntry("RadioGroup", "selection", FAMILY_3_CUTOVER, {
    category: "forms",
    label: "radio group",
    icon: "GroupIcon",
  }),
  primitiveEntry("Switch", "selection", FAMILY_3_CUTOVER, {
    category: "forms",
    label: "switch",
    icon: "ToggleRight",
  }),
  primitiveEntry("Slider", "selection", FAMILY_3_CUTOVER, {
    category: "forms",
    label: "slider",
    icon: "SlidersHorizontal",
  }),
  // ADR-912 진로 1번 ProgressBar proof slice (value-fill compound, 2026-06-07): 진행률 표시.
  //   factory 3자식(Label/ProgressBarValue/ProgressBarTrack) → _hasChildren=true. DOM 은
  //   rendererMap.renderProgressBar 위임(DELEGATING_INTERNAL_RENDERERS, Tabs 선례 — 자식 Label
  //   children 추출 → 자기완결 RAC ProgressBar). Skia 는 shell-only + 자식 ProgressBarTrack
  //   value_fill_bar escape(선행-2 발효). DOM/Skia 비대칭이나 시각 결과(value 비례 막대) 대칭.
  primitiveEntry("ProgressBar", "selection", FAMILY_3_CUTOVER, {
    category: "forms",
    label: "progress bar",
    icon: "BarChart3",
  }),
  // ADR-912 진로 1번 Meter 확장 (value-fill compound, ProgressBar 동형, 2026-06-08): 측정값 표시.
  //   factory 3자식(Label/MeterValue/MeterTrack) → _hasChildren=true. DOM 은 rendererMap.renderMeter
  //   위임(DELEGATING_INTERNAL_RENDERERS). Skia 는 shell-only + 자식 MeterTrack value_fill_bar escape
  //   (선행-2 발효, variant 4색 fillBar). ProgressBar 와 차이는 variant 4색·isIndeterminate 부재.
  primitiveEntry("Meter", "selection", FAMILY_3_CUTOVER, {
    category: "forms",
    label: "meter",
    icon: "Gauge",
  }),
  // ADR-912 선행-2: ProgressBar compound 의 value 채움 막대 (Skia-전용 sub-part).
  //   palette 미노출(ComponentList 가 ProgressBar 부모만 등록) — catalog 등록은 Skia
  //   generic 경로(value_fill_bar escape) 진입용. DOM 은 부모 RAC ProgressBar 가 track 담당.
  primitiveEntry("ProgressBarTrack", "selection", FAMILY_3_CUTOVER, {
    category: "forms",
    label: "progress bar track",
    icon: "BarChart3",
  }),
  // ADR-912 선행-2: Meter compound 의 value 채움 막대 (Skia-전용 sub-part).
  //   palette 미노출(ComponentList 가 Meter 부모만 등록) — catalog 등록은 Skia generic
  //   경로(value_fill_bar escape) 진입용. DOM 은 부모 RAC Meter 가 track 담당.
  //   ProgressBarTrack 동형, 차이는 variant 4종(informative/positive/warning/critical) fillBar 색.
  primitiveEntry("MeterTrack", "selection", FAMILY_3_CUTOVER, {
    category: "forms",
    label: "meter track",
    icon: "BarChart3",
  }),
];

/**
 * ADR-142 family ④(collections) cutover 상태. 7 collection(ListBox/Menu/Select/ComboBox/
 * Tabs/TagGroup/GridList).
 *
 * **ListBox — Skia generic 발효 (skiaLegacy 제거, ADR-912 선행 작업 2026-06-03)**: ListBox
 *   render.shapes 는 이미 container shell(bg roundRect + border)만 반환하고(ADR-146,
 *   ListBox.spec.ts:340-342), data row paint 는 ADR-146/147 row projection renderer
 *   (canvasSceneNode.ts:appendListBoxRowProjection)가 각 행을 독립 Skia 노드로 그린다 — 즉
 *   items 배열 순회가 render.shapes 안에 없다. buildCatalogShapes 가 동일 정본 table
 *   (componentRulesTable ListBox rule)의 variant fill + border 로 같은 shell 을 그려 시각 동등
 *   (text 없음 → text 미렌더). row projection 경로는 컨테이너 cutover 와 직교(불변).
 *
 * **7 collection 전부 Skia generic 발효 완료 (ADR-912 단계 4, 2026-06-03~04)**:
 *   - data-bound row 순회형(GridList/Table) → row projection(canvasSceneNode appendXxxRowProjection)이
 *     각 행/셀을 독립 Skia 노드로 그림. 컨테이너 shell 은 buildCatalogShapes.
 *   - trigger-overlay(Select/ComboBox) + factory-child(Tabs/TagGroup) → C2(rule fill 정렬) +
 *     C3(SYNTHETIC text 차단)만으로 발효(row 순회 없음).
 *   - Menu(2026-06-04) → 캔버스에서 trigger Button 동형(SYNTHETIC 아님, items SSOT). C3·projector
 *     불필요. RAC 표준 MenuTrigger>Button+Popover>Menu — Skia 초기 시각 = trigger Button = Preview 초기.
 *   DOM(Preview)/Inspector 는 RAC items 자동 합성으로 이미 catalog generic. skiaLegacy 0건.
 */
const FAMILY_4_CUTOVER: CutoverState = "catalog";

const FAMILY_4_ENTRIES: ComponentCatalogEntry[] = [
  // ListBox — Skia generic 발효(skiaLegacy 미설정): shell 은 buildCatalogShapes, data row 는
  //   row projection(canvasSceneNode) 별도 경로. ADR-912 선행 collection proof.
  primitiveEntry("ListBox", "collections", FAMILY_4_CUTOVER, {
    category: "collections",
    label: "list box",
    icon: "ListIcon",
  }),
  // ADR-912 단계 4 (비-data-bound 4종 Skia generic 발효, 2026-06-03): Select/ComboBox/Tabs/
  //   TagGroup 의 skiaLegacy 제거 → isCatalogSkiaCutover=true → buildCatalogShapes 경로.
  //   안전 3계약 동반 land: C2(rule fill 정렬 — Tabs/TagGroup default variant 컨테이너 shell
  //   transparent+border 제거, componentRulesTable.ts) + C3(text 중복 방지 — SYNTHETIC 컨테이너
  //   shell-only propsView, buildSpecNodeData buildCatalogShapesOrPrimitive). 이들은
  //   trigger-overlay(Select/ComboBox) / factory-child(Tabs/TagGroup)라 row 순회 없음 → C1
  //   projector 불필요. Select/ComboBox 컨테이너 rule variants:{} 빈값(의도된 transparent, 자식
  //   trigger 가 bg/border 담당) → C2 변경 0.
  primitiveEntry("Select", "collections", FAMILY_4_CUTOVER, {
    category: "forms",
    label: "select",
    icon: "ChevronDown",
  }),
  primitiveEntry("ComboBox", "collections", FAMILY_4_CUTOVER, {
    category: "forms",
    label: "combo box",
    icon: "ChevronDown",
  }),
  primitiveEntry("Tabs", "collections", FAMILY_4_CUTOVER, {
    category: "layout",
    label: "tabs",
    icon: "AppWindow",
  }),
  primitiveEntry("TagGroup", "collections", FAMILY_4_CUTOVER, {
    category: "collections",
    label: "tag group",
    icon: "Tag",
  }),
  // GridList — Skia generic 발효 (skiaLegacy 제거, ADR-912 단계 4 C1 2026-06-03): data card 는
  //   GridListItem row projection(canvasSceneNode appendGridListRowProjection → GridListItem.spec
  //   render.shapes)이 각 카드를 독립 Skia 노드로 그림. GridList.render.shapes 는 container shell only
  //   (ADR-146 ListBox 동형). C2(rule transparent 정합) + C3(SYNTHETIC text 차단). Table 2D 보류.
  primitiveEntry("GridList", "collections", FAMILY_4_CUTOVER, {
    category: "collections",
    label: "grid list",
    icon: "Grid",
  }),
  // Breadcrumbs — Skia generic 발효 (ADR-912 영역 B (A) 2026-06-08): crumb 은 items SSOT
  //   (StoredBreadcrumbItem) → appendBreadcrumbRowProjection 이 Breadcrumbs.props.items 를 직접
  //   읽어 crumb projection 노드 전개(중간 컨테이너 없음 — Tag/Tab 2단과 다른 1단 직접). crumb 시각은
  //   generic box+text 아니라 Breadcrumb.spec.render.shapes 유지(separator/isLast 강조 로직 보존).
  //   DOM 은 delegating renderBreadcrumbs(useResolvedCollectionItems). container shell only(GridList 동형).
  primitiveEntry("Breadcrumbs", "collections", FAMILY_4_CUTOVER, {
    category: "navigation",
    label: "breadcrumbs",
    icon: "ChevronRight",
  }),
  // Menu — Skia generic 발효 (skiaLegacy 제거, ADR-912 단계 4 2026-06-04): Menu 는 캔버스에서
  //   trigger Button 과 동일한 시각 요소(RAC 표준 MenuTrigger>Button+Popover>Menu — 초기 화면에
  //   보이는 것은 trigger Button, 메뉴 리스트는 Popover 안에 숨김). Skia 정적 캔버스는 popover 를
  //   열지 않으므로 trigger 버튼만 그리면 Preview 초기와 일치. 직전 "popup↔trigger 본질 모순"
  //   framing 은 popup 드롭다운(.react-aria-Menu, Popover 전용 CSS)을 Menu 요소의 초기 시각으로
  //   오인한 것(정정 2026-06-04). Menu 는 SYNTHETIC 아님(factory children:[], items SSOT) →
  //   buildCatalogShapes 가 text "Menu" 그림(C3 차단 미적용, Button 동형). rule fill base
  //   `{color.neutral}` == Button `{color.neutral}`. legacy render.shapes(bg+border+text"Menu")와
  //   parity, 유일 차이 text align(legacy left → catalog center)는 Button center 정합(정렬 정정).
  primitiveEntry("Menu", "collections", FAMILY_4_CUTOVER, {
    category: "collections",
    label: "menu",
    icon: "Menu",
  }),
];

/**
 * ADR-142 family ⑤(Tree·Table) cutover 상태. Tree/Table 2개.
 *
 * **Tree — Skia generic 발효 (skiaLegacy 제거, 2026-06-01 G2(a))**: Tree render.shapes 는 이미
 * shell(bg `{color.base}` + border) 만 그리고(ADR 2026-05-18 더미 트리 제거), TreeItem 은 factory
 * 가 canonical 자식 element 로 생성(`createTreeDefinition`) → 각 TreeItem 이 독립 Skia 노드로
 * 행을 렌더한다. 즉 재귀 collection 이 아니라 child element 자동 순회 구조. buildCatalogShapes 가
 * variant fill base(= `resolveStateColors(...).background`) + border 로 동일 shell 을 그리고,
 * Tree factory props 에 label/text 없음 → text 미렌더로 legacy parity. items 소실 위험 0.
 *
 * **Table — Skia generic 발효 (skiaLegacy 제거, ADR-912 단계 4 C1 2026-06-03)**: render.shapes
 * 가 그리던 props.rows/columns 2D grid(header/row/cell)는 Table projected tree
 * (canvasSceneNode appendTableRowProjection → TableRow/TableCell.spec.render.shapes)로 이전.
 * 컨테이너 shell 은 buildCatalogShapes(rule fill {color.base} + border {color.border})가 렌더.
 * 사용자 결정 "행 단위 셀 노드"(RowsGroup→Row[i]→Cell[i][j]) — cell 단위 hit-test + window 가상화.
 * TableView 는 inventory §2-1 primitive 49 에 없음(LayoutRenderer 전용 layout helper) → 제외.
 */
const FAMILY_5_CUTOVER: CutoverState = "catalog";

const FAMILY_5_ENTRIES: ComponentCatalogEntry[] = [
  primitiveEntry("Tree", "tree-table", FAMILY_5_CUTOVER, {
    category: "collections",
    label: "tree",
    icon: "ListTree",
  }),
  // ADR-912 단계 4 C1 (2026-06-03): Table Skia generic 발효 (skiaLegacy 제거). 2D grid
  //   (header/row/cell)는 Table projected tree(appendTableRowProjection → TableRow/TableCell.
  //   spec.render.shapes)가 렌더, 컨테이너 shell 은 buildCatalogShapes(rule fill {color.base} +
  //   border {color.border}). 사용자 결정 "행 단위 셀 노드" (RowsGroup→Row[i]→Cell[i][j]).
  primitiveEntry("Table", "tree-table", FAMILY_5_CUTOVER, {
    category: "collections",
    label: "table",
    icon: "TableProperties",
  }),
];

/**
 * ADR-142 family ⑥(overlays) cutover 상태. Dialog/Modal/Popover/Tooltip/DropZone 5개.
 * **전부 Skia generic 발효 완료 (skiaLegacy 0건)**: Dialog/Modal/Popover/Tooltip 는
 * buildCatalogShapes(box+text) + skiaPrimitive(backdrop/shadow/arrow 합성), DropZone 는 box.
 * Tooltip 은 ADR-912 단계 5 (1b) 에서 마지막 발효(bg+text generic + tooltip_arrow append).
 * Toast 는 imperative API(useToast/ToastProvider — placeable 노드 아님, ComponentList/factory
 * 미등록) → catalog 제외.
 */
const FAMILY_6_CUTOVER: CutoverState = "catalog";

const FAMILY_6_ENTRIES: ComponentCatalogEntry[] = [
  // Dialog — Skia generic 발효 (skiaLegacy 제거, ADR-142 Inc3 2026-06-01): bg 는
  //   buildCatalogShapes(variant fill {color.layer-1}), backdrop + shadow 는 skiaPrimitive
  //   (overlay_backdrop / dialog_shadow, prepend) 합성. render.shapes 와 parity.
  primitiveEntry("Dialog", "overlays", FAMILY_6_CUTOVER, {
    category: "overlays",
    label: "dialog",
    icon: "AppWindowMac",
  }),
  // Modal — Skia generic 발효 (skiaLegacy 제거, ADR-142 Inc3 2026-06-01): render.shapes=[],
  //   buildCatalogShapes 가 variant fill transparent shell(무해) → legacy [] 와 시각 동일.
  //   backdrop 은 ModalOverlay 별도 담당 → skiaPrimitive 불필요.
  primitiveEntry("Modal", "overlays", FAMILY_6_CUTOVER, {
    category: "overlays",
    label: "modal",
    icon: "InspectionPanel",
  }),
  // Popover — Skia generic 발효 (skiaLegacy 제거, ADR-142 Inc3 2026-06-01): bg/border 는
  //   buildCatalogShapes(variant fill {color.layer-2}), drop shadow + V-arrow 는 skiaPrimitive
  //   (popover_shadow prepend / popover_arrow append) 합성. render.shapes 와 완전 parity.
  primitiveEntry("Popover", "overlays", FAMILY_6_CUTOVER, {
    category: "overlays",
    label: "popover",
    icon: "AppWindowMac",
  }),
  // Tooltip — Skia generic 발효 (skiaLegacy 제거, ADR-912 단계 5 (1b) 2026-06-04): bg(roundRect)
  //   + text 는 buildCatalogShapes(variant fill {color.neutral-subtle}, text {color.neutral} —
  //   rule table 과 spec 일치), arrow 는 skiaPrimitive(tooltip_arrow, append) 합성. Tooltip 은
  //   SYNTHETIC 아님(text content 가 본문) → buildCatalogShapes 가 text 자연 렌더(Menu 동형).
  primitiveEntry("Tooltip", "overlays", FAMILY_6_CUTOVER, {
    category: "overlays",
    label: "tooltip",
    icon: "MessageSquare",
  }),
  primitiveEntry("DropZone", "overlays", FAMILY_6_CUTOVER, {
    category: "forms",
    label: "drop zone",
    icon: "Upload",
  }),
];

/**
 * ADR-142 family ⑦(date) cutover 상태. date 4개(Calendar/RangeCalendar/DatePicker/
 * DateRangePicker). **Skia generic 발효 완료 (skiaLegacy 제거, ADR-912 단계 5 (1b) 2026-06-04)**:
 * 날짜 grid(6주×7일 cell)는 `calendar_grid` skiaPrimitive(replace, Calendar/RangeCalendar 공유),
 * trigger field(input box + display text + calendar icon)는 `datefield_trigger` skiaPrimitive
 * (replace, DatePicker/DateRangePicker 공유)로 이전 — spec.render.shapes → escape hatch. DOM 은
 * RAC 가 grid/field 자동 합성. nested 시 child CalendarGrid(non-catalog) 가 grid 담당, parent 는
 * shell/transparent. Popover 는 클릭 시 열리는 portal(정적 캔버스 미표시) → 정적 노드 무관.
 *
 * **color 제외 (사용자 지시 2026-05-31 "TailSwatch 는 패스해")**: TailSwatch(=ColorPicker alias)
 * + ColorArea/ColorWheel/ColorSlider/ColorSwatch(ColorPicker 내부 part)는 family ⑦ cutover
 * 대상 제외 — 별도 처리. arc/wheel/gradient 시각이라 skiaPrimitive 설계가 필요한 영역.
 */
const FAMILY_7_CUTOVER: CutoverState = "catalog";

const FAMILY_7_ENTRIES: ComponentCatalogEntry[] = [
  // Calendar/RangeCalendar — calendar_grid skiaPrimitive(replace), binding 이 키 지정.
  primitiveEntry("Calendar", "date-color", FAMILY_7_CUTOVER, {
    category: "date",
    label: "calendar",
    icon: "Calendar",
  }),
  primitiveEntry("RangeCalendar", "date-color", FAMILY_7_CUTOVER, {
    category: "date",
    label: "range calendar",
    icon: "CalendarDays",
  }),
  // DatePicker/DateRangePicker — datefield_trigger skiaPrimitive(replace), binding 이 키 지정.
  primitiveEntry("DatePicker", "date-color", FAMILY_7_CUTOVER, {
    category: "date",
    label: "date picker",
    icon: "CalendarCheck",
  }),
  primitiveEntry("DateRangePicker", "date-color", FAMILY_7_CUTOVER, {
    category: "date",
    label: "date range picker",
    icon: "CalendarDays",
  }),
];

/**
 * ADR-142 family ⑧(composition-native) native entry 헬퍼. frame/Slot/MaskedFrame 은 RAC
 * primitive 도 reusable 문서도 아닌 canonical 일급 노드 → binding/reusableId/cutover 없음.
 */
function nativeEntry(
  type: string,
  panel: { category: string; label: string; icon: string },
): Extract<ComponentCatalogEntry, { kind: "native" }> {
  return {
    kind: "native",
    type,
    family: "composition-native",
    panel: { ...panel, placeable: true },
  };
}

/**
 * ADR-142 family ⑧(composition-native). frame/MaskedFrame/Slot. **metadata-only 등록**
 * (사용자 결정 2026-05-31) — cutover 게이트 미포함, 렌더는 기존 canonical-native 유지
 * (frame→div generic / Slot renderer). catalog 등록은 팔레트/factory metadata SSOT 통합 목적.
 */
const FAMILY_8_ENTRIES: ComponentCatalogEntry[] = [
  nativeEntry("frame", {
    category: "layout",
    label: "frame",
    icon: "GroupIcon",
  }),
  nativeEntry("MaskedFrame", {
    category: "layout",
    label: "masked frame",
    icon: "Frame",
  }),
  nativeEntry("Slot", { category: "layout", label: "slot", icon: "Layers" }),
];

/**
 * 컴포넌트 카탈로그 — 등록 SSOT. family cutover 진행 시 family 별 entry 가 누적된다.
 * 현재 family ①~⑧ 등록 — ⑦ color(TailSwatch) 는 사용자 지시로 제외(별도 처리).
 * ⑧ native(frame/Slot)는 metadata-only(cutover 게이트 미포함, canonical-native 렌더 유지).
 */
export const componentCatalog: readonly ComponentCatalogEntry[] = [
  ...FAMILY_1_ENTRIES,
  ...FAMILY_2_ENTRIES,
  ...FAMILY_3_ENTRIES,
  ...FAMILY_4_ENTRIES,
  ...FAMILY_5_ENTRIES,
  ...FAMILY_6_ENTRIES,
  ...FAMILY_7_ENTRIES,
  ...FAMILY_8_ENTRIES,
];

/** type → catalog entry 조회 (O(1)). */
const CATALOG_BY_TYPE: ReadonlyMap<string, ComponentCatalogEntry> = new Map(
  componentCatalog.map((e) => [e.type, e]),
);

export function getCatalogEntry(
  type: string,
): ComponentCatalogEntry | undefined {
  return CATALOG_BY_TYPE.get(type);
}

/**
 * `cutover === "catalog"` 인 type 집합 — DOM(Preview)/Inspector/Skia catalog 게이트의 파생 source.
 * **ADR-912 단계 5 step 1 (2026-06-04)**: skiaLegacy 0건 도달 → 본 집합이 DOM/Skia 공통 발효
 * 집합. native(frame/Slot)는 cutover 개념 없음(metadata-only)으로 제외.
 */
export function getCatalogCutoverTypes(): ReadonlySet<string> {
  return new Set(
    componentCatalog
      // native(frame/Slot)는 cutover 개념 없음 — metadata-only, canonical-native 렌더 유지.
      .filter((e) => e.kind !== "native" && e.cutover === "catalog")
      .map((e) => e.type),
  );
}

/**
 * @deprecated ADR-912 단계 5 step 1 (2026-06-04) — `skiaLegacy` 게이트 의미 소멸.
 * 단계 5 (1b) 에서 skiaLegacy 0건 도달 → Skia generic 발효 집합이 DOM/Inspector 집합
 * (`getCatalogCutoverTypes`) 과 항상 동일. 본 함수는 `getCatalogCutoverTypes` 위임으로
 * collapse 됐고, 호출처 정리(step 2 — buildSpecNodeData fallback 제거) 후 삭제 예정.
 */
export function getCatalogSkiaCutoverTypes(): ReadonlySet<string> {
  return getCatalogCutoverTypes();
}
