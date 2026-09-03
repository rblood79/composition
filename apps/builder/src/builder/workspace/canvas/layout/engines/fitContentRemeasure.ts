/**
 * ADR-923 Phase 5 후속 (2026-09-04) — `fullTreeLayout` 3.6 (implicit child style → batch 패치) 이
 * 쓰는 **판정 3개**를 한 모듈로 뽑는다: (a) sub-part 자식의 delta 기준 style, (b) 폭 재측정 대상
 * 여부, (c) 재측정이 읽는 텍스트.
 *
 * **Why 추출인가**: 3.6 의 fit-content 재측정은 자식 `props.children` 으로 폭을 다시 잰다. 그 텍스트가
 * 화면에 나오는 텍스트와 다르면 (parent 가 자식 텍스트를 결정하는 컴포넌트에서 자식 store 값이 낡았을
 * 때) Canvas 상자만 엉뚱한 폭이 된다 — Meter Label 이 실제로 그랬다 (raw "Storage" 54 vs 투영 "Name"
 * 40 = DOM 39, 2026-09-03). Label 축은 read-only sub-part 판정으로 닫혔지만 (투영 style 에 width 가 없어
 * 재측정 자체가 안 걸린다) "3.6 이 raw 텍스트를 읽는다" 는 성질 자체는 남았다. 판정을 production 함수로
 * 노출해야 `adr923FitContentRemeasureTextSource.test.ts` 가 **복사본이 아닌 실제 판정**으로 전수 대조할
 * 수 있다.
 */
import { resolvePropagatedProps } from "../../../../utils/propagationEngine";
import type { CanvasLayoutNode } from "../layoutNode";
import { projectReadOnlySubpart, type ElementLookup } from "./readOnlySubpart";

/** store 폭이 이 키워드면 텍스트 측정값이 폭을 정한다 → fontSize 가 바뀌면 다시 재야 한다. */
const INTRINSIC_WIDTH_KEYWORDS: ReadonlySet<unknown> = new Set([
  "fit-content",
  "max-content",
  "min-content",
]);

export function isFitContentRemeasureWidth(width: unknown): boolean {
  return INTRINSIC_WIDTH_KEYWORDS.has(width);
}

/** 3.6 의 폭 재측정이 읽는 텍스트 — implicit 이 덮어쓴 뒤의 자식 props 기준. */
export function resolveFitContentRemeasureText(
  props: Record<string, unknown> | undefined,
): string {
  return String(props?.label ?? props?.text ?? props?.children ?? "");
}

export interface SubpartAwareImplicitStyles {
  /** delta 기준 style — sub-part 면 투영값, 아니면 store 인라인. */
  origStyle: Record<string, unknown>;
  /** batch 에 패치할 style — sub-part 면 implicit 이 추가·변경한 키만. */
  modStyle: Record<string, unknown>;
  isSubpartChild: boolean;
}

/**
 * read-only sub-part (2026-09-03 판정 A) 는 자식 인라인이 DOM 에 닿을 채널이 없다. implicitStyles 는
 * 자식 style 을 `{...cs, 주입}` 으로 복사하므로 그 인라인 (DOM 미도달 junk) 이 modStyle 에 그대로
 * 실린다 — 자식 visit 에서 걷어낸 인라인이 3.6 에서 되살아나지 않도록 **implicit 이 추가·변경한 키만**
 * 남긴다. 기준은 raw 인라인이 아니라 투영값이라, factory `width:fit-content` 에 걸리는 폭 재측정도
 * 같이 건너뛴다 (투영 style 에는 width 키워드가 없다).
 */
export function resolveSubpartAwareImplicitStyles(
  originalEl: CanvasLayoutNode,
  modifiedChild: CanvasLayoutNode,
  elementsMap: ElementLookup,
): SubpartAwareImplicitStyles {
  const projectedOriginal = projectReadOnlySubpart(originalEl, elementsMap);
  const isSubpartChild = projectedOriginal !== originalEl;
  const origStyle = (projectedOriginal.props?.style ?? {}) as Record<
    string,
    unknown
  >;
  const full = (modifiedChild.props?.style ?? {}) as Record<string, unknown>;
  if (!isSubpartChild) return { origStyle, modStyle: full, isSubpartChild };
  const modStyle: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(full)) {
    if (v !== origStyle[k]) modStyle[k] = v;
  }
  return { origStyle, modStyle, isSubpartChild };
}

/** 3.6 이 이 자식의 폭을 텍스트로 다시 재는가 (fontSize 주입 + intrinsic 폭 키워드). */
export function shouldRemeasureFitContentWidth(
  origStyle: Record<string, unknown>,
  modStyle: Record<string, unknown>,
): boolean {
  if (modStyle.fontSize == null) return false;
  if (modStyle.fontSize === origStyle.fontSize) return false;
  return isFitContentRemeasureWidth(origStyle.width);
}

/**
 * 재측정 입력 props — parent 가 정하는 텍스트를 **자식 visit 과 같은 registry 로** 한 번 더 읽어 얹는다.
 *
 * 자식 visit (`fullTreeLayout` line ~1466) 은 read-time propagation 을 적용한 뒤 폭을 재는데, 3.6 의 입력
 * 자식은 부모 단계의 `applyImplicitStyles` 가 elementsMap 원본에서 받은 것이라 store 텍스트가 낡아 있으면
 * 그 낡은 폭이 visit 값을 덮었다 (Meter Label "Storage" 54 vs 표시 "Name" 40 = DOM 39, 2026-09-03 —
 * Label 축은 sub-part 판정으로 닫혔고 GridListItem/ListBoxItem 의 Text/Description 이 남아 있었다).
 */
export function resolveRemeasureChildProps(
  parent: CanvasLayoutNode,
  child: CanvasLayoutNode,
): Record<string, unknown> {
  const childProps = (child.props ?? {}) as Record<string, unknown>;
  const patch = resolvePropagatedProps(
    parent.type,
    (parent.props ?? {}) as Record<string, unknown>,
    child.type,
    childProps,
  );
  return patch ? { ...childProps, ...patch } : childProps;
}
