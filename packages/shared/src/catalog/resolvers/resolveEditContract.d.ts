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
import type { InspectorFieldKind, PropContract } from "../types";
/** 편집 필드 그룹 태그 — Properties view(content/appearance/state/locale) / Style view(typography/appearance/transform/layout). */
export type EditSection = "content" | "appearance" | "state" | "locale" | "typography" | "transform" | "layout" | (string & {});
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
export declare const UNIVERSAL_STYLE_CONTRACTS: Record<string, PropContract>;
/**
 * 노드 → 편집 계약 (semantic ∪ universal style).
 *
 * @param node 선택 노드 (canonical 또는 resolved instance).
 * @param doc theme rule override source (문서별 커스텀 규칙 — 없으면 build-time 기본).
 */
export declare function resolveEditContract(node: CanonicalNode | ResolvedNode, doc?: CompositionDocument | null): EditContract;
//# sourceMappingURL=resolveEditContract.d.ts.map