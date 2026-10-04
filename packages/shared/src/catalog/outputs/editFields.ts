import type {
  InspectorFieldKind,
  PropContract,
  VisibilityCondition,
} from "../types";
import type { ComponentRule } from "../../types/composition-document.types";

/** 필드 옵션 계산에 필요한 값만 받는다. 문서·저장 모델에 의존하지 않는다. */
export interface EditOptionNode {
  type: string;
  children?: readonly { type: string; props?: unknown }[];
}

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
  /**
   * 조건부 노출 (PropContract 통과 — ADR-208 P1ⓐ).
   *
   * 계약은 **필드를 지우지 않는다** — 조건을 실어 보내기만 하고, 판정은 view 레이어
   * (`GenericFieldRenderer`) 가 한다. 여기서 걸러 버리면 계약이 "이 노드에 없는 prop" 이라
   * 거짓말을 하게 되고, 같은 계약을 쓰는 다른 소비처(Style view · 테스트)가 조건을 볼
   * 방법이 사라진다.
   */
  visibleWhen?: VisibilityCondition;
  editorHidden?: boolean;
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
  node: EditOptionNode,
): PropContract["options"] {
  const children = node.children ?? [];
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
export function deriveOptions(
  contract: PropContract,
  rule: ComponentRule | undefined,
  node: EditOptionNode,
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
