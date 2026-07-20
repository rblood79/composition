/**
 * ADR-912 1A-(4) — 편집 계약 단일 진입점 (HC#1/#2).
 *
 * 선택 노드의 **편집 가능한 필드 전부**를 origin(semantic / style) 태그와 함께 산출한다.
 * Properties view 와 Style view 두 패널이 본 함수 **하나**를 호출하고 `section` 으로 필터해
 * 두 뷰로 나눈다 — "단일 공급원"(HC#1) + "패널 두 view"(HC#2) 의 실제 메커니즘.
 *
 * **두 source 합집합**:
 * - (A) **semantic** (Properties view): D1 투영 prop + 의미 props(variant/size/fillStyle 등).
 *   source = `getCatalogEntry(type).binding.props.accepts`(primitive) — `Record<string, PropContract>`.
 *   write target = `node.props[key]` (updateSelectedProperties).
 * - (B) **universal style** (Style view): 모든 노드 공유 보편 시각 키 공간(`UNIVERSAL_STYLE_CONTRACTS`).
 *   컴포넌트별 분기 0 — base 값만 노드별로 다르다(theme rule resolve). write target =
 *   `node.props.style[key]` (updateSelectedStyle, override-only).
 *
 * **origin discriminant 가 write 라우팅의 단일 진실**: round-trip 무손실 = 같은 노드를 두
 *   경로로 나눠 저장(props 의미 / props.style 시각)하되 한 함수가 둘을 합쳐 보여준다. reset 은
 *   origin 으로 분기(semantic → prop 삭제 / style → props.style[k] 삭제 = base 복귀).
 *
 * **1A scope (token 미해소 통과)**: style 필드의 `baseValue` 는 `resolveMergedStyle(node).base`
 *   (= `ComponentRuleSize`) 에서 꺼낸 TokenRef 미해소값을 그대로 둔다 — 1A-(b) `resolveMergedStyle`
 *   과 같은 경계(`specs ← shared` 상 token 해소 = specs 전용). 패널 표시 시 token→값 해소는
 *   view 레이어(단계 2)의 책임. 본 계약은 origin 라우팅 + override 상태(isOverridden) +
 *   currentValue 우선순위(override ?? base)만 정확히 산출한다.
 *
 * **패키지 경계**: `resolveMergedStyle` + `getCatalogEntry` (둘 다 shared 자급) 만 사용 → specs import 0.
 */

import type { CanonicalNode } from "../../types/composition-document.types";
import type { CompositionDocument } from "../../types/composition-document.types";
import type { ResolvedNode } from "../../types/canonical-resolver.types";
import type { InspectorFieldKind, PropContract, PropsSchema } from "../types";
import { getCatalogEntry, getReusableEntries } from "../componentCatalog";
import { readPropsSchema } from "../templateBinding";
import { resolveComponentRule } from "./resolveComponentRule";
import { resolveMergedStyle } from "./resolveMergedStyle";
import type { ComponentRule } from "../../types/composition-document.types";

/** 편집 필드 그룹 태그 — Properties view(content/appearance/state/locale) / Style view(typography/appearance/transform/layout). */
export type EditSection =
  | "content"
  | "appearance"
  | "state"
  | "locale"
  | "typography"
  | "transform"
  | "layout"
  | (string & {});

/**
 * 편집 source 라우팅 discriminant.
 * - `semantic`: `node.props[key]` (의미층 D2) — Properties view.
 * - `style`: `node.props.style[key]` (시각 override 층 D3, override-only) — Style view.
 */
export type FieldOrigin = "semantic" | "style";

/** 해소된 단일 편집 필드 — `PropContract` + origin/상태/값. */
export interface ResolvedField {
  key: string;
  kind: InspectorFieldKind;
  label: string;
  section: EditSection;
  /** write 라우팅 단일 진실. */
  origin: FieldOrigin;
  /** 현재 노드에 명시값이 있는가 (style: props.style[k] 존재 / semantic: props[k] 존재). */
  isOverridden: boolean;
  /** 미오버라이드 시의 기준값 (style: theme rule base TokenRef 미해소 / semantic: contract.default). */
  baseValue: unknown;
  /** 표시/편집값 = override ?? base. */
  currentValue: unknown;
  /** number 전용 메타 (PropContract 통과). */
  min?: number;
  max?: number;
  step?: number;
  /** enum/fillStyle 고정 옵션 (variant/size 는 theme 가 별도 제공 — 본 계약은 미해소). */
  options?: PropContract["options"];
  /** `kind:"items-manager"` 전용 — 정적 items 배열 편집 schema (PropContract 통과). */
  itemsManager?: PropContract["itemsManager"];
}

/** 노드 1개의 편집 계약 — 두 source 합집합. */
export interface EditContract {
  type: string;
  fields: ResolvedField[];
}

/**
 * 모든 노드가 공유하는 **보편 시각 키 공간** (컴포넌트별 분기 0).
 *
 * base 값만 노드별로 다르다(theme rule `ComponentRuleSize` resolve). 키 집합은
 * `ComponentRuleSize`(fontSize/lineHeight/borderRadius/borderWidth/height/iconSize) 의 시각
 * 채널 + 사용자 편집 빈도 높은 보편 box 시각(backgroundColor/color/borderColor/opacity)으로
 * 잡는다. section 은 Style view 그룹핑 — typography/appearance/transform/layout.
 *
 * **base 출처 정합**: `resolveStyleBase` 가 이 키를 `resolveMergedStyle(node).base` 에서 찾으므로,
 * base 가 채워지는 키(fontSize/lineHeight/borderRadius/borderWidth/height)는 `ComponentRuleSize`
 * 필드명과 1:1 이어야 한다. 그 외(backgroundColor 등)는 base 없음(undefined) → override-only.
 */
export const UNIVERSAL_STYLE_CONTRACTS: Record<string, PropContract> = {
  // typography
  fontSize: { kind: "number", label: "Font Size", section: "typography" },
  lineHeight: { kind: "number", label: "Line Height", section: "typography" },
  color: { kind: "string", label: "Text Color", section: "typography" },
  // appearance
  backgroundColor: {
    kind: "string",
    label: "Background",
    section: "appearance",
  },
  borderColor: { kind: "string", label: "Border Color", section: "appearance" },
  borderWidth: { kind: "number", label: "Border Width", section: "appearance" },
  borderRadius: {
    kind: "number",
    label: "Corner Radius",
    section: "appearance",
  },
  // transform
  opacity: {
    kind: "number",
    label: "Opacity",
    section: "transform",
    min: 0,
    max: 1,
    step: 0.01,
  },
  // layout (시각 채널만 — padding/gap 은 ADR-907 Layer B 경로 유지, 본 표 제외)
  height: { kind: "number", label: "Height", section: "layout" },
};

/** node.props 를 Record 로 안전 추출. */
function readProps(node: CanonicalNode): Record<string, unknown> {
  const props = node.props;
  if (props && typeof props === "object" && !Array.isArray(props)) {
    return props as Record<string, unknown>;
  }
  return {};
}

/** node.props.style 을 Record 로 안전 추출 (object 아니면 빈 객체). */
function readStyle(props: Record<string, unknown>): Record<string, unknown> {
  const style = props.style;
  if (style && typeof style === "object" && !Array.isArray(style)) {
    return style as Record<string, unknown>;
  }
  return {};
}

/**
 * size 키 → 표시 라벨 (xs→XS / sm→S / md→M / lg→L / xl→XL).
 * shared 자급 — builder 의 `SIZE_DISPLAY_LABELS`(SpecField.tsx) 와 동일 매핑을 패키지 경계 보존을
 * 위해 복제(specs ← shared, builder 미import). 미정의 키는 `value.toUpperCase()` fallback.
 */
const SIZE_DISPLAY_LABELS: Record<string, string> = {
  xs: "XS",
  sm: "S",
  md: "M",
  lg: "L",
  xl: "XL",
};

/** variant 키 → 표시 라벨 (default→Default). 첫 글자만 대문자. */
function variantLabel(value: string): string {
  return value.length > 0
    ? value.charAt(0).toUpperCase() + value.slice(1)
    : value;
}

/**
 * RadioGroup `value` 옵션을 자식 Radio 에서 파생 (2026-06-30 전수조사).
 *
 * **Why**: "어느 항목이 선택/활성인가" 기능이 단일항목(isSelected boolean)과 그룹 사이에서
 *   갈렸다. RadioGroup 만 value 를 string 자유입력으로 노출 → 사용자가 존재하지 않는 key 를
 *   칠 수 있어 선택이 깨짐. RAC value 는 string 타입이되 유효 선택은 자식 `<Radio value>`
 *   집합으로 제약(reference RadioGroup.md) → 자식 value 목록 기반 select 가 정합.
 * - 옵션 value = 자식 Radio 의 `props.value`. value 없는 Radio 는 선택 식별 불가 → 제외.
 * - 라벨 = Radio 의 `props.children`(라벨 텍스트), 없으면 value 자체.
 * - 자식 Radio 0개 → 빈 배열(graceful, 빈 그룹). enum 정적 options 로는 표현 불가하므로
 *   본 분기가 node.children 동적 파생을 담당(variant/size theme 파생과 동형의 동적 source).
 */
function deriveRadioGroupValueOptions(
  node: CanonicalNode | ResolvedNode,
): PropContract["options"] {
  const children = (node as CanonicalNode).children ?? [];
  const options: NonNullable<PropContract["options"]> = [];
  for (const child of children) {
    if (child.type !== "Radio") continue;
    const childProps =
      child.props &&
      typeof child.props === "object" &&
      !Array.isArray(child.props)
        ? (child.props as Record<string, unknown>)
        : {};
    const value = childProps.value;
    if (typeof value !== "string" || value.length === 0) continue;
    const labelRaw = childProps.children;
    const label =
      typeof labelRaw === "string" && labelRaw.length > 0 ? labelRaw : value;
    options.push({ value, label });
  }
  return options;
}

/**
 * size / variant 옵션을 theme rule 에서 파생 (ADR-912 단계 2 회귀 수정) + RadioGroup value
 * 자식 파생(2026-06-30).
 *
 * **Why**: `kind:"size"`/`"variant"` PropContract 는 `options` 를 두지 않는다(선택 값 집합은
 *   theme rule 의 `data-*` 값 집합 = source of truth). 구 경로(`inspectorFields.ts` →
 *   `theme.resolveDimensionOptions`)는 이를 파생했으나 단계 2 패널 교체 시 본 함수로 미이식 →
 *   `options=undefined` → GenericFieldRenderer `?? []` → PropertySizeToggle `?? fallback` 에서
 *   `[]` 가 truthy 라 fallback 미실행 → 발효 컴포넌트 전체 빈 드롭다운.
 * - `kind:"size"`   → `Object.keys(rule.sizes)` (xs~xl), 라벨 = `SIZE_DISPLAY_LABELS`.
 * - `kind:"variant"`→ `Object.keys(rule.variants)`, 라벨 = `variantLabel`.
 * - RadioGroup `value`(enum) → 자식 Radio value 동적 파생([[deriveRadioGroupValueOptions]]).
 * - enum 등 `contract.options` 직접 보유 → 그대로 통과 (theme 미경유).
 * - rule 미등록 / sizes·variants 부재 → undefined (override-only, 기존 동작 보존).
 */
function deriveOptions(
  contract: PropContract,
  rule: ComponentRule | undefined,
  node: CanonicalNode | ResolvedNode,
  key: string,
): PropContract["options"] {
  if (contract.options) return contract.options;
  // RadioGroup value 는 정적 options 없이 자식 Radio value 집합에서 동적 파생.
  if (
    contract.kind === "enum" &&
    key === "value" &&
    node.type === "RadioGroup"
  ) {
    return deriveRadioGroupValueOptions(node);
  }
  if (contract.kind === "size" && rule?.sizes) {
    return Object.keys(rule.sizes).map((value) => ({
      value,
      label: SIZE_DISPLAY_LABELS[value] ?? value.toUpperCase(),
    }));
  }
  if (contract.kind === "variant" && rule?.variants) {
    return Object.keys(rule.variants).map((value) => ({
      value,
      label: variantLabel(value),
    }));
  }
  return undefined;
}

/** 문서 트리에서 id 로 노드 탐색 (DFS) — reusable origin lookup 용. */
function findDocumentNodeById(
  nodes: readonly CanonicalNode[] | undefined,
  id: string,
): CanonicalNode | null {
  if (!nodes) return null;
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findDocumentNodeById(node.children, id);
    if (found) return found;
  }
  return null;
}

/**
 * ADR-148 Phase 2 — ref instance 의 reusable origin + propsSchema 판정.
 *
 * `node.ref` 가 catalog reusable entry 의 reusableId 이고 문서 내 origin root 가
 * `metadata.propsSchema` 를 선언했을 때만 반환한다 (미선언 reusable — Toolbar/Form —
 * 은 기존 동작 유지: semantic 필드 없음).
 */
function resolveReusablePropsSchema(
  node: CanonicalNode | ResolvedNode,
  doc: CompositionDocument | null | undefined,
): { origin: CanonicalNode; schema: PropsSchema } | null {
  const ref = (node as { ref?: unknown }).ref;
  if (typeof ref !== "string" || ref.length === 0 || !doc) return null;
  if (!getReusableEntries().some((entry) => entry.reusableId === ref)) {
    return null;
  }
  const origin = findDocumentNodeById(doc.children, ref);
  if (!origin) return null;
  const schema = readPropsSchema(origin);
  return schema ? { origin, schema } : null;
}

/**
 * 노드 → 편집 계약 (semantic ∪ universal style).
 *
 * @param node 선택 노드 (canonical 또는 resolved instance).
 * @param doc theme rule override source (문서별 커스텀 규칙 — 없으면 build-time 기본).
 */
export function resolveEditContract(
  node: CanonicalNode | ResolvedNode,
  doc?: CompositionDocument | null,
): EditContract {
  const props = readProps(node);
  const style = readStyle(props);
  const fields: ResolvedField[] = [];
  // size / variant 옵션 파생 source (theme rule). 1회 조회 후 두 분기 공유. 미등록 type 은 undefined.
  const rule = resolveComponentRule(node.type, doc);

  // (A′) semantic — reusable ref instance 의 origin propsSchema (ADR-148 Phase 2).
  //   node 는 raw instance(type:"ref") 라 (A) primitive accepts 와 상호 배타적으로 발동.
  //   isOverridden = instance 자체 props 보유 여부 (resolve 이전이라 dirty 판정 정확).
  //   write target 은 (A) 와 동일하게 node.props[key] — instance root props override.
  const reusable = resolveReusablePropsSchema(node, doc);
  if (reusable) {
    const originRule = resolveComponentRule(reusable.origin.type, doc);
    for (const [key, contract] of Object.entries(reusable.schema)) {
      const isOverridden = Object.hasOwn(props, key);
      const baseValue = reusable.origin.props?.[key] ?? contract.default;
      fields.push({
        key,
        kind: contract.kind,
        label: contract.label ?? key,
        section: contract.section ?? "content",
        origin: "semantic",
        isOverridden,
        baseValue,
        currentValue: isOverridden ? props[key] : baseValue,
        min: contract.min,
        max: contract.max,
        step: contract.step,
        options: deriveOptions(contract, originRule, reusable.origin, key),
        itemsManager: contract.itemsManager,
      });
    }
  }

  // (A) semantic — getCatalogEntry(type).binding.props.accepts (primitive). origin:"semantic".
  const entry = getCatalogEntry(node.type);
  const accepts =
    entry?.kind === "primitive" ? entry.binding.props.accepts : undefined;
  if (accepts) {
    for (const [key, contract] of Object.entries(accepts)) {
      const isOverridden = Object.hasOwn(props, key);
      fields.push({
        key,
        kind: contract.kind,
        label: contract.label ?? key,
        section: contract.section ?? "content",
        origin: "semantic",
        isOverridden,
        baseValue: contract.default,
        currentValue: isOverridden ? props[key] : contract.default,
        min: contract.min,
        max: contract.max,
        step: contract.step,
        options: deriveOptions(contract, rule, node, key),
        itemsManager: contract.itemsManager,
      });
    }
  }

  // (A″) semantic — 비-registry ref instance 의 origin type 계약 fallback (2026-07-20).
  //   template origin ref(ListBox/GridList/Menu 계열 — `component-listbox` 등)와 사용자
  //   생성 컴포넌트 instance 는 (A′) catalog reusable 미등록·propsSchema 미선언 + (A)
  //   node.type="ref" 로 양쪽 모두 탈락해 편집 계약이 비었다(items-manager 소실 —
  //   instance 에서 리스트 편집 불가). origin 문서 노드의 type 이 primitive catalog entry
  //   를 가지면 그 accepts 로 계약을 파생한다. write target 은 (A′) 와 동일하게
  //   node.props[key] — instance root props override(resolve 시 origin props 위에 merge).
  //   registry reusable(Toolbar/Form — propsSchema 의도적 미선언, ADR-148 Phase 2 결정
  //   "기존 동작 유지: semantic 필드 없음")은 제외 — (A′) propsSchema 경로 전용.
  const refId = (node as { ref?: unknown }).ref;
  if (
    !reusable &&
    !accepts &&
    typeof refId === "string" &&
    refId.length > 0 &&
    doc &&
    !getReusableEntries().some(
      (catalogEntry) => catalogEntry.reusableId === refId,
    )
  ) {
    const origin = findDocumentNodeById(doc.children, refId);
    const originEntry = origin ? getCatalogEntry(origin.type) : undefined;
    const originAccepts =
      originEntry?.kind === "primitive"
        ? originEntry.binding.props.accepts
        : undefined;
    if (origin && originAccepts) {
      const originProps = readProps(origin);
      const originRule = resolveComponentRule(origin.type, doc);
      for (const [key, contract] of Object.entries(originAccepts)) {
        const isOverridden = Object.hasOwn(props, key);
        const baseValue = Object.hasOwn(originProps, key)
          ? originProps[key]
          : contract.default;
        fields.push({
          key,
          kind: contract.kind,
          label: contract.label ?? key,
          section: contract.section ?? "content",
          origin: "semantic",
          isOverridden,
          baseValue,
          currentValue: isOverridden ? props[key] : baseValue,
          min: contract.min,
          max: contract.max,
          step: contract.step,
          options: deriveOptions(contract, originRule, origin, key),
          itemsManager: contract.itemsManager,
        });
      }
    }
  }

  // (B) universal style — UNIVERSAL_STYLE_CONTRACTS. base = theme rule(ComponentRuleSize). origin:"style".
  const { base } = resolveMergedStyle(node as CanonicalNode, doc);
  for (const [key, contract] of Object.entries(UNIVERSAL_STYLE_CONTRACTS)) {
    const isOverridden = Object.hasOwn(style, key);
    // base 는 ComponentRuleSize 필드명과 1:1 인 키만 채워진다(그 외 undefined → override-only).
    const baseValue =
      base && Object.hasOwn(base, key)
        ? (base as Record<string, unknown>)[key]
        : undefined;
    fields.push({
      key,
      kind: contract.kind,
      label: contract.label ?? key,
      section: contract.section ?? "appearance",
      origin: "style",
      isOverridden,
      baseValue,
      currentValue: isOverridden ? style[key] : baseValue,
      min: contract.min,
      max: contract.max,
      step: contract.step,
      options: deriveOptions(contract, rule, node, key),
    });
  }

  return { type: node.type, fields };
}
