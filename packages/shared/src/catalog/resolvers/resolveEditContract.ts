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
import type { PropContract, PropsSchema } from "../types";
import { getElementDataBinding } from "../../utils/compositionExtensionFields";
import { getCatalogEntry, getReusableEntries } from "../componentCatalog";
import { readPropsSchema } from "../templateBinding";
import { resolveComponentRule } from "./resolveComponentRule";
import { resolveMergedStyle } from "./resolveMergedStyle";
import {
  deriveOptions,
  UNIVERSAL_STYLE_CONTRACTS,
} from "../outputs/editFields";
import type { EditContract, ResolvedField } from "../outputs/editFields";
export {
  deriveOptions,
  UNIVERSAL_STYLE_CONTRACTS,
} from "../outputs/editFields";
export type {
  EditContract,
  ResolvedField,
  EditSection,
  FieldOrigin,
} from "../outputs/editFields";

/**
 * node.props 를 Record 로 안전 추출하고, `dataBinding` 은 공통 extension 읽기 계약으로 보강한다.
 *
 * canonical 의 데이터 연결은 `props.dataBinding` 과 `x-composition.dataBinding` 두 곳에
 * 저장된다 (`PROPS_FORBIDDEN_KEYS` 때문에 `updateNodeExtension` 경로는 후자에만 쓴다).
 * props 만 읽으면 extension 에만 연결이 있는 노드의 편집 계약에서 binding 이 통째로
 * 사라지고, 그 값을 입력으로 쓰는 Properties 컨트롤(Chart 의 컬럼 Select 등)이 연결이
 * 없는 것처럼 동작한다. 읽기 순서는 공통 helper 와 같고 (props → legacy → extension),
 * **읽기 전용 보강** 이다 — UI 를 위해 canonical props 에 다시 저장하지 않는다.
 */
function readProps(
  node: CanonicalNode | ResolvedNode,
): Record<string, unknown> {
  const raw = node.props;
  const props =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  if (Object.hasOwn(props, "dataBinding")) return props;
  const binding = getElementDataBinding(node, "props-first");
  return binding === undefined ? props : { ...props, dataBinding: binding };
}

/** node.props.style 을 Record 로 안전 추출 (object 아니면 빈 객체). */
function readStyle(props: Record<string, unknown>): Record<string, unknown> {
  const style = props.style;
  if (style && typeof style === "object" && !Array.isArray(style)) {
    return style as Record<string, unknown>;
  }
  return {};
}

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
        visibleWhen: contract.visibleWhen,
        editorHidden: contract.editorHidden,
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
        visibleWhen: contract.visibleWhen,
        editorHidden: contract.editorHidden,
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
  //   ADR-228 (2026-09-21): registry reusable 도 origin 이 propsSchema 를 선언하지 않으면
  //   이 경로다 — catalog 파생 generic origin 52 종은 schema 를 문서에 복제하지 않고 origin
  //   type 의 accepts 를 직접 읽는다 (passthrough schema 와 동치 · 템플릿 치환 gate off ·
  //   origin 당 schema byte 0). 종전 제외 대상이던 Toolbar/Form 도 같은 규칙으로 primitive
  //   accepts 필드를 얻는다 ("instance 인지 모르게" 와 같은 방향, breakdown §8.4-1).
  const refId = (node as { ref?: unknown }).ref;
  if (
    !reusable &&
    !accepts &&
    typeof refId === "string" &&
    refId.length > 0 &&
    doc
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
          visibleWhen: contract.visibleWhen,
          editorHidden: contract.editorHidden,
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
      visibleWhen: contract.visibleWhen,
      editorHidden: contract.editorHidden,
    });
  }

  return { type: node.type, fields };
}
