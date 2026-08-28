/**
 * AI 컴포넌트 카탈로그 (ADR-134 Phase 5, D6) — **파생 카탈로그**.
 *
 * 모델은 composition 의 컴포넌트 vocabulary 를 주입 없이 알 수 없다 (ADR-011 §1.3.1
 * "컴포넌트 지식 격차"). 그 지식을 **손으로 다시 적지 않는다** — D3 SSOT 인 catalog
 * (`componentCatalog` + `COMPONENT_RULES_TABLE`) 와 D2 편집 계약 (`resolveEditContract`)
 * 에서 그대로 파생한다.
 *
 * 왜 파생인가: 카탈로그를 손으로 적으면 SSOT 와 갈라진다 — 수동 CSS 가 spec 파생이 아닐 때와
 * 같은 위반이다 (`.claude/rules/ssot-hierarchy.md` §6). 모델에게 "Button 의 variant 는 6종"
 * 이라고 알려 주는 근거는 언제나 `COMPONENT_RULES_TABLE.Button.variants` 하나여야 한다.
 *
 * 옵션 파생을 직접 구현하지 않고 `resolveEditContract` 를 부르는 이유도 같다 — Inspector 가
 * 사용자에게 보여 주는 선택지와 AI 에게 알려 주는 선택지가 같은 함수에서 나온다.
 */
import {
  componentCatalog,
  resolveEditContract,
  type ComponentCatalogEntry,
  type ComponentTag,
  type InspectorFieldKind,
  type ResolvedField,
} from "@composition/shared";

/** 카탈로그가 모델에게 알려 주는 prop 1개. */
export interface AiCatalogProp {
  name: string;
  kind: InspectorFieldKind;
  /** `semantic` = `props`, `style` = `styles` — 도구 인자가 갈린다. */
  origin: "semantic" | "style";
  section: string;
  /** enum / variant / size / fillStyle 의 허용 값 (SSOT 파생). 그 외 undefined. */
  values?: readonly string[];
  default?: unknown;
}

/** 카탈로그가 모델에게 알려 주는 컴포넌트 1개. */
export interface AiCatalogEntry {
  type: string;
  category: string;
  label: string;
  kind: ComponentCatalogEntry["kind"];
  /** RAC primitive 이름 (D1 권위). internal source / native 는 undefined. */
  racPrimitive?: string;
  /** RAC 이 노출하는 상태 (`isDisabled` 등) — a11y·상호작용 서술용. */
  states?: readonly string[];
  props: readonly AiCatalogProp[];
  placeable: boolean;
}

/**
 * 컨테이너로 쓸 수 있는 canonical type. frame 은 catalog `native` entry 이지만
 * "여러 요소를 담는 그릇" 이라는 사실은 catalog 에 필드가 없다 (ADR-130 결정).
 */
export const CONTAINER_TYPES: ReadonlySet<string> = new Set([
  "frame",
  "Slot",
  "Section",
  "Nav",
]);

function toProp(field: ResolvedField): AiCatalogProp {
  const values = field.options?.map((o) => o.value);
  return {
    name: field.key,
    kind: field.kind,
    origin: field.origin,
    section: field.section,
    ...(values && values.length > 0 ? { values } : {}),
    ...(field.baseValue !== undefined ? { default: field.baseValue } : {}),
  };
}

function deriveEntry(entry: ComponentCatalogEntry): AiCatalogEntry {
  const binding = entry.kind === "primitive" ? entry.binding : undefined;
  const racPrimitive =
    binding?.source.kind === "rac" ? binding.source.component : undefined;
  const states = binding?.rac?.states;

  // reusable(조합) entry 는 편집 계약이 코드가 아니라 **origin 문서**의 propsSchema 에 있다
  // (ADR-148 Decision 4). 활성 문서 없이는 알 수 없으므로 props 를 지어내지 않고 비운다 —
  // 모델은 인스턴스를 만든 뒤 `get_editor_state` 로 확인한다.
  const contract =
    entry.kind === "reusable"
      ? null
      : resolveEditContract(
          // 빈 props 의 합성 노드 — Inspector 가 신규 요소에 보여 주는 계약과 동일하다.
          // catalog entry 의 type 은 정의상 ComponentTag 이지만 entry 타입은 string 이다.
          {
            id: `__ai_catalog__${entry.type}`,
            type: entry.type as ComponentTag,
            props: {},
          },
          null,
        );

  return {
    type: entry.type,
    category: entry.panel.category,
    label: entry.panel.label,
    kind: entry.kind,
    ...(racPrimitive ? { racPrimitive } : {}),
    ...(states && states.length > 0 ? { states } : {}),
    props: contract ? contract.fields.map(toProp) : [],
    placeable: entry.panel.placeable,
  };
}

/**
 * type 1개당 entry 1개로 접는다.
 *
 * catalog 에는 같은 type 이 primitive + reusable 로 두 번 등록된 항목이 4개 있다
 * (Toolbar / Form / Card / InlineAlert — ADR-148 HC#3 placeable 단일성). 이때 실제로
 * 만들어지는 것은 **reusable origin 의 ref 인스턴스**이므로 (`entryUniverse` 가
 * `reusableOrigin` 으로 분기), primitive 쪽 accepts 를 모델에게 알려 주면 존재하지 않는
 * 편집 prop 을 광고하게 된다. palette 에 노출되는 쪽 (placeable) 을 정본으로 삼는다.
 */
function foldByType(
  entries: readonly ComponentCatalogEntry[],
): ComponentCatalogEntry[] {
  const byType = new Map<string, ComponentCatalogEntry>();
  for (const entry of entries) {
    const prev = byType.get(entry.type);
    if (!prev || (!prev.panel.placeable && entry.panel.placeable)) {
      byType.set(entry.type, entry);
    }
  }
  return [...byType.values()];
}

let cache: readonly AiCatalogEntry[] | null = null;

/** 전체 AI 카탈로그 (catalog SSOT 파생, 1회 계산 후 캐시). type 당 1개. */
export function getAiComponentCatalog(): readonly AiCatalogEntry[] {
  if (!cache) cache = foldByType(componentCatalog).map(deriveEntry);
  return cache;
}

export function getAiCatalogEntry(type: string): AiCatalogEntry | undefined {
  return getAiComponentCatalog().find((e) => e.type === type);
}

/** 컨테이너로 쓸 수 있는가 — 배치 계획을 세울 때 모델이 필요한 사실. */
export function isContainerType(type: string): boolean {
  return CONTAINER_TYPES.has(type);
}

/** 카테고리 → 그 카테고리의 type 목록 (팔레트 노출 항목만). */
export function getCatalogByCategory(): ReadonlyMap<string, readonly string[]> {
  const map = new Map<string, string[]>();
  for (const entry of getAiComponentCatalog()) {
    if (!entry.placeable) continue;
    const bucket = map.get(entry.category) ?? [];
    bucket.push(entry.type);
    map.set(entry.category, bucket);
  }
  return map;
}

// ── 프롬프트 직렬화 ──────────────────────────────────────────────────

function formatValues(prop: AiCatalogProp): string {
  const parts: string[] = [];
  if (prop.values) parts.push(prop.values.join("|"));
  else parts.push(prop.kind);
  if (prop.default !== undefined && prop.default !== null && prop.default !== "")
    parts.push(`기본 ${String(prop.default)}`);
  return parts.join(", ");
}

/** Tier 1 — 카테고리별 type 목록. 항상 주입한다 (전체 vocabulary, 상세 없음). */
export function formatCatalogIndex(): string {
  const lines: string[] = [];
  for (const [category, types] of getCatalogByCategory()) {
    lines.push(`- ${category}: ${types.join(", ")}`);
  }
  return lines.join("\n");
}

/**
 * Tier 2 — 컴포넌트 1개의 상세. `styles` 인자로 가는 보편 시각 키는 모든 컴포넌트가
 * 동일하므로 여기서 빼고 시스템 프롬프트에 한 번만 적는다 (중복 주입 = 예산 낭비).
 */
export function formatCatalogEntry(entry: AiCatalogEntry): string {
  const head = [
    `### ${entry.type}`,
    `(${entry.category}`,
    entry.racPrimitive ? `, RAC ${entry.racPrimitive}` : "",
    isContainerType(entry.type) ? ", 컨테이너" : "",
    ")",
  ].join("");

  if (entry.kind === "reusable") {
    return `${head}\n- 조합 컴포넌트 — 만든 뒤 get_editor_state 로 편집 가능한 props 를 확인하세요`;
  }

  const semantic = entry.props.filter((p) => p.origin === "semantic");
  if (semantic.length === 0) {
    return `${head}\n- 편집 가능한 props 없음 (자식 요소로 구성)`;
  }
  const lines = semantic.map((p) => `- ${p.name}: ${formatValues(p)}`);
  return [head, ...lines].join("\n");
}

/** 여러 entry 를 한 블록으로. */
export function formatCatalogEntries(
  entries: readonly AiCatalogEntry[],
): string {
  return entries.map(formatCatalogEntry).join("\n\n");
}
