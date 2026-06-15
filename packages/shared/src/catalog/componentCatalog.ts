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
  PanelMeta,
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
  // ADR-912 R7 G1-c (2026-06-15): 버튼 묶음 컨테이너. factory 가 자식 Button×2(Cancel/Save) 자동
  //   생성 → 런타임 항상 _hasChildren=true → spec render.shapes standalone box 분기 dead, 자식 Button
  //   self-draw (AvatarGroup/CardView/TableView/Pagination 동형). variant default 전부 transparent →
  //   buildCatalogShapes 투명 generic box shell. 시각 source = COMPONENT_RULES_TABLE.ButtonGroup.
  //   layout(flex/gap)은 factory props.style SSOT(ADR-907 Layer B). generate-css virtual = size별 gap
  //   제거(factory SSOT) + 빈 hover/pressed transparent 블록 noise 제거(AvatarGroup 동형, 시각 손실 0).
  primitiveEntry("ButtonGroup", "primitives", FAMILY_1_CUTOVER, {
    category: "buttons",
    label: "button group",
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
    icon: "Text",
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
    icon: "FileUp",
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
    category: "collections",
    label: "section",
    icon: "Square",
  }),
  primitiveEntry("Nav", "primitives", FAMILY_1_CUTOVER, {
    category: "layout",
    label: "navigation",
    icon: "Menu",
  }),
  // ADR-912 R7 G1-c (2026-06-15): 페이지네이션 컨테이너. factory 가 자식 Button×5(←/1/2/3/→) 자동
  //   생성 → 런타임 항상 _hasChildren=true → spec render.shapes standalone 버튼군 dead, 컨테이너
  //   box(flex row)만 live → buildCatalogShapes generic box shell 로 시각 대칭(AvatarGroup/CardView/
  //   TableView 동형). staticSelectors 7개(.pagination-controls / .react-aria-Button[data-current])는
  //   generate-css TEXT_LEAF_META.composition 으로 전달 → CSSGenerator emit(Link rootSelectors 선례).
  primitiveEntry("Pagination", "primitives", FAMILY_1_CUTOVER, {
    category: "layout",
    label: "pagination",
    icon: "ChevronsLeftRight",
  }),
  // ADR-912 §2-5 collapse 진입 proof slice (2026-06-10): Disclosure 컨테이너. SHELL_ONLY →
  //   spec.render.shapes `[]`(투명 레이아웃, Disclosure.spec.ts:181) → catalog 등록 후 Skia 는
  //   buildCatalogShapes generic 빈 shell(rule variants:{} → visual undefined → hasVisibleBg=false,
  //   buildCatalogShapes.ts:148) → spec `[]` 과 시각 대칭(둘 다 빈 box). DOM 은
  //   rendererMap.renderDisclosure 위임(DELEGATING_INTERNAL_RENDERERS, self-compose title 추출 +
  //   expand/collapse 보존 — generic 자식 재귀로는 깨짐). ProgressBar/Tabs/Breadcrumbs 동형 위임.
  //   6-registry collapse 의 첫 shell entry proof.
  primitiveEntry("Disclosure", "primitives", FAMILY_1_CUTOVER, {
    category: "layout",
    label: "disclosure",
    icon: "ChevronDown",
  }),
  // ADR-912 Disclosure 군 일괄 cutover (2026-06-10): 디스클로저 그룹 컨테이너 (사용자 "Accordion"
  //   통칭). catalog 등록으로 spec.render.shapes Skia fallback 제거 — 시각은 rule
  //   (COMPONENT_RULES_TABLE.DisclosureGroup, variants default/accent) + buildCatalogShapes generic
  //   box+border(SHELL_ONLY shell). DOM=renderDisclosureGroup generic 자식 재귀 (DELEGATING 불필요).
  primitiveEntry("DisclosureGroup", "primitives", FAMILY_1_CUTOVER, {
    category: "layout",
    label: "disclosure group",
    icon: "ChevronDown",
  }),
  // ADR-912 internal 4 slice (2026-06-04): 인라인 알림 box leaf (internal source). catalog 등록으로
  //   spec.render.shapes Skia fallback 제거 — 시각은 rule(COMPONENT_RULES_TABLE.InlineAlert, 5 variant)
  //   + buildCatalogShapes generic box+border(shell, render.shapes 가 text 0 → 자식 Element 가
  //   heading/desc 담당). DOM 은 generic fallback(rendererMap 제거) + staticAttrs role="alert".
  primitiveEntry("InlineAlert", "primitives", FAMILY_1_CUTOVER, {
    category: "content",
    label: "inline alert",
    icon: "AlertTriangle",
  }),
  // ADR-912 진로 1번 IllustratedMessage proof slice (2026-06-06): 빈 상태(empty state) internal leaf.
  //   catalog 등록으로 spec.render.shapes Skia fallback 제거 — Skia 는 skiaPrimitive
  //   "illustrated_message" escape(placeholder+heading+description, append), DOM 은 INTERNAL_RENDERERS
  //   ["illustrated"](IllustratedMessage.tsx, props.heading/description 직접 소비). heading/description
  //   이 자식 Element 아닌 props(factory children:[]) → generic fallback 미적용, 어댑터 필수.
  primitiveEntry("IllustratedMessage", "primitives", FAMILY_1_CUTOVER, {
    category: "content",
    label: "illustrated message",
    icon: "ImageIcon",
  }),
  // ADR-912 진로 1번 StatusLight proof slice (2026-06-06): 상태 표시 dot+label internal leaf.
  //   Skia 는 skiaPrimitive "status_light" escape(dot circle + text, replace — box 무의미),
  //   DOM 은 INTERNAL_RENDERERS["statuslight"](StatusLight.tsx, props.variant/size/children 소비).
  //   기존 dot primitive(isDot gate, Checkbox/Radio)와 별개 escape.
  primitiveEntry("StatusLight", "primitives", FAMILY_1_CUTOVER, {
    category: "content",
    label: "status light",
    icon: "CircleDot",
  }),
  // ADR-912 진로 1번 Avatar proof slice (2026-06-06): 사용자 아바타 circle+image internal leaf.
  //   Skia 는 skiaPrimitive "avatar" escape(circle bg + image|initials, replace — buildCatalogShapes
  //   image 미지원), DOM 은 INTERNAL_RENDERERS["avatar"](Avatar.tsx, props.src/initials/size 소비).
  //   src/initials 가 자식 Element 아닌 props(factory children:[]) → generic fallback 미적용, 어댑터 필수.
  primitiveEntry("Avatar", "primitives", FAMILY_1_CUTOVER, {
    category: "content",
    label: "avatar",
    icon: "CircleUser",
  }),
  // ADR-912 진로 1번 ProgressCircle proof slice (value-fill, 2026-06-06): 원형 진행률 internal leaf.
  //   Skia 는 skiaPrimitive "value_fill_arc" escape(track arc 360° + value 비례 indicator arc, replace —
  //   buildCatalogShapes arc 미지원), DOM 은 INTERNAL_RENDERERS["progresscircle"](ProgressCircle.tsx,
  //   props.value/size/isIndeterminate 소비, SVG circle stroke-dasharray). value/size 가 자식 Element 아닌
  //   props(factory children:[]) → generic fallback 미적용, 어댑터 필수(Avatar circle escape 동형).
  primitiveEntry("ProgressCircle", "primitives", FAMILY_1_CUTOVER, {
    category: "content",
    label: "progress circle",
    icon: "CircleDashed",
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
  // ADR-912 box+text 변환 군 DisclosureContent 발효 (2026-06-10): Disclosure 패널 콘텐츠 leaf
  //   (inline text container div). catalog 등록으로 spec.render.shapes Skia fallback 제거 — Skia 는
  //   buildCatalogShapes box+text generic(rule DisclosureContent: fontSize+lineHeight+textWeight 400,
  //   paddingX 미정의=0), DOM 은 부모 renderDisclosure contentChildren 재귀 → renderDisclosureContent
  //   `<div style>`. **padding 단일 source = element.props.style** — spec sizes.paddingX(md 12)가
  //   Skia text x 에만 적용되던 "padding Skia-only" 비대칭(사용자 보고 2026-06-10) 해소. Description
  //   동형(inline text leaf, height:0). palette 비노출(Disclosure 자식, ComponentList 미등록 — 단독
  //   배치 안 함, DisclosureHeader 동형).
  primitiveEntry("DisclosureContent", "primitives", FAMILY_1_CUTOVER, {
    category: "structure",
    label: "disclosure content",
    icon: "AlignLeft",
  }),
  // ADR-912 (B+icon) CalendarHeader 발효 (inline_icon_text replace, 2026-06-08): Calendar 네비게이션
  //   헤더 leaf(좌 chevron + 중앙 월/년 text + 우 chevron). DisclosureHeader 의 leading_icon(append)
  //   확장 — "좌 icon + center text + 우 icon" 은 다른 레이아웃 가정이라 별도 `inline_icon_text`
  //   skiaPrimitive(replace, skiaPrimitives.ts)가 전체 3-shape 자기 생성(buildCatalogShapes box+text
  //   대체 — center text 충돌). 우측 chevron containerWidth 의존 → CONTAINER_DIMENSION_TAGS 등록.
  //   DOM 은 부모 Calendar/RangeCalendar(Calendar.tsx:113 self-compose `<header>`)가 흡수, children
  //   미렌더 → CalendarHeader DOM 독립 노드 0(catalog 등록 후에도 DOM 변화 없음, Skia spec.render.shapes
  //   fallback 제거가 목적). Calendar 의 calendar_grid escape 는 _hasChildren=true 시 bg shell 만
  //   (line 657 return) → 자식 CalendarHeader/CalendarGrid 가 각자 렌더(이중 렌더 아님). palette
  //   비노출(Calendar 자식, 단독 배치 안 함).
  primitiveEntry("CalendarHeader", "primitives", FAMILY_1_CUTOVER, {
    category: "structure",
    label: "calendar header",
    icon: "ChevronsLeftRight",
  }),
  // ADR-912 (A/2D): CalendarGrid leaf (calendar_month_grid replace — 요일 헤더 + 날짜 셀 + today circle).
  //   recon(6축) 으로 즉시 차단 absent(day cell self-render, List ListItem NO_SPEC 같은 차단 없음) +
  //   date state static props 자기충족 확정. CalendarHeader 동형 standalone replace escape. nav 는 없음
  //   (nav = CalendarHeader 담당) → 부모 calendar_grid(nav 포함)와 별개 키. DOM 은 부모 Calendar/
  //   RangeCalendar(Calendar.tsx:122 self-compose `<CalendarGrid>`)가 흡수, children 미렌더 →
  //   CalendarGrid DOM 독립 노드 0(catalog 등록 후에도 DOM 변화 없음, Skia spec.render.shapes fallback
  //   제거가 목적). Calendar calendar_grid escape 는 _hasChildren=true 시 shell 만 → 자식 CalendarGrid
  //   가 grid 렌더(이중 렌더 아님). palette 비노출(Calendar 자식, 단독 배치 안 함).
  primitiveEntry("CalendarGrid", "primitives", FAMILY_1_CUTOVER, {
    category: "structure",
    label: "calendar grid",
    icon: "CalendarDays",
  }),
  // ADR-912 deletion-risk(date): DateInput leaf (datefield_segments replace — input box + border +
  //   세그먼트 placeholder text + picker icon). DateInput.spec render.shapes 가 유일 Skia source 였던
  //   차단 해소 — escape 로 이전. DOM 은 부모 DateField/TimeField/DatePicker/DateRangePicker self-compose
  //   (`<DateInput>{(segment)=>...}`)가 흡수, children 미렌더 → DateInput DOM 독립 노드 0(catalog 등록
  //   후에도 DOM 변화 없음, INTERNAL_RENDERERS 미등록 → cutover generic 320 PrimitiveComponent=undefined
  //   → 블록 skip). controller 0 self-render(static placeholder, CalendarGrid 동형).
  primitiveEntry("DateInput", "primitives", FAMILY_1_CUTOVER, {
    category: "structure",
    label: "date input",
    icon: "Calendar",
  }),
  // ADR-912 R6 (2026-06-15): Card 본체 S2 재설계 catalog cutover. 구 Card.spec(비표준 cardType/
  //   isQuiet 분기, skipCSSGeneration:false → 자체 Card.css)을 제거하고 S2 정본 variant 모델
  //   (primary/secondary/tertiary/quiet)로 재생성 — quiet=transparent base 로 isQuiet boolean 흡수,
  //   isSelected→selectedBorder accent. 시각 source = COMPONENT_RULES_TABLE.Card(variants 4종 fill).
  //   Skia=buildCatalogShapes shell(컨테이너 _hasChildren → bg+border 만, 자식 Element 가 내용 렌더),
  //   DOM=react-aria-Card[data-variant] generic. layout=factory props.style(ADR-907 Layer B). palette
  //   노출(기존 PALETTE_ONLY overlay → catalog entry.panel 파생으로 전환, category layout). R2 TreeItem
  //   패턴(제거→레퍼런스 재생성)의 컨테이너 적용 사례.
  primitiveEntry("Card", "primitives", FAMILY_1_CUTOVER, {
    category: "layout",
    label: "card",
    icon: "AppWindowMac",
  }),
  // ADR-912 childSpec→catalog cutover (2026-06-15): Card 4 자식 슬롯 컨테이너 일괄 (CardHeader/
  //   CardContent/CardFooter/CardPreview). Card.spec.childSpecs(ADR-094 expandChildSpecs) 경로로
  //   TAG_SPEC_MAP/Taffy 자동 등록 + Card.css embedded CSS 였던 것을 catalog 로 전환 — Skia 는
  //   buildCatalogShapes shell(투명, rule variants:{} → fill 없음, render.shapes []와 동일), DOM 은
  //   부모 Card 자식 재귀로 generic `<div>`. layout(flex/row|column/gap/width)은 factory props.style
  //   복귀(ADR-092 가 spec containerStyles 로 이관했던 것 — Skia/Taffy 직접 read). FormField/
  //   DialogFooter 동형. DisclosureHeader/Content sub-part 선례 동일 — category "structure", palette
  //   비노출(Card 자식, ComponentList 미등록 → 단독 배치 안 함).
  primitiveEntry("CardHeader", "primitives", FAMILY_1_CUTOVER, {
    category: "structure",
    label: "card header",
    icon: "PanelTop",
  }),
  primitiveEntry("CardContent", "primitives", FAMILY_1_CUTOVER, {
    category: "structure",
    label: "card content",
    icon: "AlignLeft",
  }),
  primitiveEntry("CardFooter", "primitives", FAMILY_1_CUTOVER, {
    category: "structure",
    label: "card footer",
    icon: "PanelBottom",
  }),
  primitiveEntry("CardPreview", "primitives", FAMILY_1_CUTOVER, {
    category: "structure",
    label: "card preview",
    icon: "Image",
  }),
  // ADR-912 R7 G1-a/b (2026-06-15): container shell 3종 catalog cutover (AvatarGroup/CardView/
  //   TableView). 각 spec(skipCSSGeneration:false → 자체 generated/{X}.css)을 generate-css virtual
  //   로 DOM CSS source 이전(R7 G1-a/b) 후 catalog 등록 — Skia 시각도 spec.render.shapes →
  //   buildCatalogShapes generic box shell 로 이전(isCatalogCutover 게이트 활성). 시각 source =
  //   COMPONENT_RULES_TABLE.{X}. layout 은 factory props.style SSOT(ADR-907 Layer B). DOM 은 전용
  //   rendererMap(renderAvatarGroup/renderCardView/renderTableView) 유지 — INTERNAL_RENDERERS 미등록
  //   + cutoverTypes 미포함 → generic 전환 아님(전용 렌더러 inline style 이 DOM 시각, generated CSS
  //   보조). catalog entry 는 Skia 게이트 활성 + palette source 목적. Card 본체(R6) 동형.
  //   TableView 는 isQuiet boolean → variant:quiet 흡수(S2 정본 variant 모델, D2 BC 사용자 승인).
  primitiveEntry("AvatarGroup", "primitives", FAMILY_1_CUTOVER, {
    category: "layout",
    label: "avatar group",
    icon: "Users",
  }),
  primitiveEntry("CardView", "primitives", FAMILY_1_CUTOVER, {
    category: "layout",
    label: "card view",
    icon: "LayoutGrid",
  }),
  primitiveEntry("TableView", "primitives", FAMILY_1_CUTOVER, {
    category: "layout",
    label: "table view",
    icon: "Table",
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
    category: "dateTime",
    label: "date field",
    icon: "CalendarCheck",
  }),
  primitiveEntry("TimeField", "fields", FAMILY_2_CUTOVER, {
    category: "dateTime",
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
  // ADR-912 6 registry collapse T1 (catalog 미등록 spec cutover 첫 slice, 2026-06-11): 데이터 매핑
  //   internal leaf. render.shapes `() => []`(Skia 0 shape) → escape 불필요, generic 0 shape.
  //   palette 미노출(데이터 매핑 — PALETTE_ORDER 비포함, sub-part/leaf 24 미노출 패턴). DOM 은
  //   rendererMap.Field=renderDataField 위임(DELEGATING — 부모 value lookup + childrenByParent).
  //   catalog 등록 목적은 isCatalogSkiaCutover 게이트 통과 — spec 삭제 후에도 Skia 빈 노드 정상 처리.
  primitiveEntry("Field", "fields", FAMILY_2_CUTOVER, {
    category: "forms",
    label: "field",
    icon: "Tag",
  }),
  // ADR-912 childSpec→catalog cutover (2026-06-15): Form 필드 그룹 슬롯 컨테이너 sub-part
  //   (DialogFooter 동형 — 두 번째 childSpec 제거). render.shapes `() => []`(Skia 0 shape) →
  //   escape 불필요, generic 0 shape(shell). palette 미노출(sub-part — PALETTE_ORDER 비포함).
  //   catalog 등록 목적 = isCatalogCutover 게이트 통과 → Form.spec.childSpecs 제거 후에도 Skia/Taffy
  //   빈 노드 정상 처리. layout 은 factory props.style(FormComponents.ts:222-227, ADR-907 Layer B).
  primitiveEntry("FormField", "fields", FAMILY_2_CUTOVER, {
    category: "forms",
    label: "form field",
    icon: "Tag",
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
    category: "content",
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
  // ADR-912 SliderTrack value-fill (value-fill 4 완결, 2026-06-08): Slider compound 의 트랙.
  //   palette 미노출(ComponentList 가 Slider 부모만 등록) — catalog 등록은 Skia generic 경로
  //   (slider_fill_bar escape, replace) 진입용. DOM 은 부모 RAC Slider 가 track self-compose.
  //   ProgressBarTrack 동형 + thumb 채널(단일 1 / range 2). layout box=thumbSize(thumb 컨테이너).
  primitiveEntry("SliderTrack", "selection", FAMILY_3_CUTOVER, {
    category: "forms",
    label: "slider track",
    icon: "SlidersHorizontal",
  }),
  // ADR-912 value-label 군 (2026-06-11): Meter/ProgressBar/Slider 의 value text leaf.
  //   palette 미노출(ComponentList 가 부모만 등록) — catalog 등록은 Skia generic 경로
  //   (buildCatalogShapes text) 진입용. 부모가 resolveProgressProps/factory 로
  //   children=formatted value 주입(buildSpecNodeData.ts:578) → 자식이 rule.variants(text color)
  //   + sizes(fontSize/lineHeight)로 text 그림. DOM 은 부모 RAC 가 value label self-compose.
  //   Track sub-part 동형 — spec 삭제 후 isCatalogSkiaCutover 게이트(buildSpecNodeData.ts:932)
  //   통과로 value text Skia 보존(미발효 시 return null → value 소실).
  primitiveEntry("MeterValue", "selection", FAMILY_3_CUTOVER, {
    category: "forms",
    label: "meter value",
    icon: "Gauge",
  }),
  primitiveEntry("ProgressBarValue", "selection", FAMILY_3_CUTOVER, {
    category: "forms",
    label: "progress bar value",
    icon: "BarChart3",
  }),
  primitiveEntry("SliderOutput", "selection", FAMILY_3_CUTOVER, {
    category: "forms",
    label: "slider output",
    icon: "SlidersHorizontal",
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
  // ADR-912 collection sub-part cutover (2026-06-14): ListBoxItem catalog cutover.
  //   ListBox projection(appendListBoxRowProjection → ListBoxItem SceneNode)의 행 self-render 가
  //   spec.render.shapes(selection bg + icon + label fw600 + description neutral-subdued + check)
  //   였다 → rule + listbox_item skiaPrimitive(replace — multi-slot 행, gridlist_card 선례 동형)
  //   으로 이전. icon/label/description/selection 분기는 projection 이 icon/children/description/
  //   isSelected 보편 주입(ADR-142 §3). canonical 문서에 element 없음(projection 전용) → DOM 변화
  //   0, Skia 대칭(spec 의존 끊기 = step 4 삭제 안전) 한정.
  primitiveEntry("ListBoxItem", "collections", FAMILY_4_CUTOVER, {
    category: "collections",
    label: "list box item",
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
  // ADR-912 R1 Select family rebuild (2026-06-12): field-trigger 공용 sub-part 3종 발효.
  //   Select/ComboBox/NumberField/SearchField 의 trigger box / value text / icon glyph.
  //   기존 synthetic 7 alias(ComboBoxWrapper/Input/Trigger + Search* 4)는 factory retype 으로
  //   본 3 type 에 합류 → BUILDER_ALIAS_MAP 해체 + SelectTrigger/Value/Icon spec 삭제.
  //   palette 비노출(PALETTE_ORDER 비포함 sub-part). Skia=generic box/text + icon_font escape.
  primitiveEntry("SelectTrigger", "collections", FAMILY_4_CUTOVER, {
    category: "forms",
    label: "select trigger",
    icon: "ChevronDown",
  }),
  primitiveEntry("SelectValue", "collections", FAMILY_4_CUTOVER, {
    category: "forms",
    label: "select value",
    icon: "ChevronDown",
  }),
  primitiveEntry("SelectIcon", "collections", FAMILY_4_CUTOVER, {
    category: "forms",
    label: "select icon",
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
  // ADR-912 projection 3 cutover (2026-06-15): Tab/TabList projection sub-part. Tabs projection
  //   (appendTabRowProjection → Tab/TabList SceneNode)의 탭/컨테이너 self-render 가
  //   spec.render.shapes(Tab=라벨 text + 선택 accent indicator / TabList=하단/우측 구분선 line)였다 →
  //   rule + tab_indicator(append) / tablist_divider(append) escape 로 이전. canonical 문서에
  //   element 없음(propagation 으로 TabList.props.items + projection 전용 SceneNode) → DOM 변화 0,
  //   Skia 대칭(spec 의존 끊기 = step 4 삭제 안전) 한정. palette 비노출(PALETTE_ORDER 미포함, TableCell/
  //   TableRow 동형 — projection 데이터, 단독 배치 불가).
  primitiveEntry("Tab", "collections", FAMILY_4_CUTOVER, {
    category: "collections",
    label: "tab",
    icon: "AppWindow",
  }),
  primitiveEntry("TabList", "collections", FAMILY_4_CUTOVER, {
    category: "collections",
    label: "tab list",
    icon: "AppWindow",
  }),
  primitiveEntry("TagGroup", "collections", FAMILY_4_CUTOVER, {
    category: "collections",
    label: "type group",
    icon: "Tag",
  }),
  // TagList — catalog cutover (ADR-912 collection sub-part, 2026-06-15, TabList 동형): TagGroup
  //   projection 의 chip 컨테이너 shell. 기존 TagList.spec(render.shapes:()=>[] shell +
  //   skipCSSGeneration:true + containerStyles flex/row/wrap)이 Skia 진입 게이트(buildSpecNodeData
  //   `if(!spec) return null`)를 통과시키는 유일 근거였다. catalog 등록으로 rule(transparent box shell)
  //   + buildCatalogShapes generic 으로 이전 — chip 시각은 이미 cutover 된 Tag(appendTagRowProjection
  //   → Tag SceneNode)가 단독 담당, TagList 자체는 시각 없음(escape 불요). DOM 은 부모 TagGroup
  //   self-compose(.tag-list-wrapper 수동 CSS) → DOM 변화 0. palette 비노출(PALETTE_ORDER 비포함
  //   sub-part — TabList/GridListItem 동형).
  primitiveEntry("TagList", "collections", FAMILY_4_CUTOVER, {
    category: "collections",
    label: "tag list",
    icon: "Tag",
  }),
  // Tag — catalog cutover (ADR-912 영역 B (A), 2026-06-12): TagGroup chip 본체. 기존
  //   Tag.spec.render.shapes(bg roundRect + border + text + allowsRemoving 시 X line×2)가 Skia
  //   유일 source 였다. catalog 등록으로 rule(COMPONENT_RULES_TABLE.Tag: variants default/selected +
  //   sizes.{fontSize/lineHeight/borderRadius/height/paddingX}) + buildCatalogShapes generic(box+text)
  //   로 이전. **remove X 는 line×2 직접 그리기 폐기 → SelectIcon(iconName="x") 자식 노드**
  //   (appendTagRowProjection 이 allowsRemoving 시 chip 에 전개 — SearchField clear X 동형, X 는 이미
  //   catalog cutover 된 SelectIcon icon_font glyph). DOM 은 부모 TagGroup self-compose(renderTagGroup
  //   useCollectionData) → DOM 변화 0, Skia 시각 대칭(특히 X 가 line→Lucide glyph 로 DOM Button slot=remove 정합).
  primitiveEntry("Tag", "collections", FAMILY_4_CUTOVER, {
    category: "collections",
    label: "tag",
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
  // ADR-912 collection sub-part cutover (2026-06-14): GridListItem catalog cutover.
  //   GridList projection(appendGridListRowProjection → GridListItem SceneNode)의 카드 self-render
  //   가 spec.render.shapes(카드 box layer-1 + border + label fw600 + description neutral-subdued)
  //   였다 → rule + gridlist_card skiaPrimitive(replace — 2-line top-aligned 카드, Avatar 선례 동형)
  //   으로 이전. label/description 분기는 projection 이 children/description 보편 주입(ADR-142 §3).
  //   canonical 문서에 element 없음(projection 전용) → DOM 변화 0, Skia 대칭(spec 의존 끊기 =
  //   step 4 삭제 안전) 한정.
  primitiveEntry("GridListItem", "collections", FAMILY_4_CUTOVER, {
    category: "collections",
    label: "grid list item",
    icon: "Grid",
  }),
  // Breadcrumbs — Skia generic 발효 (ADR-912 영역 B (A) 2026-06-08): crumb 은 items SSOT
  //   (StoredBreadcrumbItem) → appendBreadcrumbRowProjection 이 Breadcrumbs.props.items 를 직접
  //   읽어 crumb projection 노드 전개(중간 컨테이너 없음 — Tag/Tab 2단과 다른 1단 직접). crumb 시각은
  //   generic box+text 아니라 Breadcrumb.spec.render.shapes 유지(separator/isLast 강조 로직 보존).
  //   DOM 은 delegating renderBreadcrumbs(useResolvedCollectionItems). container shell only(GridList 동형).
  primitiveEntry("Breadcrumbs", "collections", FAMILY_4_CUTOVER, {
    category: "layout",
    label: "breadcrumbs",
    icon: "ChevronRight",
  }),
  // ADR-912 projection 3 cutover (2026-06-15): Breadcrumb projection sub-part. Breadcrumbs projection
  //   (appendBreadcrumbRowProjection → Breadcrumb SceneNode)의 crumb self-render 가
  //   spec.render.shapes(라벨 text isLast→accent fw600 + 비-마지막 separator › text)였다 →
  //   rule + breadcrumb_crumb(replace, label+separator 위치 누적) escape 로 이전. canonical 문서에
  //   element 없음(Breadcrumbs.props.items 직접 → projection 전용 SceneNode) → DOM 변화 0, Skia 대칭
  //   한정. palette 비노출(PALETTE_ORDER 미포함, projection 데이터).
  primitiveEntry("Breadcrumb", "collections", FAMILY_4_CUTOVER, {
    category: "collections",
    label: "breadcrumb",
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
    category: "buttons",
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
  // ADR-912 R1 후속 (2026-06-12): TreeItem catalog cutover. spec.render.shapes(chevron +
  //   label, depth 무시 하드코딩 paddingX) → rule(leadingIcon chevron + indentPerLevel) +
  //   buildCatalogShapes generic + leading_icon append + depth indent(_treeLevel ×
  //   indentPerLevel). DisclosureHeader (B+icon) 동형 + depth 확장. DOM 은 부모 Tree 가
  //   RAC `<TreeItem>` self-compose(--tree-item-level 자동) → DOM 변화 0, Skia 들여쓰기 대칭 복원.
  primitiveEntry("TreeItem", "tree-table", FAMILY_5_CUTOVER, {
    category: "collections",
    label: "tree item",
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
  // ADR-912 Pattern B (collection sub-part, 2026-06-13): TableCell/TableRow catalog cutover.
  //   Table 2D projection(appendTableRowProjection → TableRow/TableCell SceneNode)의 셀/행
  //   self-render 가 spec.render.shapes 였다 → rule + buildCatalogShapes generic 으로 이전.
  //   TableCell=text-only(box transparent), TableRow=bg box + table_row_divider(하단 line) append.
  //   배경/굵기/정렬 분기는 projection 이 style 보편 D3 주입(ADR-142 §3). canonical 문서에 element
  //   없음(projection 전용) → DOM 변화 0, Skia 대칭(spec 의존 끊기 = step 4 삭제 안전) 한정.
  primitiveEntry("TableRow", "tree-table", FAMILY_5_CUTOVER, {
    category: "collections",
    label: "table row",
    icon: "TableProperties",
  }),
  primitiveEntry("TableCell", "tree-table", FAMILY_5_CUTOVER, {
    category: "collections",
    label: "table cell",
    icon: "TableProperties",
  }),
];

/**
 * ADR-142 family ⑥(overlays) cutover 상태. Dialog/Modal/Popover/Tooltip/DropZone 5개.
 * **전부 Skia generic 발효 완료 (skiaLegacy 0건)**: Dialog/Modal/Popover/Tooltip 는
 * buildCatalogShapes(box+text) + skiaPrimitive(backdrop/shadow/arrow 합성), DropZone 는 box.
 * Tooltip 은 ADR-912 단계 5 (1b) 에서 마지막 발효(bg+text generic + tooltip_arrow append).
 * Toast 는 ADR-912 R7 G1-c (2026-06-15) 에서 box-shell catalog cutover — 아래 FAMILY_6_ENTRIES
 * 에 등록. (구 주석 "placeable 노드 아님 → catalog 제외" 는 stale: RAC Toast 는 imperative API 지만
 * factory createToastDefinition + dedicated renderToast 가 등록되어 element 로 배치되면 TAG_SPEC_MAP
 * 경유 Skia 렌더 → spec.ts 가 Skia 시각 source 로 살아있었다. palette 미노출이라도 cutover 가치 =
 * spec 의존 끊기, ProgressBarTrack/MeterTrack "palette 미노출 — catalog 등록은 Skia generic 한정" 동형.)
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
  // DialogFooter — ADR-912 childSpec→catalog cutover (2026-06-15): Dialog 액션 버튼 영역 슬롯
  //   컨테이너 sub-part. Dialog factory 자동 생성(palette 미노출 — PALETTE_ORDER 비포함,
  //   SelectTrigger/SelectValue/Field 동형). spec(render.shapes []) 의 childSpecs(ADR-094
  //   expandChildSpecs) 경로 → catalog generic box shell 로 cutover. 시각 shell-only(투명 fill
  //   없음 — footer 시각은 자식 버튼 Element). footer layout(flex/justifyContent/gap)은 factory
  //   props.style SSOT(ADR-907 Layer B). DOM=generic(KNOWN_HTML DialogFooter→footer), Skia=
  //   buildCatalogShapes box(render.shapes []와 시각 동일).
  primitiveEntry("DialogFooter", "overlays", FAMILY_6_CUTOVER, {
    category: "overlays",
    label: "dialog footer",
    icon: "AppWindowMac",
  }),
  // Toast — ADR-912 R7 G1-c 순수 box-shell catalog cutover (2026-06-15): factory(createToastDefinition)가
  //   Heading + Description 자식 자동 생성 → 런타임 항상 _hasChildren=true → 컨테이너 box(bg+border)만
  //   live(standalone 메시지 text dead). AvatarGroup/CardView/TableView/Pagination box-shell 동형. 구 spec
  //   좌측 accent bar(rect 3px)는 RAC 공식 Toast(react-aria.adobe.com/Toast — accent bar 없음) 미준수
  //   변형이라 제거(사용자 결정 2026-06-15) → skiaPrimitive 없는 순수 box shell. DOM=dedicated
  //   renderToast(<div role="alert">) + 자식. palette 미노출(imperative 알림 — paletteItems 비포함)이나
  //   TAG_SPEC_MAP 등록 type 이라 catalog cutover 로 spec 의존 끊기(step 4 삭제 안전).
  primitiveEntry("Toast", "overlays", FAMILY_6_CUTOVER, {
    category: "overlays",
    label: "toast",
    icon: "Bell",
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
 * **color leaf 5종 box-only cutover (사용자 방침 2026-06-11)**: ColorSwatch/ColorArea/ColorWheel/
 * ColorSlider/TailSwatch 는 빌더 완성 후 제일 나중에 ProgressCircle 구조(react-aria.adobe.com/
 * ColorWheel 레퍼런스)로 진짜 구현 예정. 지금은 spec 제거 + catalog cutover 등록(6 registry collapse)
 * 만을 위해 **box 영역만** 가진 형태로 등록 — 동적 색/gradient/wheel/thumb 시각은 generic
 * buildCatalogShapes(box)로 재현 안 함(의도적 손실, escape 없음). 후속 작업에서 arc/wheel skiaPrimitive
 * 로 복원. ColorPicker/ColorSwatchPicker(container)는 자식 처리가 달라 다음 slice 로 분리.
 */
const FAMILY_7_CUTOVER: CutoverState = "catalog";

const FAMILY_7_ENTRIES: ComponentCatalogEntry[] = [
  // Calendar/RangeCalendar — calendar_grid skiaPrimitive(replace), binding 이 키 지정.
  primitiveEntry("Calendar", "date-color", FAMILY_7_CUTOVER, {
    category: "dateTime",
    label: "calendar",
    icon: "Calendar",
  }),
  primitiveEntry("RangeCalendar", "date-color", FAMILY_7_CUTOVER, {
    category: "dateTime",
    label: "range calendar",
    icon: "CalendarDays",
  }),
  // DatePicker/DateRangePicker — datefield_trigger skiaPrimitive(replace), binding 이 키 지정.
  primitiveEntry("DatePicker", "date-color", FAMILY_7_CUTOVER, {
    category: "dateTime",
    label: "date picker",
    icon: "CalendarCheck",
  }),
  primitiveEntry("DateRangePicker", "date-color", FAMILY_7_CUTOVER, {
    category: "dateTime",
    label: "date range picker",
    icon: "CalendarDays",
  }),
  // ADR-912 Color leaf 5종 box-only cutover (2026-06-11): spec 제거 + catalog 등록(6 registry
  //   collapse)을 위해 box 영역만. 동적 색/gradient/wheel/thumb 시각 손실은 의도적 — 빌더 완성 후
  //   ProgressCircle 구조로 진짜 구현. binding 은 box-only 메타(props accepts)만, 시각은 generic.
  primitiveEntry("ColorSwatch", "date-color", FAMILY_7_CUTOVER, {
    category: "color",
    label: "color swatch",
    icon: "Palette",
  }),
  primitiveEntry("ColorArea", "date-color", FAMILY_7_CUTOVER, {
    category: "color",
    label: "color area",
    icon: "Palette",
  }),
  primitiveEntry("ColorWheel", "date-color", FAMILY_7_CUTOVER, {
    category: "color",
    label: "color wheel",
    icon: "Circle",
  }),
  primitiveEntry("ColorSlider", "date-color", FAMILY_7_CUTOVER, {
    category: "color",
    label: "color slider",
    icon: "Sliders",
  }),
  primitiveEntry("TailSwatch", "date-color", FAMILY_7_CUTOVER, {
    category: "color",
    label: "tail swatch",
    icon: "Palette",
  }),
];

/**
 * ADR-142 family ⑧(composition-native) native entry 헬퍼. frame/Slot/MaskedFrame 은 RAC
 * primitive 도 reusable 문서도 아닌 canonical 일급 노드 → binding/reusableId/cutover 없음.
 */
function nativeEntry(
  type: string,
  panel: {
    category: string;
    label: string;
    icon: string;
    layoutOnly?: boolean;
  },
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
  nativeEntry("Slot", {
    category: "layout",
    label: "slot",
    icon: "Layers",
    layoutOnly: true,
  }),
];

/**
 * 컴포넌트 카탈로그 — 등록 SSOT. family cutover 진행 시 family 별 entry 가 누적된다.
 * 현재 family ①~⑧ 등록 — ⑦ date-color 에 color leaf 5종(ColorSwatch/Area/Wheel/Slider/TailSwatch)
 * box-only cutover 포함(2026-06-11). ColorPicker/ColorSwatchPicker(container)는 다음 slice 분리.
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
 * type → palette 표시 메타(`PanelMeta`) 조회. ComponentList 파생 SSOT 진입점
 * (ADR-912 6 registry collapse §2-5 #1). category/label/icon/layoutOnly 의 단일 source —
 * builder ComponentList 의 정적 배열을 본 메타 파생으로 대체한다.
 */
export function getPanelMeta(type: string): PanelMeta | undefined {
  return CATALOG_BY_TYPE.get(type)?.panel;
}

/**
 * `cutover === "catalog"` 인 type 집합 — DOM(Preview)/Inspector/Skia catalog 게이트의 파생 source.
 * **ADR-912 단계 5 step 1 (2026-06-04)**: skiaLegacy 0건 도달 → 본 집합이 DOM/Skia 공통 전환
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

/**
 * type → catalog binding accepts 의 default 집합 (D2/D3 prop default 의 SSOT).
 *
 * **ADR-912 6 registry collapse §2-5 #3 (Factory/default props)**: `primitive` entry 의
 * `binding.props.accepts` 를 순회하며 `contract.default !== undefined` 인 키만 모은다.
 * variant/size/fillStyle/type/strokeWidth/staticColor 등 visual·enum·number default 가
 * 대상 — 이것이 컴포넌트 초기 props 의 catalog-파생 base 다.
 *
 * builder 의 `deriveDefaultPropsFromCatalog(type)` 가 이 base 위에 builder-local override
 * (children placeholder 텍스트 / name / style 등 catalog 에 표현 못 하는 잔여)를 합성하여
 * `createDefault{Type}Props()` 손-코딩을 대체한다. ComponentList(#1) 의 catalog.panel 파생과
 * 동형 — catalog SSOT + builder-local overlay 2층.
 *
 * `reusable`/`native` entry 는 binding 이 없어 빈 객체를 반환한다(파생 대상 0, factory-local).
 */
export function getCatalogDefaultProps(
  type: string,
): Readonly<Record<string, unknown>> {
  const entry = CATALOG_BY_TYPE.get(type);
  if (!entry || entry.kind !== "primitive") return {};
  const accepts = entry.binding.props.accepts;
  const defaults: Record<string, unknown> = {};
  for (const key of Object.keys(accepts)) {
    const contract = accepts[key];
    if (contract.default !== undefined) defaults[key] = contract.default;
  }
  return defaults;
}
