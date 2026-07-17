/**
 * ADR-148 Phase 2 — reusable 템플릿 바인딩 `{키}` 치환 엔진 (propsSchema 첫 소비 대응).
 *
 * origin 조합 자식의 string prop 에 담긴 `{키}` placeholder 를 **instance root props
 * (origin 기본값 + override merge 결과)** 로 치환한다. propagation 손등록(parentProp →
 * childProp 코드 규칙)의 데이터 대체 방향 — "무엇이 어디에 반영되는가"가 코드가 아니라
 * origin 문서의 placeholder 위치로 표현된다.
 *
 * **propsSchema gate (CRITICAL)**: 치환은 origin root `metadata.propsSchema` 를 선언한
 * reusable 에만 발동한다. ListBox 계열의 `{label}`/`{description}` 은 row projection
 * (columnMapping/dataBinding/static item)이 채우는 **row-data 바인딩**이라, propsSchema
 * 미선언 origin 의 placeholder 는 resolve 단계에서 건드리지 않아야 한다 (instance root
 * props 에 우연히 동명 키가 있어도 오염 금지). 같은 이유로 bindings 는 항상
 * `resolveTemplateBindingValues()` 로 **schema 키에 한정**해 산출한다.
 *
 * 배선 지점: `canonicalRefResolution.ts` 의 synthetic descendant materialization —
 * builder Skia(canonicalSceneModel) / Preview DOM(App.tsx) / LayerTree / PropertiesPanel
 * 이 모두 `resolveCanonicalRefTree` 를 공유하므로 단일 배선으로 양축이 커버된다.
 */

import type { PropsSchema } from "./types";

/** `{키}` placeholder — 키는 propsSchema 키와 동일한 식별자 문법. */
const TEMPLATE_BINDING_PATTERN = /\{([a-zA-Z][a-zA-Z0-9_-]*)\}/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * origin root 의 `metadata.propsSchema` 방어적 판독 — shape 이 어긋나면 null
 * (치환 gate off + Inspector propsSchema 분기 off).
 */
export function readPropsSchema(node: unknown): PropsSchema | null {
  if (!isRecord(node)) return null;
  const metadata = node.metadata;
  if (!isRecord(metadata)) return null;
  const schema = metadata.propsSchema;
  if (!isRecord(schema)) return null;
  for (const contract of Object.values(schema)) {
    if (!isRecord(contract) || typeof contract.kind !== "string") return null;
  }
  return schema as unknown as PropsSchema;
}

/**
 * 치환에 쓸 바인딩 값 산출 — **schema 키에 한정** (root props 의 무관 키가 placeholder 를
 * 오염시키지 않게). 값 우선순위: resolved root props(origin 기본 + override merge) →
 * `PropContract.default`. 둘 다 없으면 키 자체를 누락시켜 placeholder 를 보존한다.
 */
export function resolveTemplateBindingValues(
  schema: PropsSchema,
  rootProps: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const bindings: Record<string, unknown> = {};
  for (const [key, contract] of Object.entries(schema)) {
    const value = rootProps?.[key] ?? contract.default;
    if (value !== undefined) bindings[key] = value;
  }
  return bindings;
}

/**
 * 노드(props + children 재귀)에서 `{키}` placeholder 키 전부 추출 — propsSchema ↔
 * 템플릿 바인딩 키 1:1 정적 검증(ADR-148 R2 대응 test)용.
 */
export function extractTemplateBindingKeys(node: unknown): Set<string> {
  const keys = new Set<string>();
  collectBindingKeys(node, keys);
  return keys;
}

function collectBindingKeys(node: unknown, out: Set<string>): void {
  if (!isRecord(node)) return;
  const props = node.props;
  if (isRecord(props)) {
    for (const value of Object.values(props)) {
      if (typeof value !== "string") continue;
      for (const match of value.matchAll(TEMPLATE_BINDING_PATTERN)) {
        out.add(match[1]);
      }
    }
  }
  const children = node.children;
  if (Array.isArray(children)) {
    for (const child of children) collectBindingKeys(child, out);
  }
}

function substituteString(
  value: string,
  bindings: Record<string, unknown>,
): unknown {
  // full-match `"{key}"` → 바인딩 값 원형 유지 (boolean/number 타입 보존).
  const fullMatch = /^\{([a-zA-Z][a-zA-Z0-9_-]*)\}$/.exec(value);
  if (fullMatch) {
    const key = fullMatch[1];
    return Object.hasOwn(bindings, key) ? bindings[key] : value;
  }
  return value.replace(TEMPLATE_BINDING_PATTERN, (placeholder, key: string) =>
    Object.hasOwn(bindings, key) ? String(bindings[key]) : placeholder,
  );
}

/**
 * props 1벌에 바인딩 치환 적용. 미보유 키의 placeholder 는 **원형 보존** (row-data 등
 * 후속 단계 바인딩과의 공존 계약). 변경이 없으면 동일 참조를 반환한다 (memo 안정성).
 */
export function substituteTemplateBindingsInProps(
  props: Record<string, unknown>,
  bindings: Record<string, unknown>,
): Record<string, unknown> {
  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === "string" && value.includes("{")) {
      const substituted = substituteString(value, bindings);
      next[key] = substituted;
      if (substituted !== value) changed = true;
    } else {
      next[key] = value;
    }
  }
  return changed ? next : props;
}

/**
 * nested children 구조(node.children 재귀)에 바인딩 치환 적용 — **nested consumer 축**.
 *
 * resolve 는 두 소비 형태를 모두 커버해야 한다: flat synthetic 자식(builder Skia —
 * `resolveCanonicalRefTree` materialization)과 **resolved root 가 `{...master}` 로
 * 물려받는 nested `children`** (Preview `CanonicalNodeRenderer` 가 이를 직접 렌더).
 * 한쪽만 치환하면 CSS↔Skia 발산. 변경이 없으면 동일 참조 반환.
 */
export function substituteTemplateBindingsInChildren(
  children: readonly unknown[],
  bindings: Record<string, unknown>,
): readonly unknown[] {
  let changed = false;
  const next = children.map((child) => {
    if (!isRecord(child)) return child;
    // 중첩 reusable 은 자체 origin 바인딩으로 이미 확정된 서브트리 — 바깥 바인딩이
    // 안쪽 placeholder(예: propsSchema 미선언 ListBox 의 row-data 키)를 오염시키지
    // 않도록 재귀 중단. `_resolvedFrom` = ADR-903 resolver 의 resolved-ref 마커.
    if (typeof child._resolvedFrom === "string") return child;
    const props = child.props;
    const substitutedProps = isRecord(props)
      ? substituteTemplateBindingsInProps(props, bindings)
      : props;
    const childChildren = child.children;
    const substitutedChildren = Array.isArray(childChildren)
      ? substituteTemplateBindingsInChildren(childChildren, bindings)
      : childChildren;
    if (substitutedProps === props && substitutedChildren === childChildren) {
      return child;
    }
    changed = true;
    return {
      ...child,
      ...(substitutedProps !== undefined ? { props: substitutedProps } : {}),
      ...(substitutedChildren !== undefined
        ? { children: substitutedChildren }
        : {}),
    };
  });
  return changed ? next : children;
}
